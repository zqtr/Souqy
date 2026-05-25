/**
 * Vercel domain provisioning for storefront subdomains.
 *
 * Why this exists: `souqna.qa` runs on Cloudflare nameservers, so Vercel
 * can only do HTTP-01 ACME challenges (not DNS-01). HTTP-01 cannot sign
 * wildcard certs, which means `*.souqna.qa` will never get a Let's
 * Encrypt cert auto-issued — even though the wildcard CNAME at Cloudflare
 * routes traffic correctly. Per-subdomain certs *do* work via HTTP-01.
 *
 * So at publish time we add the storefront's specific hostname
 * (`{slug}.souqna.qa`) to the Vercel project. Vercel then issues a
 * single-host cert via Let's Encrypt within ~30s. Idempotent: re-publishing
 * the same store is a no-op once the domain is registered.
 *
 * Failure here must not block publishing — the store row is already in
 * Postgres and `souqna.co` (which has Vercel-NS-backed wildcard) keeps
 * working. We log and move on.
 */
import { env } from './env';

const VERCEL_API = 'https://api.vercel.com';

interface VercelEnv {
  token: string;
  projectId: string;
  teamId?: string;
}

export type StorefrontDomainFailureCode =
  | 'unconfigured'
  | 'project_not_found'
  | 'forbidden'
  | 'taken'
  | 'invalid'
  | 'unknown';

export type StorefrontDomainResult =
  | {
      ok: true;
      status: 'created' | 'exists' | 'skipped';
      primaryUrl: string;
      fallbackUrl?: string;
    }
  | {
      ok: false;
      code: StorefrontDomainFailureCode;
      message: string;
      primaryUrl: string;
      fallbackUrl?: string;
    };

function rawEnv(name: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(process.env, name) ? process.env[name] : undefined;
}

function cleanEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function getVercelEnv(): VercelEnv | null | 'blank-token' {
  // Accept both the documented VERCEL_API_TOKEN and the legacy VERCEL_TOKEN
  // (which the Vercel Sandbox SDK + .env.local.example use) so a single
  // token works across the whole stack.
  const apiToken = rawEnv('VERCEL_API_TOKEN');
  const legacyToken = rawEnv('VERCEL_TOKEN');
  if (
    (apiToken !== undefined && !cleanEnvValue(apiToken)) ||
    (apiToken === undefined && legacyToken !== undefined && !cleanEnvValue(legacyToken))
  ) {
    return 'blank-token';
  }

  const token = cleanEnvValue(apiToken) || cleanEnvValue(legacyToken);
  const projectId = cleanEnvValue(process.env.VERCEL_PROJECT_ID);
  if (!token || !projectId) return null;
  const teamId = cleanEnvValue(process.env.VERCEL_TEAM_ID);
  return { token, projectId, teamId };
}

function teamQuery(teamId: string | undefined): string {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
}

function fallbackRootDomain(): string | undefined {
  const fallback = env.BRIEF_FALLBACK_ROOT_DOMAIN?.trim();
  if (!fallback || fallback === env.BRIEF_ROOT_DOMAIN) return undefined;
  return fallback;
}

function storefrontUrls(slug: string): { primaryUrl: string; fallbackUrl?: string } {
  const primaryUrl = `https://${slug}.${env.BRIEF_ROOT_DOMAIN}`;
  const fallback = fallbackRootDomain();
  return {
    primaryUrl,
    fallbackUrl: fallback ? `https://${slug}.${fallback}` : undefined,
  };
}

function extractVercelCode(body: unknown): string | undefined {
  return body && typeof body === 'object' && 'error' in body
    ? (body as { error?: { code?: string } }).error?.code
    : undefined;
}

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function storefrontFailure(
  slug: string,
  code: StorefrontDomainFailureCode,
  message: string,
): StorefrontDomainResult {
  return { ok: false, code, message, ...storefrontUrls(slug) };
}

async function preflightProject(
  slug: string,
  cfg: VercelEnv,
): Promise<StorefrontDomainResult | null> {
  const res = await fetch(
    `${VERCEL_API}/v9/projects/${cfg.projectId}${teamQuery(cfg.teamId)}`,
    { headers: { Authorization: `Bearer ${cfg.token}` } },
  );
  if (res.ok) return null;
  const body = await parseJson(res);
  const code = extractVercelCode(body);
  if (res.status === 404 || code === 'not_found') {
    return storefrontFailure(
      slug,
      'project_not_found',
      'Souqna could not find the configured Vercel project for the primary domain.',
    );
  }
  if (res.status === 401 || res.status === 403 || code === 'forbidden') {
    return storefrontFailure(
      slug,
      'forbidden',
      'Souqna cannot access the configured Vercel project for the primary domain.',
    );
  }
  return storefrontFailure(
    slug,
    'unknown',
    `Vercel project preflight failed (${res.status} ${code ?? 'unknown'}).`,
  );
}

