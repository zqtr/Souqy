// src/lib/apps/souqnasource/clients/apify-marhaba.ts
import type { SupplierClient, CrawlResult, RawListing } from './types';
import { runActor, normalizeWhatsapp } from './apify-base';

const ACTOR_ID = process.env.APIFY_MARHABA_ACTOR_ID ?? 'souqna/marhaba-scraper';
const PAGE_SIZE = 100;

type ActorItem = {
  listingId: string;
  url: string;
  title: string;
  body: string | null;
  thumbnail: string | null;
  priceQar: number | null;
  seller: {
    id: string;
    name: string;
    whatsapp: string | null;
    location: string | null;
    profileUrl: string;
  };
};

function mapItems(items: ActorItem[]): CrawlResult {
  const suppliers = new Map<string, NonNullable<CrawlResult['suppliers']>[number]>();
  const listings: RawListing[] = [];
  for (const it of items) {
    if (!suppliers.has(it.seller.id)) {
      suppliers.set(it.seller.id, {
        network: 'marhaba',
        sourceSupplierId: it.seller.id,
        displayName: it.seller.name,
        whatsapp: normalizeWhatsapp(it.seller.whatsapp),
        area: it.seller.location,
        sourceProfileUrl: it.seller.profileUrl,
      });
    }
    listings.push({
      network: 'marhaba',
      sourceListingId: it.listingId,
      sourceListingUrl: it.url,
      sourceSupplierId: it.seller.id,
      title: it.title,
      description: it.body,
      imageUrl: it.thumbnail,
      rawCategory: null,
      price: typeof it.priceQar === 'number' && it.priceQar > 0 ? it.priceQar : null,
      currency: typeof it.priceQar === 'number' ? 'QAR' : null,
      moq: null,
      raw: it as unknown as Record<string, unknown>,
    });
  }
  return {
    suppliers: Array.from(suppliers.values()),
    listings,
    nextCursor:
      items.length < PAGE_SIZE ? null : items[items.length - 1]?.listingId ?? null,
  };
}

export const marhabaClient: SupplierClient = {
  network: 'marhaba',
  async crawl({ sinceCursor }) {
    const items = await runActor<ActorItem>({
      actorId: ACTOR_ID,
      input: {
        startUrls: [{ url: 'https://www.marhaba.qa/category/business' }],
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
    return mapItems(items).listings[0] ?? null;
  },
};
