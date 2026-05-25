import { describe, it, expect } from 'vitest';
import { runSync } from '@/lib/apps/souqnasource/sync';

describe('runSync', () => {
  it('returns a summary even with empty links', async () => {
    const out = await runSync();
    expect(out.walked).toBeGreaterThanOrEqual(0);
    expect(typeof out.delistedNotified).toBe('number');
    expect(typeof out.driftNotified).toBe('number');
  });
});
