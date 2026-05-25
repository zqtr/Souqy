import { chatJson, safeJsonObject } from './client';

const SYSTEM = `You are a Qatar e-commerce pricing analyst. Suggest a retail price in QAR for a Qatari-wholesaler-sourced product (local — no import duty).

Apply category-typical Qatar D2C retail markup:
  perfume / oud:        2.0 - 3.0x
  fashion / abaya:      2.5 - 3.5x
  electronics access.:  1.5 - 2.0x
  home / decor:         2.0 - 3.0x
  beauty / skincare:    3.0 - 4.5x
  food / dates:         1.8 - 2.5x

Round to clean .00 or .99 ending. MOQ discount is already priced in.

Output JSON only:
  { "suggestedRetail": <number>, "currency": "QAR",
    "markupApplied": <number>, "rationale": "<<= 15 words>" }`;

export type MarginOutput = {
  suggestedRetail: number;
  currency: 'QAR';
  markupApplied: number;
  rationale: string;
};

export async function suggestMargin(input: {
  title: string;
  category: string;
  supplierCost: number;
  supplierCurrency: string;
  moq: number | null;
  area: string | null;
}): Promise<MarginOutput | null> {
  let raw = '';
  try {
    raw = await chatJson({
      system: SYSTEM,
      user: JSON.stringify(input),
      maxTokens: 200,
    });
  } catch {
    return defaultMargin(input.supplierCost);
  }
  const obj = safeJsonObject(raw);
  if (!obj) return defaultMargin(input.supplierCost);
  const r = Number(obj.suggestedRetail);
  const m = Number(obj.markupApplied);
  if (!Number.isFinite(r) || r <= 0) return defaultMargin(input.supplierCost);
  return {
    suggestedRetail: Math.round(r * 100) / 100,
    currency: 'QAR',
    markupApplied: Number.isFinite(m) ? m : r / Math.max(input.supplierCost, 1),
    rationale: typeof obj.rationale === 'string' ? obj.rationale.slice(0, 100) : '',
  };
}

function defaultMargin(cost: number): MarginOutput {
  return {
    suggestedRetail: Math.round(cost * 2 * 100) / 100,
    currency: 'QAR',
    markupApplied: 2,
    rationale: 'default 2.0x markup (AI unavailable)',
  };
}
