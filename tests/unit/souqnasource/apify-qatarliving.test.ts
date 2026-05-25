// tests/unit/souqnasource/apify-qatarliving.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/apps/souqnasource/clients/apify-base', async () => {
  const actual: typeof import('@/lib/apps/souqnasource/clients/apify-base') =
    await vi.importActual('@/lib/apps/souqnasource/clients/apify-base');
  return { ...actual, runActor: vi.fn() };
});

import { qatarlivingClient } from '@/lib/apps/souqnasource/clients/apify-qatarliving';
import { runActor } from '@/lib/apps/souqnasource/clients/apify-base';

const mockRun = runActor as unknown as ReturnType<typeof vi.fn>;

describe('qatarlivingClient.crawl', () => {
  it('maps actor items into suppliers + listings', async () => {
    mockRun.mockResolvedValueOnce([
      {
        id: 'ql-listing-1',
        url: 'https://qatarliving.com/classifieds/1',
        title: 'Oud Cambodi 12ml',
        description: 'Premium grade',
        image: 'https://qatarliving.com/img/1.jpg',
        price: 85,
        currency: 'QAR',
        moq: 10,
        category: 'Perfume',
        sellerId: 'ql-seller-1',
        sellerName: 'Doha Perfume House',
        sellerWhatsapp: '55555555',
        sellerArea: 'Najma',
        sellerProfileUrl: 'https://qatarliving.com/u/dph',
      },
    ]);
    const out = await qatarlivingClient.crawl({ sinceCursor: null });
    expect(out.suppliers).toHaveLength(1);
    expect(out.suppliers[0]?.displayName).toBe('Doha Perfume House');
    expect(out.suppliers[0]?.whatsapp).toBe('+97455555555');
    expect(out.listings).toHaveLength(1);
    expect(out.listings[0]?.price).toBe(85);
    expect(out.listings[0]?.sourceSupplierId).toBe('ql-seller-1');
  });

  it('coerces missing price to null (contact listing)', async () => {
    mockRun.mockResolvedValueOnce([
      {
        id: 'ql-listing-2',
        url: 'https://qatarliving.com/classifieds/2',
        title: 'Wholesale electronics',
        description: null,
        image: null,
        price: null,
        currency: null,
        sellerId: 'ql-seller-2',
        sellerName: 'Najma Electronics',
        sellerWhatsapp: null,
        sellerArea: null,
        sellerProfileUrl: 'https://qatarliving.com/u/ne',
      },
    ]);
    const out = await qatarlivingClient.crawl({ sinceCursor: null });
    expect(out.listings[0]?.price).toBeNull();
  });
});
