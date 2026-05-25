import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { locales, type Locale } from '@/i18n/locales';
import { getJournalEntries } from '@/lib/journal';

const ROUTES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
  { path: '/', changeFrequency: 'monthly', priority: 1 },
  { path: '/atelier', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/begin', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/journal', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/brand', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/refund', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/shipping', changeFrequency: 'yearly', priority: 0.3 },
];

function urlFor(locale: Locale, path: string): string {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  if (locale === 'en') return `${base}${path}`;
  return `${base}/${locale}${path === '/' ? '' : path}`;
}

function alternates(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const loc of locales) out[loc] = urlFor(loc, path);
  out['x-default'] = urlFor('en', path);
  return out;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const route of ROUTES) {
      entries.push({
        url: urlFor(locale, route.path),
        lastModified,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: { languages: alternates(route.path) },
      });
    }
    for (const entry of getJournalEntries(locale)) {
      const path = `/journal/${entry.slug}`;
      entries.push({
        url: urlFor(locale, path),
        lastModified: new Date(entry.date),
        changeFrequency: 'yearly',
        priority: 0.5,
        alternates: { languages: alternates(path) },
      });
    }
  }

  return entries;
}
