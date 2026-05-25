import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { env } from './env';

let client: NeonQueryFunction<false, false> | null = null;

/**
 * Singleton Neon HTTP client. Throws if DATABASE_URL is not configured —
 * callers in actions/pages should surface a friendly fallback.
 *
 * `fetchOptions: { cache: 'no-store' }` is critical: Neon's serverless
 * driver issues every query as a `fetch()` POST. Next.js 14 patches the
 * global `fetch` and, by default, deduplicates identical request bodies
 * within a request (and caches across requests in some modes). Without
 * this opt-out the same SQL re-runs returning a stale, often truncated
 * result — most visibly: tail queries that should grow over time silently
 * stay frozen at whatever the first call observed.
 */
export function db(): NeonQueryFunction<false, false> {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }
  if (!client) {
    client = neon(env.DATABASE_URL, {
      fetchOptions: { cache: 'no-store' },
    });
  }
  return client;
}

export function hasDb(): boolean {
  return Boolean(env.DATABASE_URL);
}
