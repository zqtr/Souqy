import { NextResponse } from 'next/server';

/**
 * Server time endpoint for the Mawid countdown.
 *
 * The storefront-side countdown ticks from the visitor's local clock
 * (cheap, accurate enough for most cases) but a visitor with a wildly
 * skewed device clock can ping `/api/apps/mawid/now` once on mount to
 * compute a one-time offset and re-anchor the countdown. The endpoint
 * is intentionally tiny and cache-disabled so it always reflects the
 * server's wall clock.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET() {
  return NextResponse.json(
    { now: Date.now() },
    {
      headers: {
        'cache-control': 'no-store, max-age=0',
      },
    },
  );
}
