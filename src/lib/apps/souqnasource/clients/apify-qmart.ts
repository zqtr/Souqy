// src/lib/apps/souqnasource/clients/apify-qmart.ts
import type { SupplierClient, CrawlResult, RawListing } from './types';
import { runActor, normalizeWhatsapp } from './apify-base';

const ACTOR_ID = process.env.APIFY_QMART_ACTOR_ID ?? 'souqna/qmart-scraper';
const PAGE_SIZE = 100;

type ActorItem = {
  productId: string;
  productUrl: string;
  name: string;
  desc: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string;
  moqUnits: number | null;
  vendor: {
    id: string;
    name: string;
    whatsapp: string | null;
    area: string | null;
    storeUrl: string;
  };
  taxonomyLabel: string | null;
};

function mapItems(items: ActorItem[]): CrawlResult {
  const suppliers = new Map<string, NonNullable<CrawlResult['suppliers']>[number]>();
  const listings: RawListing[] = [];
  for (const it of items) {
    if (!suppliers.has(it.vendor.id)) {
      suppliers.set(it.vendor.id, {
        network: 'qmart',
        sourceSupplierId: it.vendor.id,
        displayName: it.vendor.name,
        whatsapp: normalizeWhatsapp(it.vendor.whatsapp),
        area: it.vendor.area,
        sourceProfileUrl: it.vendor.storeUrl,
      });
    }
    listings.push({
      network: 'qmart',
      sourceListingId: it.productId,
      sourceListingUrl: it.productUrl,
      sourceSupplierId: it.vendor.id,
      title: it.name,
      description: it.desc,
      imageUrl: it.imageUrl,
      rawCategory: it.taxonomyLabel,
      price: typeof it.price === 'number' && it.price > 0 ? it.price : null,
      currency: it.currency,
      moq: it.moqUnits,
      raw: it as unknown as Record<string, unknown>,
    });
  }
  return {
    suppliers: Array.from(suppliers.values()),
    listings,
    nextCursor:
      items.length < PAGE_SIZE ? null : items[items.length - 1]?.productId ?? null,
  };
}

export const qmartClient: SupplierClient = {
  network: 'qmart',
  async crawl({ sinceCursor }) {
    const items = await runActor<ActorItem>({
      actorId: ACTOR_ID,
      input: { sinceProductId: sinceCursor, maxItems: PAGE_SIZE },
    });
    return mapItems(items);
  },
  async refreshListing(id) {
    const items = await runActor<ActorItem>({
      actorId: ACTOR_ID,
      input: { productIds: [id] },
    });
    if (items.length === 0) return null;
    return mapItems(items).listings[0] ?? null;
  },
};
