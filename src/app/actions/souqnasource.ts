'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { getStorefront } from '@/lib/brief';
import { listListingsByCategory, getListingById } from '@/lib/apps/souqnasource/listings';
import { getSupplierById } from '@/lib/apps/souqnasource/suppliers';
import { addToCatalog as runAddToCatalog, type ImportOverrides } from '@/lib/apps/souqnasource/import';
import { buildQuoteRequestUrl } from '@/lib/apps/souqnasource/whatsapp';
import { logQuoteRequest, getQuoteRequest } from '@/lib/apps/souqnasource/quotes';
import { getSettings, saveSettings, type SouqnasourceSettings } from '@/lib/apps/souqnasource/settings';
import type { Category, ListingType } from '@/lib/apps/souqnasource/types';

async function assertStorefrontOwner(slug: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error('unauthorized');
  const sf = await getStorefront(slug);
  if (!sf) throw new Error('storefront_not_found');
  if (sf.clerkUserId !== userId) throw new Error('forbidden');
}

export async function browseListings(input: {
  slug: string;
  category: Category;
  type: ListingType | null;
  limit: number;
}) {
  await assertStorefrontOwner(input.slug);
  const items = await listListingsByCategory(
    input.category,
    input.type,
    Math.min(input.limit, 200),
  );
  return items;
}

export async function getSupplierForBrowse(input: {
  slug: string;
  supplierId: string;
}) {
  await assertStorefrontOwner(input.slug);
  return getSupplierById(input.supplierId);
}

export async function addToCatalog(input: {
  slug: string;
  listingId: string;
  overrides: ImportOverrides;
}) {
  await assertStorefrontOwner(input.slug);
  return runAddToCatalog({
    storefrontSlug: input.slug,
    listingId: input.listingId,
    overrides: input.overrides,
  });
}

export async function requestQuote(input: { slug: string; listingId: string }) {
  await assertStorefrontOwner(input.slug);
  const listing = await getListingById(input.listingId);
  if (!listing || listing.listingType !== 'contact' || listing.delistedAt !== null) {
    throw new Error('listing_unavailable');
  }
  const supplier = await getSupplierById(listing.supplierId);
  if (!supplier?.whatsapp) throw new Error('supplier_no_whatsapp');
  const sf = await getStorefront(input.slug);
  if (!sf) throw new Error('storefront_not_found');
  const { url, prefilledMessage } = buildQuoteRequestUrl({
    listing,
    supplier: { id: supplier.id, whatsapp: supplier.whatsapp },
    storefront: { name: sf.businessName, locale: sf.locale },
  });
  await logQuoteRequest({
    storefrontSlug: input.slug,
    listingId: listing.id,
    supplierId: supplier.id,
    prefilledMessage,
  });
  return { url };
}

export async function importFromQuote(input: {
  slug: string;
  quoteRequestId: number;
  manualPrice: number;
  manualCurrency: string;
  overrides: ImportOverrides;
}) {
  await assertStorefrontOwner(input.slug);
  const q = await getQuoteRequest(input.quoteRequestId, input.slug);
  if (!q) throw new Error('quote_not_found');
  const listing = await getListingById(q.listingId);
  if (!listing || listing.delistedAt !== null) throw new Error('listing_unavailable');

  await db()`
    update souqnasource_listings
    set listing_type = 'priced', price = ${input.manualPrice}, currency = ${input.manualCurrency}
    where id = ${listing.id}
  `;
  return runAddToCatalog({
    storefrontSlug: input.slug,
    listingId: listing.id,
    overrides: input.overrides,
  });
}

export async function getSouqnasourceSettings(slug: string): Promise<SouqnasourceSettings> {
  await assertStorefrontOwner(slug);
  return getSettings(slug);
}

export async function saveSouqnasourceSettings(
  slug: string,
  patch: Partial<SouqnasourceSettings>,
): Promise<SouqnasourceSettings> {
  await assertStorefrontOwner(slug);
  return saveSettings(slug, patch);
}
