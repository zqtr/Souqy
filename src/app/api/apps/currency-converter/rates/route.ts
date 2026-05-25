import { NextResponse } from 'next/server';
import {
  getRatesForStore,
  getCurrencyConverterSettings,
} from '@/lib/apps/currency-converter';
import { getInstalledApp } from '@/lib/apps/installed';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * Public endpoint the storefront client polls to get the live FX
 * snapshot. Gated by:
 *   - app must be installed on the requested storefront
 *   - rate-limited per IP at 60 req/min (snapshot doesn't change
 *     more than once an hour anyway)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const storefrontSlug = url.searchParams.get('store')?.trim();
  if (!storefrontSlug) {
    return NextResponse.json({ ok: false, error: 'store param required' }, { status: 400 });
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
  const rl = rateLimit(`currency:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate limited' },
      { status: 429, headers: { 'retry-after': String(Math.ceil(rl.resetMs / 1000)) } },
    );
  }

  const app = await getInstalledApp(storefrontSlug, 'currency-converter');
  if (!app || !app.enabled) {
    return NextResponse.json(
      { ok: false, error: 'currency converter is not installed on this storefront' },
      { status: 404 },
    );
  }

  const [snap, settings] = await Promise.all([
    getRatesForStore(storefrontSlug),
    getCurrencyConverterSettings(storefrontSlug),
  ]);
  if (!snap) {
    return NextResponse.json(
      { ok: false, error: 'rates unavailable', settings },
      { status: 503 },
    );
  }
  return NextResponse.json(
    {
      ok: true,
      base: snap.base,
      rates: snap.rates,
      fetchedAt: snap.fetchedAt,
      settings,
    },
    {
      headers: {
        'cache-control': 'public, s-maxage=60, stale-while-revalidate=86400',
      },
    },
  );
}
