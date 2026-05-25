// tests/unit/souqnasource/ai-copy.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/apps/souqnasource/ai/client', () => ({
  chatJson: vi.fn(),
  safeJsonObject: (s: string) => { try { return JSON.parse(s); } catch { return null; } },
}));

import { rewriteCopy } from '@/lib/apps/souqnasource/ai/copy';
import { chatJson } from '@/lib/apps/souqnasource/ai/client';

const mockChat = chatJson as unknown as ReturnType<typeof vi.fn>;

describe('rewriteCopy', () => {
  it('returns parsed bilingual copy', async () => {
    mockChat.mockResolvedValueOnce(JSON.stringify({
      title: { en: 'Cambodi Oud Oil 12ml', ar: 'دهن العود كمبودي ١٢ مل' },
      description: {
        en: 'Premium grade Cambodian oud, hand-distilled.',
        ar: 'عود كمبودي فاخر مقطر يدوياً.',
      },
    }));
    const out = await rewriteCopy({
      title: 'OUD CAMBODI 12ml!!!',
      description: 'BEST QUALITY!!!',
      category: 'perfume-oud',
      area: 'najma',
    });
    expect(out?.title.en).toBe('Cambodi Oud Oil 12ml');
    expect(out?.title.ar).toContain('دهن العود');
  });

  it('returns null on garbage', async () => {
    mockChat.mockResolvedValueOnce('not json');
    const out = await rewriteCopy({
      title: 't', description: null, category: 'perfume-oud', area: null,
    });
    expect(out).toBeNull();
  });

  it('returns null when LLM throws', async () => {
    mockChat.mockRejectedValueOnce(new Error('rate limit'));
    const out = await rewriteCopy({
      title: 't', description: null, category: 'perfume-oud', area: null,
    });
    expect(out).toBeNull();
  });
});
