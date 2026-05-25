// tests/unit/souqnasource/ai-trust.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/apps/souqnasource/ai/client', () => ({
  chatJson: vi.fn(),
  safeJsonArray: (s: string) => {
    try { const o = JSON.parse(s); return Array.isArray(o) ? o : null; } catch { return null; }
  },
}));

import { scoreSuppliersTrust } from '@/lib/apps/souqnasource/ai/trust';
import { chatJson } from '@/lib/apps/souqnasource/ai/client';

const mockChat = chatJson as unknown as ReturnType<typeof vi.fn>;

describe('scoreSuppliersTrust', () => {
  it('returns parsed scores', async () => {
    mockChat.mockResolvedValueOnce(
      JSON.stringify([
        { id: 's1', trustScore: 8.4, reason: 'CR verified, focused listings' },
        { id: 's2', trustScore: 4.5, reason: 'no whatsapp, very new' },
      ]),
    );
    const out = await scoreSuppliersTrust([
      { id: 's1', displayName: 'A', area: 'najma', hasCR: true, verified: true, hasWhatsapp: true, listingCount: 8, categorySpan: 1, sampleTitles: ['Oud 12ml'], firstSeenDaysAgo: 365 },
      { id: 's2', displayName: 'B', area: null, hasCR: false, verified: false, hasWhatsapp: false, listingCount: 2, categorySpan: 1, sampleTitles: ['x'], firstSeenDaysAgo: 4 },
    ]);
    expect(out).toEqual([
      { id: 's1', trustScore: 8.4, reason: 'CR verified, focused listings' },
      { id: 's2', trustScore: 4.5, reason: 'no whatsapp, very new' },
    ]);
  });

  it('returns empty array on garbage', async () => {
    mockChat.mockResolvedValueOnce('not json');
    const out = await scoreSuppliersTrust([
      { id: 's1', displayName: 'A', area: null, hasCR: false, verified: false, hasWhatsapp: false, listingCount: 0, categorySpan: 0, sampleTitles: [], firstSeenDaysAgo: 0 },
    ]);
    expect(out).toEqual([]);
  });

  it('clamps scores to 0..10', async () => {
    mockChat.mockResolvedValueOnce(
      JSON.stringify([{ id: 's1', trustScore: 99, reason: 'x' }]),
    );
    const out = await scoreSuppliersTrust([
      { id: 's1', displayName: 'A', area: null, hasCR: false, verified: false, hasWhatsapp: false, listingCount: 0, categorySpan: 0, sampleTitles: [], firstSeenDaysAgo: 0 },
    ]);
    expect(out[0]?.trustScore).toBe(10);
  });
});
