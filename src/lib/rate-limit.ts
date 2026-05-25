import { LRUCache } from 'lru-cache';

/**
 * Simple in-memory token bucket keyed by IP. Production would use a
 * shared store (Upstash, etc.); for the volume this contact form sees
 * an LRU on each function instance is sufficient and keeps the runtime
 * cold-start free.
 */
type Bucket = { count: number; reset: number };

const cache = new LRUCache<string, Bucket>({
  max: 5000,
  ttl: 1000 * 60 * 60,
});

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetMs: number;
};

export function rateLimit(
  key: string,
  limit = 5,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  const existing = cache.get(key);
  if (!existing || existing.reset < now) {
    const fresh: Bucket = { count: 1, reset: now + windowMs };
    cache.set(key, fresh);
    return { ok: true, remaining: limit - 1, resetMs: windowMs };
  }
  existing.count += 1;
  cache.set(key, existing);
  return {
    ok: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetMs: Math.max(0, existing.reset - now),
  };
}
