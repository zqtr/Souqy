import type { Metadata } from 'next';
import { env } from '@/lib/env';
import { type Locale, locales } from '@/i18n/locales';
import { getCopy } from '@/content/copy';

const SITE_URL = env.NEXT_PUBLIC_SITE_URL;

type BuildArgs = {
  locale: Locale;
  path?: string;
  title?: string;
  description?: string;
};

/**
 * Per-route metadata helper. Always sets canonical, hreflang, and OG.
 */
export function buildMetadata({ locale, path = '/', title, description }: BuildArgs): Metadata {
  const t = getCopy(locale);
  const fullTitle = title ?? t.meta.titleSuffix;
  const desc = description ?? t.meta.description;

  const canonical = locale === 'en' ? `${SITE_URL}${path}` : `${SITE_URL}/${locale}${path === '/' ? '' : path}`;

  const languages: Record<string, string> = {};
  for (const loc of locales) {
    languages[loc] = loc === 'en' ? `${SITE_URL}${path}` : `${SITE_URL}/${loc}${path === '/' ? '' : path}`;
  }
  languages['x-default'] = `${SITE_URL}${path}`;

  return {
    title: fullTitle,
    description: desc,
    alternates: { canonical, languages },
    openGraph: {
      type: 'website',
      siteName: 'Souqna',
      title: fullTitle,
      description: desc,
      url: canonical,
      locale: locale === 'ar' ? 'ar_QA' : 'en_QA',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: desc,
    },
  };
}

/**
 * JSON-LD Organization schema, rendered server-side in the locale layout.
 */
export function organizationJsonLd(locale: Locale) {
  const t = getCopy(locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Souqna',
    alternateName: ['Souqna', 'Souqna Commerce Workspace'],
    url: SITE_URL,
    description: t.meta.description,
    foundingDate: '2026',
    foundingLocation: {
      '@type': 'Place',
      name: 'Doha, Qatar',
      address: { '@type': 'PostalAddress', addressLocality: 'Doha', addressCountry: 'QA' },
    },
    email: 'support@souqna.qa',
    knowsLanguage: ['ar', 'en'],
    slogan: 'A bilingual commerce workspace designed in Doha for Gulf storefronts.',
  } as const;
}
