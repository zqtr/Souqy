// src/app/api/apps/souqnasource/cron/trust-refresh/route.ts
import { NextResponse } from 'next/server';
import {
  listAllSuppliersForRefresh,
  setSupplierTrust,
} from '@/lib/apps/souqnasource/suppliers';
import { scoreSuppliersTrust } from '@/lib/apps/souqnasource/ai/trust';

export const runtime = 'nodejs';
export const maxDuration = 280;

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request): Promise<Response> {
  const expected = process.env.SOUQNASOURCE_SYNC_CRON_SECRET;
  const got =
    req.headers.get('x-cron-secret') ??
    (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!expected || !timingSafeEq(got, expected)) {
    return new NextResponse('unauthorized', { status: 401 });
  }

  // Refresh trust scores for the 200 stalest suppliers per monthly pass.
  const suppliers = await listAllSuppliersForRefresh(200);
  if (suppliers.length === 0) {
    return NextResponse.json({ ok: true, refreshed: 0 });
  }

  const scores = await scoreSuppliersTrust(
    suppliers.map((s) => ({
      id: s.id,
      displayName: s.displayName,
      area: s.area,
      hasCR: Boolean(s.crNumber),
      verified: s.verified,
      hasWhatsapp: Boolean(s.whatsapp),
      listingCount: 0,
      categorySpan: 0,
      sampleTitles: [],
      firstSeenDaysAgo: Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(s.firstSeenAt).getTime()) /
            (24 * 3600 * 1000),
        ),
      ),
    })),
  );

  for (const sc of scores) {
    await setSupplierTrust(sc.id, sc.trustScore, sc.reason);
  }

  return NextResponse.json({ ok: true, refreshed: scores.length });
}

export const GET = POST;
