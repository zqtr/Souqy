import { NextResponse } from 'next/server';
import { z } from 'zod';
import { quoteRate } from '@/lib/apps/aramex';
import { getInstalledApp } from '@/lib/apps/installed';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * Public live-rate endpoint used by the storefront `<AramexRatesWidget>`
 * (and by the dashboard's order detail panel when the founder hasn't
 * picked a service yet). The route never returns the founder's
 * Aramex credentials — it just proxies a single rate quote.
 *
 * Rate-limited per (storefront, IP) so a malicious visitor can't
 * burn through the founder's Aramex allowance.
 */

const Schema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  country: z.string().trim().length(2),
  city: z.string().trim().min(1).max(80),
  postCode: z.string().trim().max(40).optional(),
  weightKg: z.number().positive().max(1000).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = Schema.safeParse({
    storefrontSlug: url.searchParams.get('store') ?? '',
    country: url.searchParams.get('country') ?? '',
    city: url.searchParams.get('city') ?? '',
    postCode: url.searchParams.get('postCode') ?? undefined,
    weightKg: url.searchParams.get('weight')
      ? Number(url.searchParams.get('weight'))
      : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid request' }, { status: 400 });
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
  const rl = rateLimit(`aramex-rate:${parsed.data.storefrontSlug}:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: 'rate limited' }, { status: 429 });
  }

  const installed = await getInstalledApp(parsed.data.storefrontSlug, 'aramex');
  if (!installed || !installed.enabled) {
    return NextResponse.json(
      { ok: false, error: 'Aramex is not installed for this storefront' },
      { status: 404 },
    );
  }

  try {
    const quote = await quoteRate(parsed.data.storefrontSlug, {
      destinationCountryCode: parsed.data.country,
      destinationCity: parsed.data.city,
      ...(parsed.data.postCode !== undefined ? { destinationPostCode: parsed.data.postCode } : {}),
      ...(parsed.data.weightKg !== undefined ? { weightKg: parsed.data.weightKg } : {}),
    });
    if (!quote) {
      return NextResponse.json(
        { ok: false, error: 'No quote available for that destination' },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        ok: true,
        amount: quote.amount,
        currency: quote.currency,
        productType: quote.productType,
      },
      // Quotes are short-lived; let the browser cache for one minute so
      // a country/city change doesn't re-hit Aramex on every keystroke.
      { headers: { 'cache-control': 'public, max-age=60' } },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'rate quote failed',
      },
      { status: 502 },
    );
  }
}
