/**
 * Stub journal index. When MDX entries are added under
 * /content/journal/<locale>/<slug>.mdx the loader here will surface
 * them. Until then, the home teaser renders the empty state and the
 * /journal route shows "the atelier is still writing."
 *
 * No placeholder posts. No fabricated metrics.
 */
import type { Locale } from '@/i18n/locales';

export type JournalEntry = {
  slug: string;
  title: string;
  description: string;
  date: string;
  tag: string;
  readMinutes: number;
  echoTitle?: string;
};

export function getJournalEntries(locale: Locale): readonly JournalEntry[] {
  void locale;
  return [];
}

export function hasJournalEntries(locale: Locale): boolean {
  return getJournalEntries(locale).length > 0;
}
