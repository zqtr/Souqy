import { unstable_noStore as noStore } from 'next/cache';
import { db } from '@/lib/db';
import type { Listing, Category, ListingType, SourceNetwork } from './types';

type Row = {
  id: string;
  supplier_id: string;
  network: SourceNetwork;
  source_listing_url: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: Category;
  subcategory: string | null;
  listing_type: ListingType;
  price: string | null;
  currency: string | null;
  moq: number | null;
  raw: Record<string, unknown>;
  first_seen_at: string;
  last_indexed_at: string;
  delisted_at: string | null;
};

function fromRow(r: Row): Listing {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    network: r.network,
    sourceListingUrl: r.source_listing_url,
    title: r.title,
    description: r.description,
    imageUrl: r.image_url,
    category: r.category,
    subcategory: r.subcategory,
    listingType: r.listing_type,
    price: r.price === null ? null : Number(r.price),
    currency: r.currency,
    moq: r.moq,
    raw: r.raw,
    firstSeenAt: r.first_seen_at,
    lastIndexedAt: r.last_indexed_at,
    delistedAt: r.delisted_at,
  };
}

export type UpsertListing = Omit<
  Listing,
  'firstSeenAt' | 'lastIndexedAt' | 'delistedAt'
>;

export async function upsertListing(l: UpsertListing): Promise<void> {
  await db()`
    insert into souqnasource_listings
      (id, supplier_id, network, source_listing_url, title, description, image_url,
       category, subcategory, listing_type, price, currency, moq, raw,
       last_indexed_at, delisted_at)
    values
      (${l.id}, ${l.supplierId}, ${l.network}, ${l.sourceListingUrl}, ${l.title},
       ${l.description}, ${l.imageUrl}, ${l.category}, ${l.subcategory}, ${l.listingType},
       ${l.price}, ${l.currency}, ${l.moq}, ${JSON.stringify(l.raw)}::jsonb,
       now(), null)
    on conflict (id) do update set
      supplier_id = excluded.supplier_id,
      title = excluded.title,
      description = excluded.description,
      image_url = excluded.image_url,
      category = excluded.category,
      subcategory = excluded.subcategory,
      listing_type = excluded.listing_type,
      price = excluded.price,
      currency = excluded.currency,
      moq = excluded.moq,
      raw = excluded.raw,
      last_indexed_at = now(),
      delisted_at = null
  `;
}

export async function getListingById(id: string): Promise<Listing | null> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_listings where id = ${id} limit 1
  `) as unknown as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function listListingsByCategory(
  category: Category,
  listingType: ListingType | null,
  limit: number,
): Promise<Listing[]> {
  noStore();
  const rows = (await (listingType
    ? db()`
        select * from souqnasource_listings
        where category = ${category}
          and listing_type = ${listingType}
          and delisted_at is null
        order by last_indexed_at desc
        limit ${limit}
      `
    : db()`
        select * from souqnasource_listings
        where category = ${category} and delisted_at is null
        order by last_indexed_at desc
        limit ${limit}
      `)) as unknown as Row[];
  return rows.map(fromRow);
}

/**
 * Mark listings as delisted after 3 consecutive missed indexer runs.
 * Caller passes the set of source_listing_ids that WERE seen this pass.
 * We track miss streak in raw.missedStreak.
 */
export async function markVanishedAsDelisted(
  network: SourceNetwork,
  seenIds: Set<string>,
): Promise<number> {
  const rows = (await db()`
    select id, raw from souqnasource_listings
    where network = ${network} and delisted_at is null
  `) as unknown as { id: string; raw: Record<string, unknown> }[];

  let delisted = 0;
  for (const row of rows) {
    if (seenIds.has(row.id)) {
      // Reset streak. Upsert will overwrite raw, so this branch only runs
      // when the indexer failed to upsert that id (e.g. partial network result).
      const newRaw = { ...row.raw, missedStreak: 0 };
      await db()`
        update souqnasource_listings
        set raw = ${JSON.stringify(newRaw)}::jsonb, last_indexed_at = now()
        where id = ${row.id}
      `;
      continue;
    }
    const streak = (row.raw.missedStreak as number | undefined) ?? 0;
    const next = streak + 1;
    if (next >= 3) {
      await db()`
        update souqnasource_listings
        set delisted_at = now(), raw = ${JSON.stringify({
          ...row.raw,
          missedStreak: next,
        })}::jsonb
        where id = ${row.id}
      `;
      delisted++;
    } else {
      await db()`
        update souqnasource_listings
        set raw = ${JSON.stringify({
          ...row.raw,
          missedStreak: next,
        })}::jsonb
        where id = ${row.id}
      `;
    }
  }
  return delisted;
}