/**
 * Register `{slug}.{root}` as a project domain on Vercel so a TLS cert
 * gets issued. Safe to call repeatedly — Vercel returns
 * `domain_already_in_use` / 409 for a hostname already attached to this
 * project, which we swallow. `domain_taken` is different: that means the
 * hostname is attached somewhere else, so callers should surface a backup URL.
 */
export async function ensureStorefrontDomain(
  slug: string,
): Promise<StorefrontDomainResult> {
  const urls = storefrontUrls(slug);
  const cfg = getVercelEnv();
  if (cfg === 'blank-token') {
    return storefrontFailure(
      slug,
      'unconfigured',
      'Vercel API token is blank, so Souqna could not attach the primary domain.',
    );
  }
  if (!cfg) {
    return { ok: true, status: 'skipped', ...urls };
  }

  const root = env.BRIEF_ROOT_DOMAIN;
  const hostname = `${slug}.${root}`;

  try {
    const preflight = await preflightProject(slug, cfg);
    if (preflight) return preflight;

    const res = await fetch(
      `${VERCEL_API}/v10/projects/${cfg.projectId}/domains${teamQuery(cfg.teamId)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: hostname }),
      },
    );

    if (res.ok) {
      return { ok: true, status: 'created', ...urls };
    }

    const body = await parseJson(res);
    const code = extractVercelCode(body);

    if (code === 'domain_taken') {
      return storefrontFailure(
        slug,
        'taken',
        'That primary subdomain is attached to another Vercel project.',
      );
    }

    // Already attached to this project — exactly the outcome we want.
    if (
      res.status === 409 ||
      code === 'domain_already_in_use' ||
      code === 'domain_already_exists'
    ) {
      return { ok: true, status: 'exists', ...urls };
    }

    if (res.status === 400 || code === 'invalid_domain') {
      return storefrontFailure(
        slug,
        'invalid',
        'Vercel rejected the generated primary hostname.',
      );
    }

    if (res.status === 401 || res.status === 403 || code === 'forbidden') {
      return storefrontFailure(
        slug,
        'forbidden',
        'Souqna cannot access the configured Vercel project for the primary domain.',
      );
    }

    if (res.status === 404 || code === 'not_found') {
      return storefrontFailure(
        slug,
        'project_not_found',
        'Souqna could not find the configured Vercel project for the primary domain.',
      );
    }

    return storefrontFailure(
      slug,
      'unknown',
      `Vercel domain add failed (${res.status} ${code ?? 'unknown'}).`,
    );
  } catch (err) {
    return storefrontFailure(
      slug,
      'unknown',
      err instanceof Error ? err.message : 'Network error contacting Vercel API.',
    );
  }
}

/**
 * Snapshot the cert state for a storefront's `{slug}.{root}` apex
 * subdomain. Mirror of `getCustomDomainStatus` but trimmed: we own
 * the wildcard CNAME so DNS verification is implicit — the only thing
 * we ever wait on is the Let's Encrypt cert.
 *
 * `attached` is false when the project doesn't yet have the hostname
 * (publish never ran, or the Vercel API call failed silently). Caller
 * should `ensureStorefrontDomain` and re-poll.
 */
export async function getStorefrontDomainStatus(
  slug: string,
): Promise<{ attached: boolean; hasCert: boolean; misconfigured: boolean }> {
  const cfg = getVercelEnv();
  const empty = { attached: false, hasCert: false, misconfigured: false };
  if (!cfg || cfg === 'blank-token') return empty;
  const root = env.BRIEF_ROOT_DOMAIN;
  const host = `${slug}.${root}`;
  try {
    const domainRes = await fetch(
      `${VERCEL_API}/v9/projects/${cfg.projectId}/domains/${encodeURIComponent(host)}${teamQuery(cfg.teamId)}`,
      { headers: { Authorization: `Bearer ${cfg.token}` } },
    );
    if (domainRes.status === 404) return empty;
    if (!domainRes.ok) return empty;

    const configRes = await fetch(
      `${VERCEL_API}/v6/domains/${encodeURIComponent(host)}/config${teamQuery(cfg.teamId)}`,
      { headers: { Authorization: `Bearer ${cfg.token}` } },
    );
    if (!configRes.ok) {
      return { attached: true, hasCert: false, misconfigured: false };
    }
    const cfgBody = (await configRes.json().catch(() => ({}))) as {
      misconfigured?: boolean;
      acceptedChallenges?: string[];
    };
    const misconfigured = Boolean(cfgBody.misconfigured);
    const hasCert = Array.isArray(cfgBody.acceptedChallenges)
      ? cfgBody.acceptedChallenges.length > 0
      : !misconfigured;
    return { attached: true, hasCert, misconfigured };
  } catch {
    return empty;
  }
}

/**
 * Custom-domain lifecycle on Vercel.
 *
 * Unlike `{slug}.souqna.qa` (which we own end-to-end), a custom hostname
 * lives on the founder's registrar. The flow is:
 *
 *   1. `addCustomDomain(host)` registers the hostname on the Vercel
 *      project. Vercel responds with the DNS records the founder has
 *      to publish (apex → A record at 76.76.21.21; subdomain → CNAME
 *      to cname.vercel-dns.com).
 *   2. The founder updates DNS at their registrar.
 *   3. `getCustomDomainStatus(host)` polls Vercel's domain config + cert
 *      endpoints. Once `misconfigured === false` AND the cert is issued
 *      we mark the row as verified and start serving traffic.
 *   4. `removeCustomDomain(host)` detaches the hostname (called when the
 *      founder removes it or downgrades below Pro).
 *
 * All endpoints are idempotent on the Vercel side; we swallow
 * already-attached / not-found errors so retries are safe.
 */

export interface CustomDomainDnsRecord {
  type: 'A' | 'CNAME';
  name: string;
  value: string;
}

export interface CustomDomainStatus {
  attached: boolean;
  verified: boolean;
  misconfigured: boolean;
  /** True when Vercel reports that an HTTPS cert has been issued. */
  hasCert: boolean;
  /** DNS records the founder must publish for verification to succeed. */
  recommendedDns: CustomDomainDnsRecord[];
  /** Pending nameserver / TXT challenges Vercel still expects. */
  pendingVerification: Array<{ type: string; domain: string; value: string }>;
}

function isApex(host: string): boolean {
  // host is 'a.b' → apex; 'a.b.c' → subdomain. Naïve but correct for the
  // ICANN gTLDs / ccTLDs founders attach (we don't try to handle
  // `co.uk`-style multi-segment TLDs — Vercel does the real check).
  return host.split('.').length === 2;
}

function recommendedRecordsFor(host: string): CustomDomainDnsRecord[] {
  if (isApex(host)) {
    return [{ type: 'A', name: '@', value: '76.76.21.21' }];
  }
  const sub = host.split('.')[0]!;
  return [{ type: 'CNAME', name: sub, value: 'cname.vercel-dns.com' }];
}

/**
 * Attach a founder-owned hostname to the Vercel project. Returns the
 * recommended DNS records on success so the dashboard can render the
 * setup checklist immediately. `domain_already_in_use` on the same
 * project is treated as success.
 */
export async function addCustomDomain(
  host: string,
): Promise<
  | { ok: true; status: 'created' | 'exists'; recommendedDns: CustomDomainDnsRecord[] }
  | { ok: false; code: 'unconfigured' | 'taken' | 'invalid' | 'unknown'; message: string }
> {
  const cfg = getVercelEnv();
  if (!cfg || cfg === 'blank-token') {
    return { ok: false, code: 'unconfigured', message: 'Vercel API token is not configured.' };
  }
  try {
    const res = await fetch(
      `${VERCEL_API}/v10/projects/${cfg.projectId}/domains${teamQuery(cfg.teamId)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: host }),
      },
    );

    if (res.ok) {
      return {
        ok: true,
        status: 'created',
        recommendedDns: recommendedRecordsFor(host),
      };
    }

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore parse errors
    }
    const code =
      body && typeof body === 'object' && 'error' in body
        ? (body as { error?: { code?: string } }).error?.code
        : undefined;

    if (
      res.status === 409 ||
      code === 'domain_already_in_use' ||
      code === 'domain_already_exists'
    ) {
      return {
        ok: true,
        status: 'exists',
        recommendedDns: recommendedRecordsFor(host),
      };
    }
    if (code === 'domain_taken' || code === 'forbidden') {
      return {
        ok: false,
        code: 'taken',
        message: 'That domain is attached to a different Vercel project.',
      };
    }
    if (code === 'invalid_domain' || res.status === 400) {
      return { ok: false, code: 'invalid', message: 'Vercel rejected that hostname.' };
    }
    return {
      ok: false,
      code: 'unknown',
      message: `Vercel domain add failed (${res.status} ${code ?? 'unknown'})`,
    };
  } catch (err) {
    return {
      ok: false,
      code: 'unknown',
      message: err instanceof Error ? err.message : 'Network error contacting Vercel API.',
    };
  }
}

