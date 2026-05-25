import { describe, it, expect, afterAll } from 'vitest';
import { db } from '@/lib/db';
import {
  upsertSupplier,
  getSupplierById,
  setSupplierTrust,
} from '@/lib/apps/souqnasource/suppliers';

describe('suppliers DAO', () => {
  const id = `test-supplier-${Date.now()}`;
  afterAll(async () => {
    await db()`delete from souqnasource_suppliers where id = ${id}`;
  });

  it('upserts new supplier', async () => {
    await upsertSupplier({
      id,
      displayName: 'Test Wholesaler',
      crNumber: null,
      whatsapp: '+97455555555',
      area: 'najma',
      sourceNetwork: 'qatarliving',
      sourceProfileUrl: 'https://qatarliving.com/u/test',
    });
    const got = await getSupplierById(id);
    expect(got?.displayName).toBe('Test Wholesaler');
    expect(got?.verified).toBe(false);
    expect(got?.trustScore).toBeNull();
  });

  it('preserves trust_score + claimed_at on subsequent upsert', async () => {
    await setSupplierTrust(id, 7.5, 'looks legit');
    await upsertSupplier({
      id,
      displayName: 'Test Wholesaler Updated',
      crNumber: '0123456',
      whatsapp: '+97455555555',
      area: 'najma',
      sourceNetwork: 'qatarliving',
      sourceProfileUrl: 'https://qatarliving.com/u/test',
    });
    const got = await getSupplierById(id);
    expect(got?.trustScore).toBe(7.5);
    expect(got?.trustReason).toBe('looks legit');
    expect(got?.crNumber).toBe('0123456');
    expect(got?.displayName).toBe('Test Wholesaler Updated');
  });
});
