import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { db } from '@/lib/db';
import { upsertSupplier } from '@/lib/apps/souqnasource/suppliers';
import {
  upsertListing,
  markVanishedAsDelisted,
  getListingById,
  listListingsByCategory,
} from '@/lib/apps/souqnasource/listings';

const sid = `t-supplier-${Date.now()}`;
const lid = `t-listing-${Date.now()}`;

beforeAll(async () => {
  await upsertSupplier({
    id: sid,
    displayName: 'Listings Test Supplier',
    crNumber: null,
    whatsapp: '+97455555555',
    area: 'najma',
    sourceNetwork: 'qatarliving',
    sourceProfileUrl: null,
  });
});

afterAll(async () => {
  await db()`delete from souqnasource_listings where supplier_id = ${sid}`;
  await db()`delete from souqnasource_suppliers where id = ${sid}`;
});

describe('listings DAO', () => {
  it('upserts a priced listing', async () => {
    await upsertListing({
      id: lid,
      supplierId: sid,
      network: 'qatarliving',
      sourceListingUrl: 'https://qatarliving.com/test',
      title: 'Oud Cambodi 12ml',
      description: null,
      imageUrl: null,
      category: 'perfume-oud',
      subcategory: null,
      listingType: 'priced',
      price: 85,
      currency: 'QAR',
      moq: 10,
      raw: { sample: true },
    });
    const got = await getListingById(lid);
    expect(got?.title).toBe('Oud Cambodi 12ml');
    expect(got?.delistedAt).toBeNull();
    expect(got?.price).toBe(85);
  });

  it('lists by category', async () => {
    const list = await listListingsByCategory('perfume-oud', 'priced', 10);
    expect(list.some((l) => l.id === lid)).toBe(true);
  });

  it('marks vanished after 3 missed runs', async () => {
    // Simulate 3 indexer passes that did NOT include this listing.
    await markVanishedAsDelisted('qatarliving', new Set([]));
    await markVanishedAsDelisted('qatarliving', new Set([]));
    await markVanishedAsDelisted('qatarliving', new Set([]));
    const got = await getListingById(lid);
    expect(got?.delistedAt).not.toBeNull();
  });
});
