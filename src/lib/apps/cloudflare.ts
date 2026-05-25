/**
 * Cloudflare REST client — minimal surface for the custom-domain
 * auto-setup flow.
 *
 * Why scoped API tokens (not OAuth2): Cloudflare's OAuth2 flow is
 * gated to the Cloudflare-for-SaaS plan and would require us to
 * register a Cloudflare-side app + run a callback + refresh tokens.
 * Scoped tokens (founder generates one from the "Edit zone DNS"
 * template at https://dash.cloudflare.com/profile/api-tokens) deliver
 * the same `dns_records:edit` capability with zero plumbing on our
 * side. Vercel itself uses this pattern for its Cloudflare DNS helper.
 *
 * Token storage: every install is per-storefront via the existing
 * `installed_apps` table (`app_id = 'cloudflare'`). The plaintext
 * token is encrypted at rest via `encryptToken` in `./crypto`.
 *
 * No global SDK — three small functions are all the integration ever
 * needs:
 *   - verifyToken : confirm the token is live + has the right scope
 *   - listZones   : populate the zone picker
 *   - upsertDnsRecord : write the CNAME / A row, idempotent on retry
 */

const CF_API = 'https://api.cloudflare.com/client/v4';

type CFEnvelope<T> = {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
};

async function cfFetch<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<CFEnvelope<T>> {
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
  // Cloudflare returns its envelope even for non-2xx responses, so we
  // parse defensively and let callers inspect `success`/`errors`.
  let body: CFEnvelope<T> | null = null;
  try {
    body = (await res.json()) as CFEnvelope<T>;
  } catch {
    // ignore — fall through to a synthetic failure envelope
  }
  if (!body) {
    return {
      success: false,
      errors: [{ code: res.status, message: res.statusText || 'no body' }],
      result: undefined as unknown as T,
    };
  }
  return body;
}

/**
 * Hit Cloudflare's `/user/tokens/verify` to confirm the token is live
 * and not expired. Doesn't tell us which scopes it carries — Cloudflare
 * surfaces that only via the granular `/zones/{id}/dns_records` write
 * we attempt later. We treat any successful verify as good-enough to
 * proceed; an invalid scope will surface on first DNS write with a
 * descriptive Cloudflare error code.
 */
export async function verifyToken(
  token: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const body = await cfFetch<{ status: string }>(token, '/user/tokens/verify');
  if (body.success && body.result?.status === 'active') return { ok: true };
  const msg = body.errors[0]?.message ?? 'Cloudflare rejected that token.';
  return { ok: false, message: msg };
}

export type CloudflareZone = { id: string; name: string };

/**
 * List the zones the token is scoped to. The "Edit zone DNS" template
 * scopes the token to a single zone by default, but founders sometimes
 * use account-wide tokens — we cap at 50 zones so the picker never
 * paginates (a founder with >50 Cloudflare zones is not the persona
 * we're optimising for).
 */
export async function listZones(token: string): Promise<CloudflareZone[]> {
  const body = await cfFetch<CloudflareZone[]>(
    token,
    '/zones?per_page=50&status=active',
  );
  if (!body.success || !Array.isArray(body.result)) return [];
  return body.result.map((z) => ({ id: z.id, name: z.name }));
}

export type DnsRecordInput = {
  type: 'CNAME' | 'A';
  /** Either the apex sentinel (`@`) or the subdomain label. Cloudflare
   *  also accepts the full `sub.zone.com`; we pass through whatever the
   *  caller hands us. */
  name: string;
  content: string;
  /** Cloudflare's "proxy" toggle. We force `false` for Vercel-bound
   *  records — proxied records terminate TLS at Cloudflare and break
   *  Vercel's Let's Encrypt issuance. */
  proxied?: false;
  ttl?: number;
};

type CFDnsRecord = {
  id: string;
  type: string;
  name: string;
  content: string;
};

/** Targets we recognise as "owned by Souqna" — safe to overwrite/replace. */
const VERCEL_TARGETS = new Set(['cname.vercel-dns.com', '76.76.21.21', '76.76.21.22']);

function looksVercelOwned(r: { type: string; content: string }): boolean {
  return VERCEL_TARGETS.has(r.content.toLowerCase());
}

async function listRecordsAtName(
  token: string,
  zoneId: string,
  name: string,
): Promise<CFDnsRecord[]> {
  const list = await cfFetch<CFDnsRecord[]>(
    token,
    `/zones/${encodeURIComponent(zoneId)}/dns_records?name=${encodeURIComponent(name)}&per_page=50`,
  );
  return Array.isArray(list.result) ? list.result : [];
}

