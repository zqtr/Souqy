import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { upsertSupplier } from '@/lib/apps/souqnasource/suppliers';
import { upsertListing } from '@/lib/apps/souqnasource/listings';
import { logQuoteRequest, listQuoteRequestsForStore } from '@/lib/apps/souqnasource/quotes';

const sid = `q-test-supplier-${Date.now()}`;
const lid = `q-test-listing-${Date.now()}`;
const slug = process.env.TEST_STOREFRONT_SLUG ?? `test-store-quotes-${Date.now()}`;

beforeAll(async () => {
  // Ensure the briefs (storefront) row exists — required by FK on storefront_slug.
  await db()`
    insert into briefs
      (slug, locale, founder_name, business_name, contact_email, ownership,
       experience, business_type, market_volume, payments, clerk_user_id)
    values
      (${slug}, 'en', 'Test Founder', 'Test Store', 'test@example.com', 'sole',
       '0-1', 'perfume_oud', 'small', 'cash', 'test-clerk-user')
    on conflict (slug) do nothing
  `;
  await upsertSupplier({
    id: sid, displayName: 'Q', crNumber: null, whatsapp: '+97455555555',
    area: 'najma', sourceNetwork: 'qatarliving', sourceProfileUrl: null,
  });
  await upsertListing({
    id: lid, supplierId: sid, network: 'qatarliving',
    sourceListingUrl: 'https://qatarliving.com/x', title: 'Oud',
    description: null, imageUrl: null, category: 'perfume-oud',
    subcategory: null, listingType: 'contact', price: null, currency: null,
    moq: null, raw: {},
  });
});

afterAll(async () => {
  await db()`delete from souqnasource_quote_requests where listing_id = ${lid}`;
  await db()`delete from souqnasource_listings where id = ${lid}`;
  await db()`delete from souqnasource_suppliers where id = ${sid}`;
  // Only delete the brief if we created it (i.e. not a pre-existing slug from env).
  if (!process.env.TEST_STOREFRONT_SLUG) {
    await db()`delete from briefs where slug = ${slug}`;
  }
});

describe('quote requests DAO', () => {
  it('logs and lists', async () => {
    await logQuoteRequest({
      storefrontSlug: slug,
      listingId: lid,
      supplierId: sid,
      prefilledMessage: 'hi',
    });
    const list = await listQuoteRequestsForStore(slug, 50);
    expect(list.find((q) => q.listingId === lid)).toBeTruthy();
  });
});
