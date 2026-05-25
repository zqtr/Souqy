// src/lib/apps/souqnasource/ai/trust.ts
import { chatJson, safeJsonArray } from './client';

export type TrustInput = {
  id: string;
  displayName: string;
  area: string | null;
  hasCR: boolean;
  verified: boolean;
  hasWhatsapp: boolean;
  listingCount: number;
  categorySpan: number;
  sampleTitles: string[];
  firstSeenDaysAgo: number;
};

export type TrustOutput = {
  id: string;
  trustScore: number;
  reason: string;
};

const SYSTEM = `You are evaluating Qatari wholesale suppliers from public B2B listings.
For each supplier, output a trust score 0-10 with a short reason.

Rubric (be conservative — when in doubt, score lower):
  - CR (Commercial Registration) visible              -> +2
  - Verified by Souqna admin                          -> +1
  - WhatsApp present + valid Qatar (+974) format      -> baseline OK; missing -> cap 5
  - Listings >= 5 AND span <= 2 categories            -> +1 (focused seller)
  - Listings span >= 5 unrelated categories           -> -2 (likely reseller spam)
  - First seen < 30 days AND < 3 listings             -> cap at 4 (too new)
  - Title patterns: ALL CAPS, !!!, "ORIGINAL!!!"      -> -1 each
  - Area set + listings consistent with area          -> +1
  - Description missing on majority of listings       -> -1

Output JSON array, one object per supplier:
  {"id": "<supplierId>", "trustScore": <0-10>, "reason": "<<= 12 words>"}.
Return ONLY the JSON array.`;

function clamp(n: unknown): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(10, n));
}

export async function scoreSuppliersTrust(
  suppliers: TrustInput[],
): Promise<TrustOutput[]> {
  if (suppliers.length === 0) return [];
  let raw = '';
  try {
    raw = await chatJson({
      system: SYSTEM,
      user: JSON.stringify(suppliers),
      maxTokens: 1200,
    });
  } catch {
    return [];
  }
  // The Chat Completions json_object response_format wraps arrays under {result: ...}.
  // We try array-first, then fall back to {result: [...]}.
  let arr = safeJsonArray(raw);
  if (!arr) {
    try {
      const obj = JSON.parse(raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, ''));
      if (obj && Array.isArray(obj.result)) arr = obj.result;
    } catch {
      arr = null;
    }
  }
  if (!arr) return [];
  const out: TrustOutput[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const i = item as Record<string, unknown>;
    if (typeof i.id !== 'string') continue;
    out.push({
      id: i.id,
      trustScore: clamp(i.trustScore),
      reason: typeof i.reason === 'string' ? i.reason.slice(0, 80) : '',
    });
  }
  return out;
}
