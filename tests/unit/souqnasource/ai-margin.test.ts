import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/apps/souqnasource/ai/client', () => ({
  chatJson: vi.fn(),
  safeJsonObject: (s: string) => { try { return JSON.parse(s); } catch { return null; } },
}));

import { suggestMargin } from '@/lib/apps/souqnasource/ai/margin';
import { chatJson } from '@/lib/apps/souqnasource/ai/client';

const mockChat = chatJson as unknown as ReturnType<typeof vi.fn>;

describe('suggestMargin', () => {
  it('parses suggestion', async () => {
    mockChat.mockResolvedValueOnce(JSON.stringify({
      suggestedRetail: 199.99,
      currency: 'QAR',
      markupApplied: 2.4,
      rationale: 'oud category 2.0-3.0x',
    }));
    const out = await suggestMargin({
      title: 'Oud 12ml', category: 'perfume-oud',
      supplierCost: 85, supplierCurrency: 'QAR',
      moq: null, area: 'najma',
    });
    expect(out?.suggestedRetail).toBe(199.99);
    expect(out?.markupApplied).toBe(2.4);
  });

  it('falls back to default 2.0x when LLM fails', async () => {
    mockChat.mockRejectedValueOnce(new Error('boom'));
    const out = await suggestMargin({
      title: 'x', category: 'perfume-oud',
      supplierCost: 50, supplierCurrency: 'QAR',
      moq: null, area: null,
    });
    expect(out?.suggestedRetail).toBe(100);
    expect(out?.markupApplied).toBe(2);
  });
});
