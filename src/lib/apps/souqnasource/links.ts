import { unstable_noStore as noStore } from 'next/cache';
import { db } from '@/lib/db';

export type SouqnasourceLink = {
  productId: string;
  storefrontSlug: string;
  listingId: string | null;
  supplierId: string | null;
  supplierCost: number;
  supplierCurrency: string;
  lastSyncedAt: string;
  lastSeenPrice: number | null;
  priceDriftPct: number | null;
};

type Row = {
  product_id: string;
  storefront_slug: string;
  listing_id: string | null;
  supplier_id: string | null;
  supplier_cost: string;
  supplier_currency: string;
  last_synced_at: string;
  last_seen_price: string | null;
  price_drift_pct: string | null;
};

function fromRow(r: Row): SouqnasourceLink {
  return {
    productId: r.product_id,
    storefrontSlug: r.storefront_slug,
    listingId: r.listing_id,
    supplierId: r.supplier_id,
    supplierCost: Number(r.supplier_cost),
    supplierCurrency: r.supplier_currency,
    lastSyncedAt: r.last_synced_at,
    lastSeenPrice: r.last_seen_price === null ? null : Number(r.last_seen_price),
    priceDriftPct: r.price_drift_pct === null ? null : Number(r.price_drift_pct),
  };
}

export async function insertLink(l: Omit<SouqnasourceLink, 'lastSyncedAt' | 'lastSeenPrice' | 'priceDriftPct'>): Promise<void> {
  await db()`
    insert into souqnasource_links
      (product_id, storefront_slug, listing_id, supplier_id, supplier_cost, supplier_currency, last_seen_price)
    values
      (${l.productId}, ${l.storefrontSlug}, ${l.listingId}, ${l.supplierId}, ${l.supplierCost}, ${l.supplierCurrency}, ${l.supplierCost})
  `;
}

export async function getLinkByListingForStore(
  slug: string,
  listingId: string,
): Promise<SouqnasourceLink | null> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_links
    where storefront_slug = ${slug} and listing_id = ${listingId}
    limit 1
  `) as unknown as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function listLinksForStore(slug: string): Promise<SouqnasourceLink[]> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_links
    where storefront_slug = ${slug}
    order by last_synced_at desc
  `) as unknown as Row[];
  return rows.map(fromRow);
}

export async function listLinksForSync(limit: number): Promise<SouqnasourceLink[]> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_links
    order by last_synced_at asc
    limit ${limit}
  `) as unknown as Row[];
  return rows.map(fromRow);
}

export async function updateLinkSync(
  productId: string,
  patch: { lastSeenPrice: number | null; priceDriftPct: number | null },
): Promise<void> {
  await db()`
    update souqnasource_links
    set last_synced_at = now(),
        last_seen_price = ${patch.lastSeenPrice},
        price_drift_pct = ${patch.priceDriftPct}
    where product_id = ${productId}
  `;
}