/**
 * Idempotent + conflict-tolerant DNS write for the custom-domain flow.
 *
 * The naïve "POST /dns_records" approach hits two real-world walls:
 *
 *   1. Same-type duplicate (`81057`). Founder hits "Set up automatically"
 *      twice — Cloudflare rejects the second create because the first
 *      one is still there.
 *   2. Cross-type conflict at the same name (`81044` / `81053`). The
 *      apex already has a CNAME (or A) pointing at an old host, and
 *      Cloudflare's "no two records can share a name across A/AAAA/
 *      CNAME" rule rejects our new record.
 *
 * We handle both by listing every record at the target name *first*,
 * then choosing the right action:
 *
 *   - Already pointing at the exact (type, content) we want → no-op.
 *   - One existing record we can re-use (same type or it points at a
 *     known Vercel target) → PUT over it.
 *   - Multiple records, or non-Vercel content blocking the slot →
 *     delete the blockers first, then POST. We only auto-delete
 *     records whose `content` is in `VERCEL_TARGETS` (i.e. left over
 *     from a previous Souqna / Vercel attach) OR records of the same
 *     type as the one we want. Other records (TXT, MX, SRV, foreign
 *     A pointing at a non-Vercel host) are left untouched and we
 *     surface a typed `'conflict'` error so the UI can prompt the
 *     founder before destroying potentially live config.
 *
 * `name` accepts `@`, the bare label, or the FQDN — Cloudflare
 * normalises internally.
 */
export async function upsertDnsRecord(
  token: string,
  zoneId: string,
  record: DnsRecordInput,
): Promise<
  | { ok: true; recordId: string; created: boolean }
  | {
      ok: false;
      code: 'auth' | 'scope' | 'invalid' | 'conflict' | 'unknown';
      message: string;
    }
> {
  const payload = {
    type: record.type,
    name: record.name,
    content: record.content,
    ttl: record.ttl ?? 1,
    proxied: false,
  };

  // Pre-flight: see what's already at this name.
  const existing = await listRecordsAtName(token, zoneId, record.name);

  // Exact match → nothing to do.
  const exact = existing.find(
    (r) =>
      r.type === record.type && r.content.toLowerCase() === record.content.toLowerCase(),
  );
  if (exact) {
    return { ok: true, recordId: exact.id, created: false };
  }

  // Find a single record we can safely overwrite (same type, or
  // recognisably Souqna/Vercel-owned). Cloudflare's "one A or one
  // CNAME per name" rule means there's at most one such row in
  // practice, but we filter defensively.
  const overwriteCandidate = existing.find(
    (r) => r.type === record.type || looksVercelOwned(r),
  );

  // Anything left after excluding the candidate is a "blocker" — same
  // name, conflicting type, non-Vercel content. Auto-delete only if
  // it's clearly Vercel-owned residue; otherwise surface as a typed
  // conflict the UI can warn about.
  const blockers = existing.filter((r) => r !== overwriteCandidate);
  const unsafeBlockers = blockers.filter((r) => !looksVercelOwned(r));
  if (unsafeBlockers.length > 0) {
    return {
      ok: false,
      code: 'conflict',
      message: `Existing ${unsafeBlockers
        .map((r) => `${r.type} → ${r.content}`)
        .join(', ')} record at ${record.name} blocks Souqna’s record. Remove it in Cloudflare and retry.`,
    };
  }

  // Delete any safe-to-remove blockers in parallel before writing.
  if (blockers.length > 0) {
    await Promise.all(
      blockers.map((r) =>
        cfFetch(token, `/zones/${encodeURIComponent(zoneId)}/dns_records/${r.id}`, {
          method: 'DELETE',
        }),
      ),
    );
  }

  if (overwriteCandidate) {
    const put = await cfFetch<CFDnsRecord>(
      token,
      `/zones/${encodeURIComponent(zoneId)}/dns_records/${overwriteCandidate.id}`,
      { method: 'PUT', body: JSON.stringify(payload) },
    );
    if (put.success && put.result?.id) {
      return { ok: true, recordId: put.result.id, created: false };
    }
    return mapCreateError(put.errors);
  }

  const create = await cfFetch<CFDnsRecord>(
    token,
    `/zones/${encodeURIComponent(zoneId)}/dns_records`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
  if (create.success && create.result?.id) {
    return { ok: true, recordId: create.result.id, created: true };
  }
  return mapCreateError(create.errors);
}

function mapCreateError(
  errors: Array<{ code: number; message: string }>,
): { ok: false; code: 'auth' | 'scope' | 'invalid' | 'conflict' | 'unknown'; message: string } {
  const first = errors[0];
  if (!first) {
    return { ok: false, code: 'unknown', message: 'Cloudflare did not return a result.' };
  }
  if (first.code === 9109) {
    return { ok: false, code: 'scope', message: 'Token is missing dns_records:edit scope.' };
  }
  if (first.code === 6003 || first.code === 10000) {
    return { ok: false, code: 'auth', message: 'Cloudflare rejected the token.' };
  }
  if ([81044, 81053, 81057].includes(first.code)) {
    return {
      ok: false,
      code: 'conflict',
      message:
        'A conflicting DNS record still blocks this hostname. Open Cloudflare and remove or rename it, then retry.',
    };
  }
  if (first.code >= 1000 && first.code < 2000) {
    return { ok: false, code: 'invalid', message: first.message };
  }
  return { ok: false, code: 'unknown', message: first.message };
}
