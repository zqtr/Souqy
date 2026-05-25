import { describe, expect, it } from 'vitest';
import type { Storefront } from '@/lib/brief';
import type { Product } from '@/lib/products';
import { buildCatalogueSummary } from '@/lib/souqy/customerAssistant';

const storefront = {
  businessName: 'AE STORE',
  locale: 'en',
  businessType: 'graphic_design',
  tagline: 'Your destination for innovation',
  checkout: {
    shippingFlatQar: 15,
  },
} as Storefront;

function product(patch: Partial<Product>): Product {
  return {
    id: 'product-1',
    storefrontSlug: 'aestore',
    title: 'Logo design',
    description: 'Professional logo package',
    priceQar: 120,
    pricingMode: 'one_time',
    monthlyPriceQar: null,
    imageUrl: null,
    category: 'Design',
    eventAt: null,
    status: 'active',
    isCustomizable: false,
    customizationLabel: null,
    sizeOptions: [],
    allowCustomSize: false,
    requiresHeightInput: false,
    heightInputLabel: null,
    heightOptions: [],
    position: 0,
    source: 'manual',
    isDemo: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...patch,
  };
}

describe('buildCatalogueSummary', () => {
  it('summarizes the store and listed public products', () => {
    const summary = buildCatalogueSummary(storefront, [
      product({ title: 'Logo design', priceQar: 120 }),
      product({ title: 'Draft service', status: 'draft' }),
    ]);

    expect(summary).toContain('AE STORE');
    expect(summary).toContain('Listed products:');
    expect(summary).toContain('Logo design (120 QAR)');
    expect(summary).not.toContain('Draft service');
    expect(summary).toContain('Listed delivery fee: 15 QAR.');
  });
});
