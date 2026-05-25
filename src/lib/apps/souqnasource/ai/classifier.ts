// src/lib/apps/souqnasource/ai/classifier.ts
import { chatJson, safeJsonObject } from './client';
import { CATEGORIES, isCategory } from '../types';
import type { Category } from '../types';

const SYSTEM = `Classify a Qatari B2B listing into ONE of: ${CATEGORIES.join(', ')}.
Return JSON only: {"category": "<code>", "subcategory": "<short label or null>", "confidence": 0.0-1.0}.
If confidence < 0.6, return category = "uncategorized".`;

export async function llmCategory(input: {
  title: string;
  rawCategory: string | null;
  description: string | null;
}): Promise<{ category: Category; subcategory: string | null }> {
  const user = JSON.stringify({
    title: input.title,
    vendorCategory: input.rawCategory,
    description: (input.description ?? '').slice(0, 200),
  });
  let raw = '';
  try {
    raw = await chatJson({ system: SYSTEM, user });
  } catch {
    return { category: 'uncategorized', subcategory: null };
  }
  const obj = safeJsonObject(raw);
  if (!obj) return { category: 'uncategorized', subcategory: null };
  const cat = obj.category;
  const conf = typeof obj.confidence === 'number' ? obj.confidence : 0;
  if (!isCategory(cat) || conf < 0.6) {
    return { category: 'uncategorized', subcategory: null };
  }
  const sub = typeof obj.subcategory === 'string' ? obj.subcategory : null;
  return { category: cat, subcategory: sub };
}