/**
 * Detach a hostname from the Vercel project. 404 is treated as success
 * (nothing to remove). Safe to call on every detach / plan downgrade.
 */
export async function removeCustomDomain(
  host: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const cfg = getVercelEnv();
  if (!cfg || cfg === 'blank-token') return { ok: true };
  try {
    const res = await fetch(
      `${VERCEL_API}/v9/projects/${cfg.projectId}/domains/${encodeURIComponent(host)}${teamQuery(cfg.teamId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${cfg.token}` },
      },
    );
    if (res.ok || res.status === 404) return { ok: true };
    return { ok: false, message: `Vercel domain delete failed (${res.status})` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Network error contacting Vercel API.',
    };
  }
}

/**
 * Snapshot a hostname's verification + cert state. Combines three Vercel
 * endpoints:
 *
 *   - GET /v9/projects/{id}/domains/{host}    → attached + pending verification
 *   - GET /v6/domains/{host}/config           → DNS misconfigured?
 *   - POST /v9/projects/{id}/domains/{host}/verify → kicks the cert issuance
 *
 * The verify call is best-effort and short-circuited if attach reports
 * `verified === true`. Missing creds or missing-on-Vercel returns the
 * default "not attached" snapshot rather than throwing.
 */
export async function getCustomDomainStatus(host: string): Promise<CustomDomainStatus> {
  const recommendedDns = recommendedRecordsFor(host);
  const empty: CustomDomainStatus = {
    attached: false,
    verified: false,
    misconfigured: false,
    hasCert: false,
    recommendedDns,
    pendingVerification: [],
  };

  const cfg = getVercelEnv();
  if (!cfg || cfg === 'blank-token') return empty;

  try {
    const domainRes = await fetch(
      `${VERCEL_API}/v9/projects/${cfg.projectId}/domains/${encodeURIComponent(host)}${teamQuery(cfg.teamId)}`,
      { headers: { Authorization: `Bearer ${cfg.token}` } },
    );

    if (domainRes.status === 404) return empty;
    if (!domainRes.ok) return empty;

    const domainBody = (await domainRes.json().catch(() => ({}))) as {
      verified?: boolean;
      verification?: Array<{ type: string; domain: string; value: string }>;
    };

    let verified = Boolean(domainBody.verified);
    const pendingVerification = Array.isArray(domainBody.verification)
      ? domainBody.verification
      : [];

    if (!verified) {
      // Try to nudge Vercel to recheck — surfaces newly-published TXT
      // records faster than waiting for the next background poll.
      try {
        const verifyRes = await fetch(
          `${VERCEL_API}/v9/projects/${cfg.projectId}/domains/${encodeURIComponent(host)}/verify${teamQuery(cfg.teamId)}`,
          { method: 'POST', headers: { Authorization: `Bearer ${cfg.token}` } },
        );
        if (verifyRes.ok) {
          const verifyBody = (await verifyRes.json().catch(() => ({}))) as {
            verified?: boolean;
          };
          if (verifyBody.verified) verified = true;
        }
      } catch {
        // ignore — we still return the snapshot we have
      }
    }

    let misconfigured = false;
    let hasCert = false;
    try {
      const configRes = await fetch(
        `${VERCEL_API}/v6/domains/${encodeURIComponent(host)}/config${teamQuery(cfg.teamId)}`,
        { headers: { Authorization: `Bearer ${cfg.token}` } },
      );
      if (configRes.ok) {
        const cfgBody = (await configRes.json().catch(() => ({}))) as {
          misconfigured?: boolean;
          acceptedChallenges?: string[];
        };
        misconfigured = Boolean(cfgBody.misconfigured);
        hasCert = Array.isArray(cfgBody.acceptedChallenges)
          ? cfgBody.acceptedChallenges.length > 0
          : !misconfigured && verified;
      }
    } catch {
      // ignore — config endpoint is advisory
    }

    return {
      attached: true,
      verified,
      misconfigured,
      hasCert,
      recommendedDns,
      pendingVerification,
    };
  } catch {
    return empty;
  }
}
