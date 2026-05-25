import { describe, it, expect } from 'vitest';
import {
  CATEGORIES,
  isCategory,
  ListingSchema,
  SupplierSchema,
} from '@/lib/apps/souqnasource/types';

describe('CATEGORIES', () => {
  it('contains expected core categories', () => {
    expect(CATEGORIES).toContain('perfume-oud');
    expect(CATEGORIES).toContain('fashion-abaya');
    expect(CATEGORIES).toContain('electronics-accessories');
  });
});

describe('isCategory', () => {
  it('accepts known category', () => {
    expect(isCategory('perfume-oud')).toBe(true);
  });
  it('rejects unknown category', () => {
    expect(isCategory('hovercraft-eels')).toBe(false);
  });
});

describe('ListingSchema', () => {
  it('parses a priced listing', () => {
    const out = ListingSchema.parse({
      id: 'qatarliving:abc',
      supplierId: 'doha-perfume-house-najma',
      network: 'qatarliving',
      sourceListingUrl: 'https://qatarliving.com/x',
      title: 'Oud 12ml',
      description: null,
      imageUrl: null,
      category: 'perfume-oud',
      subcategory: null,
      listingType: 'priced',
      price: 85,
      currency: 'QAR',
      moq: null,
      raw: {},
      firstSeenAt: new Date().toISOString(),
      lastIndexedAt: new Date().toISOString(),
      delistedAt: null,
    });
    expect(out.listingType).toBe('priced');
  });

  it('rejects priced listing without price', () => {
    expect(() =>
      ListingSchema.parse({
        id: 'x',
        supplierId: 's',
        network: 'qatarliving',
        sourceListingUrl: 'https://x.example',
        title: 't',
        description: null,
        imageUrl: null,
        category: 'perfume-oud',
        subcategory: null,
        listingType: 'priced',
        price: null,
        currency: null,
        moq: null,
        raw: {},
        firstSeenAt: new Date().toISOString(),
        lastIndexedAt: new Date().toISOString(),
        delistedAt: null,
      }),
    ).toThrow();
  });
});

describe('SupplierSchema', () => {
  it('parses minimal supplier', () => {
    const s = SupplierSchema.parse({
      id: 's1',
      displayName: 'Doha Perfume House',
      crNumber: null,
      whatsapp: '+97455555555',
      area: 'najma',
      sourceNetwork: 'qatarliving',
      sourceProfileUrl: null,
      trustScore: null,
      trustReason: null,
      verified: false,
      claimedAt: null,
      firstSeenAt: new Date().toISOString(),
      lastIndexedAt: new Date().toISOString(),
    });
    expect(s.id).toBe('s1');
  });
});
