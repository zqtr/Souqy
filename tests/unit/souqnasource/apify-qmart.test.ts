// tests/unit/souqnasource/apify-qmart.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/apps/souqnasource/clients/apify-base', async () => {
  const actual: typeof import('@/lib/apps/souqnasource/clients/apify-base') =
    await vi.importActual('@/lib/apps/souqnasource/clients/apify-base');
  return { ...actual, runActor: vi.fn() };
});

import { qmartClient } from '@/lib/apps/souqnasource/clients/apify-qmart';
import { runActor } from '@/lib/apps/souqnasource/clients/apify-base';

const mockRun = runActor as unknown as ReturnType<typeof vi.fn>;

describe('qmartClient.crawl', () => {
  it('maps qmart payload', async () => {
    mockRun.mockResolvedValueOnce([
      {
        productId: 'qm-1',
        productUrl: 'https://qmart.qa/p/1',
        name: 'iPhone 15 case',
        desc: 'Silicone',
        imageUrl: 'https://qmart.qa/i/1.jpg',
        price: 25,
        currency: 'QAR',
        moqUnits: 100,
        vendor: {
          id: 'qm-vendor-1',
          name: 'Najma Electronics',
          whatsapp: '+97433333333',
          area: 'najma',
          storeUrl: 'https://qmart.qa/v/ne',
        },
        taxonomyLabel: 'Phone Accessories',
      },
    ]);
    const out = await qmartClient.crawl({ sinceCursor: null });
    expect(out.listings[0]?.title).toBe('iPhone 15 case');
    expect(out.listings[0]?.price).toBe(25);
    expect(out.suppliers[0]?.area).toBe('najma');
  });
});
