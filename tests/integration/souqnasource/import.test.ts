import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/lib/db';
import { upsertSupplier } from '@/lib/apps/souqnasource/suppliers';
import { upsertListing } from '@/lib/apps/souqnasource/listings';

vi.mock('@/lib/apps/souqnasource/ai/copy', () => ({
  rewriteCopy: vi.fn().mockResolvedValue({
    title: { en: 'Oud 12ml', ar: 'عود ١٢ مل' },
    description: { en: 'Premium oud.', ar: 'عود فاخر.' },
  }),
}));
vi.mock('@/lib/apps/souqnasource/ai/margin', () => ({
  suggestMargin: vi.fn().mockResolvedValue({
    suggestedRetail: 199, currency: 'QAR', markupApplied: 2.34, rationale: 'oud',
  }),
}));
vi.mock('@/lib/apps/souqnasource/image', () => ({
  fetchAndStoreImage: vi.fn().mockResolvedValue('https://blob.example/x.jpg'),
}));

import { addToCatalog } from '@/lib/apps/souqnasource/import';

const slug = process.env.TEST_STOREFRONT_SLUG ?? `test-store-import-${Date.now()}`;
const seedBrief = !process.env.TEST_STOREFRONT_SLUG;
const sid = `imp-test-supplier-${Date.now()}`;
const lid = `imp-test-listing-${Date.now()}`;

beforeAll(async () => {
  if (seedBrief) {
    await db()`
      insert into briefs (slug, locale, founder_name, business_name, contact_email,
        ownership, experience, business_type, market_volume, payments, clerk_user_id)
      values (${slug}, 'en', 't', 't', 't@t', 't', 't', 't', 't', 't', 'user_test')
      on conflict (slug) do nothing
    `;
  }
  await upsertSupplier({
    id: sid, displayName: 'X', crNumber: null, whatsapp: '+97455555555',
    area: 'najma', sourceNetwork: 'qatarliving', sourceProfileUrl: null,
  });
  await upsertListing({
    id: lid, supplierId: sid, network: 'qatarliving',
    sourceListingUrl: 'https://qatarliving.com/x', title: 'Oud 12ml',
    description: null, imageUrl: 'https://qatarliving.com/i/x.jpg',
    category: 'perfume-oud', subcategory: null, listingType: 'priced',
    price: 85, currency: 'QAR', moq: null, raw: {},
  });
});

afterAll(async () => {
  await db()`
    delete from products where id in (
      select product_id from souqnasource_links where listing_id = ${lid}
    )
  `;
  await db()`delete from souqnasource_links where listing_id = ${lid}`;
  await db()`delete from souqnasource_listings where id = ${lid}`;
  await db()`delete from souqnasource_suppliers where id = ${sid}`;
  if (seedBrief) {
    await db()`delete from briefs where slug = ${slug}`;
  }
});

describe('addToCatalog', () => {
  it('creates draft product + link', async () => {
    const out = await addToCatalog({
      storefrontSlug: slug,
      listingId: lid,
      overrides: {},
    });
    expect(out.productId).toBeTruthy();
    const prod = (await db()`
      select status, source, price_qar from products where id = ${out.productId}::uuid
    `) as unknown as { status: string; source: string; price_qar: string }[];
    expect(prod[0]?.status).toBe('draft');
    expect(prod[0]?.source).toBe('souqnasource');
    expect(Number(prod[0]?.price_qar)).toBe(199);
  });

  it('throws on delisted listing', async () => {
    await db()`update souqnasource_listings set delisted_at = now() where id = ${lid}`;
    await expect(
      addToCatalog({ storefrontSlug: slug, listingId: lid, overrides: {} }),
    ).rejects.toThrow('listing_unavailable');
    await db()`update souqnasource_listings set delisted_at = null where id = ${lid}`;
  });
});
