// src/lib/apps/souqnasource/clients/apify-qatarliving.ts
import type { SupplierClient, CrawlResult, RawListing } from './types';
import { runActor, normalizeWhatsapp, listingId } from './apify-base';

const ACTOR_ID =
  process.env.APIFY_QATARLIVING_ACTOR_ID ?? 'epctex/qatarliving-classifieds-scraper';
const PAGE_SIZE = 100;

type ActorItem = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  image: string | null;
  price: number | null;
  currency: string | null;
  moq?: number | null;
  category?: string | null;
  sellerId: string;
  sellerName: string;
  sellerWhatsapp: string | null;
  sellerArea: string | null;
  sellerProfileUrl: string;
};

function mapItems(items: ActorItem[]): CrawlResult {
  const suppliersById = new Map<string, NonNullable<CrawlResult['suppliers']>[number]>();
  const listings: RawListing[] = [];
  for (const it of items) {
    if (!suppliersById.has(it.sellerId)) {
      suppliersById.set(it.sellerId, {
        network: 'qatarliving',
        sourceSupplierId: it.sellerId,
        displayName: it.sellerName,
        whatsapp: normalizeWhatsapp(it.sellerWhatsapp),
        area: it.sellerArea ? it.sellerArea.toLowerCase() : null,
        sourceProfileUrl: it.sellerProfileUrl,
      });
    }
    listings.push({
      network: 'qatarliving',
      sourceListingId: it.id,
      sourceListingUrl: it.url,
      sourceSupplierId: it.sellerId,
      title: it.title,
      description: it.description,
      imageUrl: it.image,
      rawCategory: it.category ?? null,
      price: typeof it.price === 'number' && it.price > 0 ? it.price : null,
      currency: it.currency,
      moq: it.moq ?? null,
      raw: it as unknown as Record<string, unknown>,
    });
  }
  return {
    suppliers: Array.from(suppliersById.values()),
    listings,
    nextCursor: items.length < PAGE_SIZE ? null : items[items.length - 1]?.id ?? null,
  };
}

export const qatarlivingClient: SupplierClient = {
  network: 'qatarliving',
  async crawl({ sinceCursor }) {
    const items = await runActor<ActorItem>({
      actorId: ACTOR_ID,
      input: {
        startUrls: [
          { url: 'https://www.qatarliving.com/classifieds/business-industrial' },
        ],
        sinceListingId: sinceCursor,
        maxItems: PAGE_SIZE,
      },
    });
    return mapItems(items);
  },
  async refreshListing(sourceListingId) {
    const items = await runActor<ActorItem>({
      actorId: ACTOR_ID,
      input: { listingIds: [sourceListingId] },
    });
    if (items.length === 0) return null;
    const mapped = mapItems(items);
    return mapped.listings[0] ?? null;
  },
};

// listingId() is exported from apify-base; the indexer composes the canonical
// listings.id via listingId('qatarliving', sourceListingId).
export { listingId };
