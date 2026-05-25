import { NextResponse } from 'next/server';
import { z } from 'zod';
import { trackShipment } from '@/lib/apps/aramex';
import { getShipmentByAwb } from '@/lib/shipments';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * Public tracking poll. Visitors can hit
 * `/api/apps/aramex/track/<awb>?store=<slug>` from the storefront's
 * order page (or any future "Where's my shipment?" route) to get a
 * live status update without authenticating.
 *
 * Aramex's tracking endpoint is not free of side-effects on their
 * side (it counts against the account's API allowance), so we
 * rate-limit per AWB.
 */

const Schema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ awb: string }> },
) {
  const { awb } = await params;
  if (!/^[A-Za-z0-9-]{6,40}$/.test(awb)) {
    return NextResponse.json({ ok: false, error: 'invalid awb' }, { status: 400 });
  }
  const url = new URL(request.url);
  const parsed = Schema.safeParse({
    storefrontSlug: url.searchParams.get('store') ?? '',
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid request' }, { status: 400 });
  }

  // The shipment row is the source of truth for storefront ↔ AWB
  // ownership. Without it, anyone could poll a stranger's tracking
  // number through someone else's storefront install.
  const existing = await getShipmentByAwb('aramex', awb);
  if (!existing || existing.storefrontSlug !== parsed.data.storefrontSlug) {
    return NextResponse.json(
      { ok: false, error: 'shipment not found for this storefront' },
      { status: 404 },
    );
  }

  const rl = rateLimit(`aramex-track:${awb}`, 6, 60_000);
  if (!rl.ok) {
    // Soft-fail — return the cached snapshot from the shipment row.
    return NextResponse.json({
      ok: true,
      awb,
      status: existing.status,
      events:
        (existing.raw as { lastTracking?: { events?: unknown[] } }).lastTracking
          ?.events ?? [],
      cached: true,
    });
  }

  try {
    const update = await trackShipment(parsed.data.storefrontSlug, awb);
    if (!update) {
      return NextResponse.json({
        ok: true,
        awb,
        status: existing.status,
        events: [],
        cached: true,
      });
    }
    return NextResponse.json({
      ok: true,
      awb,
      status: update.status,
      events: update.events,
      trackingUrl: existing.trackingUrl,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'tracking failed',
      },
      { status: 502 },
    );
  }
}
