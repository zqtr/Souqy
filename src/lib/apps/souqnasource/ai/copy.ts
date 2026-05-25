// src/lib/apps/souqnasource/ai/copy.ts
import { chatJson, safeJsonObject } from './client';

const SYSTEM = `You are Souqna's brand copywriter. Rewrite a Qatari supplier listing into clean, on-brand copy in BOTH English and Khaleeji Arabic (informal Qatari Gulf register — NOT MSA, NOT Egyptian, NOT Levantine).

Strip: emojis, ALL CAPS, marketing spam ("BEST!!!", "ORIGINAL!!!"), unit-mixing, vendor contact info baked into the title, repeated punctuation.
Keep: concrete specs (size, material, ml, color, MOQ if relevant).

Output JSON:
  { "title":       { "en": "...", "ar": "..." },
    "description": { "en": "...", "ar": "..." } }

Title <= 60 chars EN, <= 50 chars AR.
Description 2-3 sentences each language.`;

export type CopyOutput = {
  title: { en: string; ar: string };
  description: { en: string; ar: string };
};

export async function rewriteCopy(input: {
  title: string;
  description: string | null;
  category: string;
  area: string | null;
}): Promise<CopyOutput | null> {
  let raw = '';
  try {
    raw = await chatJson({
      system: SYSTEM,
      user: JSON.stringify(input),
      maxTokens: 600,
    });
  } catch {
    return null;
  }
  const obj = safeJsonObject(raw);
  if (!obj) return null;
  const t = obj.title as { en?: unknown; ar?: unknown } | undefined;
  const d = obj.description as { en?: unknown; ar?: unknown } | undefined;
  if (
    !t || !d ||
    typeof t.en !== 'string' || typeof t.ar !== 'string' ||
    typeof d.en !== 'string' || typeof d.ar !== 'string'
  ) {
    return null;
  }
  return {
    title: { en: t.en.slice(0, 60), ar: t.ar.slice(0, 50) },
    description: { en: d.en, ar: d.ar },
  };
}
