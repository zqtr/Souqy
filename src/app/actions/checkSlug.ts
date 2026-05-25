'use server';

import { headers } from 'next/headers';
import { rateLimit } from '@/lib/rate-limit';
import { isReserved, isTaken, nextAvailable, slugify } from '@/lib/slug';

export type SlugAvailability =
  | { status: 'available'; slug: string }
  | { status: 'taken'; slug: string; suggestion: string }
  | { status: 'reserved'; slug: string }
  | { status: 'invalid'; slug: string }
  | { status: 'rate_limited' }
  | { status: 'loading'; slug: string };

/**
 * Lightweight availability check used by the live tracker on /begin.
 * Heavily rate-limited because typing into the business-name field
 * fires this on every keystroke (debounced client-side, but still).
 *
 * Anonymous — does not require auth so visitors can sanity-check a name
 * before committing to sign-in.
 */
export async function checkSlugAvailability(input: string): Promise<SlugAvailability> {
  const slug = slugify(input);
  if (!slug || slug.length < 3) return { status: 'invalid', slug };

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? 'unknown';
  if (!rateLimit(`slug:${ip}`, 60, 60_000).ok) {
    return { status: 'rate_limited' };
  }

  if (isReserved(slug)) return { status: 'reserved', slug };

  try {
    if (!(await isTaken(slug))) return { status: 'available', slug };
    const suggestion = await nextAvailable(slug);
    return { status: 'taken', slug, suggestion };
  } catch (err) {
    console.error('[checkSlugAvailability] failed', err);
    return { status: 'invalid', slug };
  }
}
