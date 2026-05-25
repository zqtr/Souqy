// tests/unit/souqnasource/apify-marhaba.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/apps/souqnasource/clients/apify-base', async () => {
  const actual: typeof import('@/lib/apps/souqnasource/clients/apify-base') =
    await vi.importActual('@/lib/apps/souqnasource/clients/apify-base');
  return { ...actual, runActor: vi.fn() };
});

import { marhabaClient } from '@/lib/apps/souqnasource/clients/apify-marhaba';
import { runActor } from '@/lib/apps/souqnasource/clients/apify-base';

const mockRun = runActor as unknown as ReturnType<typeof vi.fn>;

describe('marhabaClient.crawl', () => {
  it('maps marhaba payload', async () => {
    mockRun.mockResolvedValueOnce([
      {
        listingId: 'mh-1',
        url: 'https://marhaba.qa/listing/1',
        title: 'Black abaya wholesale',
        body: null,
        thumbnail: 'https://marhaba.qa/i/1.jpg',
        priceQar: 120,
        seller: {
          id: 'mh-seller-1',
          name: 'Souq Waqif Abayas',
          whatsapp: '+97444444444',
          location: 'souq-waqif',
          profileUrl: 'https://marhaba.qa/u/swa',
        },
      },
    ]);
    const out = await marhabaClient.crawl({ sinceCursor: null });
    expect(out.listings[0]?.title).toBe('Black abaya wholesale');
    expect(out.listings[0]?.price).toBe(120);
    expect(out.suppliers[0]?.area).toBe('souq-waqif');
  });
});
