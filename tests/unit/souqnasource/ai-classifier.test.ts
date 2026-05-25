// tests/unit/souqnasource/ai-classifier.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/apps/souqnasource/ai/client', () => ({
  chatJson: vi.fn(),
  safeJsonObject: (s: string) => {
    try { return JSON.parse(s); } catch { return null; }
  },
}));

import { llmCategory } from '@/lib/apps/souqnasource/ai/classifier';
import { chatJson } from '@/lib/apps/souqnasource/ai/client';

describe('llmCategory', () => {
  it('returns parsed category when confidence high', async () => {
    (chatJson as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      JSON.stringify({ category: 'perfume-modern', subcategory: 'eau de parfum', confidence: 0.85 }),
    );
    const out = await llmCategory({
      title: 'Designer Eau de Parfum 100ml',
      rawCategory: 'fragrance',
      description: null,
    });
    expect(out.category).toBe('perfume-modern');
    expect(out.subcategory).toBe('eau de parfum');
  });

  it('falls back to uncategorized when confidence low', async () => {
    (chatJson as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      JSON.stringify({ category: 'perfume-oud', subcategory: null, confidence: 0.3 }),
    );
    const out = await llmCategory({ title: 'mystery item', rawCategory: null, description: null });
    expect(out.category).toBe('uncategorized');
  });

  it('falls back to uncategorized when LLM returns garbage', async () => {
    (chatJson as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce('not json');
    const out = await llmCategory({ title: 'x', rawCategory: null, description: null });
    expect(out.category).toBe('uncategorized');
  });
});
