import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

/**
 * Middleware-safe `host → slug` lookup for custom domains.
 *
 * `src/lib/brief.ts` is the canonical storefront module but it pulls in
 * `next/cache` (`unstable_noStore`) which throws when imported from the
 * Edge middleware runtime. This file is the minimal subset middleware
 * needs: a single SQL by `lower(custom_domain)`, fronted by an
 * in-instance TTL cache so the hot path costs zero round-trips.
 *
 * The cache lives on the per-region Vercel Function instance, so a
 * detach takes up to `CACHE_TTL_MS` to propagate worldwide. For an
 * action this user-rare (founder unhooks a domain) that's acceptable;
 * the upside is that the storefront subdomain rewrite — which runs on
 * every single storefront request — never adds a DB hop.
 */

const CACHE_TTL_MS = 60_000;

type CacheEntry = { slug: string | null; expiresAt: number };
const cache = new Map<string, CacheEntry>();

let client: NeonQueryFunction<false, false> | null = null;

function getClient(): NeonQueryFunction<false, false> | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!client) {
    client = neon(url, { fetchOptions: { cache: 'no-store' } });
  }
  return client;
}

function normalizeHost(host: string): string {
  return host.split(':')[0]!.trim().toLowerCase();
}

/**
 * Returns the storefront slug attached to `host`, or null when no
 * storefront has claimed it (or the cert hasn't been issued yet).
 *
 * We require `custom_domain_verified_at IS NOT NULL` so an unverified
 * attach can't intercept routing and serve a misconfigured page —
 * better to fall through to a 404 (or whatever default the host
 * serves) than render a stranger's storefront on a half-attached domain.
 */
export async function getSlugForCustomDomain(host: string): Promise<string | null> {
  const normalized = normalizeHost(host);
  if (!normalized || !normalized.includes('.')) return null;

  const cached = cache.get(normalized);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.slug;

  const sql = getClient();
  if (!sql) return null;

  try {
    const rows = (await sql`
      select slug from briefs
      where lower(custom_domain) = ${normalized}
        and custom_domain_verified_at is not null
        and expires_at > now()
      limit 1
    `) as unknown as { slug: string }[];
    const slug = rows[0]?.slug ?? null;
    cache.set(normalized, { slug, expiresAt: now + CACHE_TTL_MS });
    return slug;
  } catch {
    // Don't poison the cache on transient errors; let the next request
    // try again. Returning null means middleware falls through to its
    // normal handling (404 or apex render) which is the safe default.
    return null;
  }
}

/** Drop a host (or all hosts) from the per-instance cache after an
 * attach / detach / verify. Best-effort across regions. */
export function invalidateCustomDomainCache(host?: string): void {
  if (!host) {
    cache.clear();
    return;
  }
  cache.delete(normalizeHost(host));
}
