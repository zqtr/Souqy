import { db, hasDb } from './db';

const RESERVED = new Set([
  'www',
  'api',
  'admin',
  'brand',
  'journal',
  'atelier',
  'contact',
  'begin',
  'app',
  'mail',
  'assets',
  'cdn',
  'static',
  'help',
  'docs',
  'blog',
  'support',
  'status',
  'auth',
  'login',
  'signup',
  'dashboard',
  '_brief',
  'brief',
  'preview',
  'edit',
  'storefront',
  'storefronts',
]);

const ARABIC_TO_LATIN: Record<string, string> = {
  ا: 'a',
  أ: 'a',
  إ: 'i',
  آ: 'a',
  ب: 'b',
  ت: 't',
  ث: 'th',
  ج: 'j',
  ح: 'h',
  خ: 'kh',
  د: 'd',
  ذ: 'dh',
  ر: 'r',
  ز: 'z',
  س: 's',
  ش: 'sh',
  ص: 's',
  ض: 'd',
  ط: 't',
  ظ: 'z',
  ع: 'a',
  غ: 'gh',
  ف: 'f',
  ق: 'q',
  ك: 'k',
  ل: 'l',
  م: 'm',
  ن: 'n',
  ه: 'h',
  و: 'w',
  ي: 'y',
  ى: 'a',
  ة: 'h',
  ء: '',
  ؤ: 'w',
  ئ: 'y',
};

export function slugify(input: string): string {
  const folded = Array.from(input.trim().toLowerCase())
    .map((ch) => ARABIC_TO_LATIN[ch] ?? ch)
    .join('');
  const ascii = folded
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return ascii.slice(0, 40);
}

export function isReserved(slug: string): boolean {
  if (!slug) return true;
  if (slug.length < 3) return true;
  if (slug.length > 40) return true;
  if (/^\d+$/.test(slug)) return true;
  if (RESERVED.has(slug)) return true;
  if (!/^[a-z0-9-]+$/.test(slug)) return true;
  if (slug.startsWith('-') || slug.endsWith('-')) return true;
  return false;
}

export async function isTaken(slug: string): Promise<boolean> {
  if (!hasDb()) return false;
  const rows = (await db()`select 1 from briefs where slug = ${slug} limit 1`) as unknown as Array<{
    '?column?': number;
  }>;
  return rows.length > 0;
}

/**
 * Returns the input slug if available; otherwise appends -2, -3, …
 * until a free one is found. Caps at 99 attempts to avoid runaway.
 */
export async function nextAvailable(base: string): Promise<string> {
  let candidate = base;
  if (!(await isTaken(candidate))) return candidate;
  for (let i = 2; i < 100; i += 1) {
    candidate = `${base}-${i}`.slice(0, 40);
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error('no slug available');
}
