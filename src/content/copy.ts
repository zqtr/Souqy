import type { Locale } from '@/i18n/locales';
import { copyEn } from './copy.en';
import { copyAr } from './copy.ar';

/**
 * Recursively widen literal types so the Arabic mirror can hold different
 * strings while still being required to match the structural shape (every
 * key, every nesting depth) exactly.
 */
type Localized<T> = T extends string
  ? string
  : T extends number
  ? number
  : T extends boolean
  ? boolean
  : T extends readonly (infer U)[]
  ? readonly Localized<U>[]
  : T extends object
  ? { readonly [K in keyof T]: Localized<T[K]> }
  : T;

/**
 * Copy is the SINGLE source of strings. Both locales share this exact shape;
 * TypeScript will fail the build if either locale drifts in shape.
 */
export type Copy = Localized<typeof copyEn>;

const dictionaries: Record<Locale, Copy> = {
  en: copyEn,
  ar: copyAr,
};

export function getCopy(locale: Locale): Copy {
  return dictionaries[locale];
}
