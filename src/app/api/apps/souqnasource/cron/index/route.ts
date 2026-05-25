// src/app/api/apps/souqnasource/cron/index/route.ts
import { NextResponse } from 'next/server';
import { CLIENTS, ALL_NETWORKS } from '@/lib/apps/souqnasource/clients';
import {
  upsertSupplier,
  listSuppliersNeedingTrust,
  setSupplierTrust,
} from '@/lib/apps/souqnasource/suppliers';
import {
  upsertListing,
  markVanishedAsDelisted,
} from '@/lib/apps/souqnasource/listings';
import {
  ruleBasedCategory,
  classifyListingType,
} from '@/lib/apps/souqnasource/classifier';
import { llmCategory } from '@/lib/apps/souqnasource/ai/classifier';
import { scoreSuppliersTrust } from '@/lib/apps/souqnasource/ai/trust';
import { listingId } from '@/lib/apps/souqnasource/clients/apify-base';

export const runtime = 'nodejs';
export const maxDuration = 280;

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request): Promise<Response> {
  const expected = process.env.SOUQNASOURCE_INDEX_CRON_SECRET;
  const got =
    req.headers.get('x-cron-secret') ??
    (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!expected || !timingSafeEq(got, expected)) {
    return new NextResponse('unauthorized', { status: 401 });
  }

  const summary: Record<
    string,
    { suppliers: number; listings: number; delisted: number }
  > = {};

  for (const network of ALL_NETWORKS) {
    const client = CLIENTS[network];
    const seen = new Set<string>();
    try {
      const { suppliers, listings } = await client.crawl({ sinceCursor: null });
      for (const s of suppliers) {
        await upsertSupplier({
          id: `${network}:${s.sourceSupplierId}`,
          displayName: s.displayName,
          crNumber: null,
          whatsapp: s.whatsapp,
          area: s.area,
          sourceNetwork: network,
          sourceProfileUrl: s.sourceProfileUrl,
        });
      }
      for (const l of listings) {
        const id = listingId(network, l.sourceListingId);
        seen.add(id);
        const ruleHit = ruleBasedCategory(l.title, l.rawCategory);
        const cat =
          ruleHit ??
          (await llmCategory({
            title: l.title,
            rawCategory: l.rawCategory,
            description: l.description,
          }));
        await upsertListing({
          id,
          supplierId: `${network}:${l.sourceSupplierId}`,
          network,
          sourceListingUrl: l.sourceListingUrl,
          title: l.title,
          description: l.description,
          imageUrl: l.imageUrl,
          category: cat.category,
          subcategory: cat.subcategory,
          listingType: classifyListingType(l.price),
          price: l.price,
          currency: l.currency,
          moq: l.moq,
          raw: l.raw,
        });
      }
      const delisted = await markVanishedAsDelisted(network, seen);
      summary[network] = {
        suppliers: suppliers.length,
        listings: listings.length,
        delisted,
      };
    } catch {
      summary[network] = { suppliers: 0, listings: 0, delisted: 0 };
      // Sentry tagging + structured log goes here in production, kept terse for v1.
    }
  }

  // Trust scoring batch (max 50 suppliers per indexer pass)
  const needTrust = await listSuppliersNeedingTrust(50);
  if (needTrust.length > 0) {
    const scores = await scoreSuppliersTrust(
      needTrust.map((s) => ({
        id: s.id,
        displayName: s.displayName,
        area: s.area,
        hasCR: Boolean(s.crNumber),
        verified: s.verified,
        hasWhatsapp: Boolean(s.whatsapp),
        listingCount: 0, // will be enriched in PR 2; v1 indexer passes 0
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
  }

  return NextResponse.json({ ok: true, summary });
}

export const GET = POST;
