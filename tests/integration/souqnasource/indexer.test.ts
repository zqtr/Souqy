// tests/integration/souqnasource/indexer.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/lib/db';
import { POST } from '@/app/api/apps/souqnasource/cron/index/route';
import { CLIENTS } from '@/lib/apps/souqnasource/clients';

beforeAll(() => {
  process.env.SOUQNASOURCE_INDEX_CRON_SECRET = 'test-secret';
});

afterAll(async () => {
  // Listings have canonical id `${network}:${sourceListingId}`, supplier_id matches
  // the supplier's canonical id `${network}:idx-test-${network}-s`.
  await db()`delete from souqnasource_listings where supplier_id like '%:idx-test-%'`;
  await db()`delete from souqnasource_suppliers where id like '%:idx-test-%'`;
});

describe('indexer cron', () => {
  it('rejects on missing secret', async () => {
    const res = await POST(
      new Request('http://t/api/apps/souqnasource/cron/index'),
    );
    expect(res.status).toBe(401);
  });

  it('runs all 3 networks and upserts', async () => {
    // Mock each client.crawl
    for (const c of Object.values(CLIENTS)) {
      vi.spyOn(c, 'crawl').mockResolvedValue({
        suppliers: [
          {
            network: c.network,
            sourceSupplierId: `idx-test-${c.network}-s`,
            displayName: `Test ${c.network}`,
            whatsapp: '+97455555555',
            area: 'najma',
            sourceProfileUrl: `https://${c.network}.test/u/x`,
          },
        ],
        listings: [
          {
            network: c.network,
            sourceListingId: `idx-test-${c.network}-l`,
            sourceListingUrl: `https://${c.network}.test/l/x`,
            sourceSupplierId: `idx-test-${c.network}-s`,
            title: 'Oud Cambodi 12ml',
            description: null,
            imageUrl: null,
            rawCategory: 'perfume',
            price: 85,
            currency: 'QAR',
            moq: null,
            raw: {},
          },
        ],
        nextCursor: null,
      });
    }

    const res = await POST(
      new Request('http://t/api/apps/souqnasource/cron/index', {
        method: 'POST',
        headers: { 'x-cron-secret': 'test-secret' },
      }),
    );
    expect(res.status).toBe(200);

    const rows = (await db()`
      select id from souqnasource_suppliers
      where id like '%:idx-test-%'
    `) as unknown as { id: string }[];
    expect(rows.length).toBe(3);
  });
});
