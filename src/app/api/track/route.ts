import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordEvent } from '@/lib/analytics';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const Schema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  kind: z.string().trim().min(1).max(40),
  visitorId: z.string().trim().min(1).max(64).optional().nullable(),
  sessionId: z.string().trim().min(1).max(64).optional().nullable(),
  productId: z.string().trim().min(1).max(128).optional().nullable(),
  referrerHost: z.string().trim().max(255).optional().nullable(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 });
  }

  // Per-IP soft rate limit (60 events / minute) so a single misbehaving
  // visitor can't flood `analytics_events`. Legitimate sessions never
  // hit this — 60 page views in a minute would be a navigation loop.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  if (!rateLimit(`track:${ip}`, 60, 60_000).ok) {
    return NextResponse.json({ ok: true, throttled: true }, { status: 200 });
  }

  try {
    await recordEvent({
      storefrontSlug: parsed.data.storefrontSlug,
      kind: parsed.data.kind,
      visitorId: parsed.data.visitorId ?? null,
      sessionId: parsed.data.sessionId ?? null,
      productId: parsed.data.productId ?? null,
      referrerHost: parsed.data.referrerHost ?? null,
      meta: {
        ...(parsed.data.meta ?? {}),
        country: request.headers.get('x-vercel-ip-country') ?? undefined,
        region: request.headers.get('x-vercel-ip-country-region') ?? undefined,
        city: request.headers.get('x-vercel-ip-city') ?? undefined,
      },
    });
  } catch (err) {
    console.error('[/api/track] insert failed', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
