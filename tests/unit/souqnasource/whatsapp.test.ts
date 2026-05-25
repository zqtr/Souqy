import { describe, it, expect } from 'vitest';
import { buildQuoteRequestUrl } from '@/lib/apps/souqnasource/whatsapp';

const listing = {
  id: 'qatarliving:1',
  title: 'Oud Cambodi 12ml',
} as const;

const supplier = {
  id: 'qatarliving:doha-perfume-house',
  whatsapp: '+97455555555',
} as const;

describe('buildQuoteRequestUrl', () => {
  it('builds en URL with claim line', () => {
    const out = buildQuoteRequestUrl({
      listing,
      supplier,
      storefront: { name: 'Aroma Doha', locale: 'en' },
    });
    expect(out.url).toContain('https://wa.me/97455555555');
    expect(decodeURIComponent(out.url)).toContain('Oud Cambodi 12ml');
    expect(out.prefilledMessage).toContain('— via SouqnaSource');
    expect(out.prefilledMessage).toContain(`souqna.qa/s/${supplier.id}`);
  });

  it('builds ar URL with khaleeji opener', () => {
    const out = buildQuoteRequestUrl({
      listing,
      supplier,
      storefront: { name: 'عطور الدوحة', locale: 'ar' },
    });
    expect(out.prefilledMessage).toContain('السلام عليكم');
    expect(out.prefilledMessage).toContain('— عبر SouqnaSource');
  });

  it('throws when supplier has no whatsapp', () => {
    expect(() =>
      buildQuoteRequestUrl({
        listing,
        supplier: { id: 'x', whatsapp: null },
        storefront: { name: 'X', locale: 'en' },
      }),
    ).toThrow('supplier_no_whatsapp');
  });
});
