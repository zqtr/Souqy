export const locales = ['en', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const direction: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl',
};

export const localeLabel: Record<Locale, { native: string; other: string }> = {
  en: { native: 'EN', other: 'AR' },
  ar: { native: 'AR', other: 'EN' },
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
