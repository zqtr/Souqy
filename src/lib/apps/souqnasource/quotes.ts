import { unstable_noStore as noStore } from 'next/cache';
import { db } from '@/lib/db';

export type QuoteRequest = {
  id: number;
  storefrontSlug: string;
  listingId: string;
  supplierId: string;
  prefilledMessage: string;
  createdAt: string;
};

type Row = {
  id: number;
  storefront_slug: string;
  listing_id: string;
  supplier_id: string;
  prefilled_message: string;
  created_at: string;
};

function fromRow(r: Row): QuoteRequest {
  return {
    id: r.id,
    storefrontSlug: r.storefront_slug,
    listingId: r.listing_id,
    supplierId: r.supplier_id,
    prefilledMessage: r.prefilled_message,
    createdAt: r.created_at,
  };
}

export async function logQuoteRequest(input: {
  storefrontSlug: string;
  listingId: string;
  supplierId: string;
  prefilledMessage: string;
}): Promise<QuoteRequest> {
  const rows = (await db()`
    insert into souqnasource_quote_requests
      (storefront_slug, listing_id, supplier_id, prefilled_message)
    values
      (${input.storefrontSlug}, ${input.listingId}, ${input.supplierId}, ${input.prefilledMessage})
    returning *
  `) as unknown as Row[];
  return fromRow(rows[0]!);
}

export async function listQuoteRequestsForStore(
  slug: string,
  limit: number,
): Promise<QuoteRequest[]> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_quote_requests
    where storefront_slug = ${slug}
    order by created_at desc
    limit ${limit}
  `) as unknown as Row[];
  return rows.map(fromRow);
}

export async function getQuoteRequest(
  id: number,
  slug: string,
): Promise<QuoteRequest | null> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_quote_requests
    where id = ${id} and storefront_slug = ${slug}
    limit 1
  `) as unknown as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}
