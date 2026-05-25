import Link from 'next/link';
import type { Locale } from '@/i18n/locales';
import type { Copy } from '@/content/copy';
import { Eyebrow } from '@/components/primitives/Eyebrow';
import { Reveal } from '@/components/motion/Reveal';
import { parseHeadline } from '@/lib/headline';
import { getJournalEntries } from '@/lib/journal';

type Props = {
  locale: Locale;
  copy: Copy;
};

/**
 * Home journal teaser. If no MDX entries exist, renders the editorial
 * empty state — a quiet block with the "atelier is still writing"
 * sentence and an outline link to /journal. No placeholder posts.
 *
 * When entries are added, this section will switch to a 3-up grid.
 */
export function JournalTeaser({ locale, copy }: Props) {
  const entries = getJournalEntries(locale);
  const indexHref = locale === 'en' ? '/journal' : `/${locale}/journal`;
  const isRtl = locale === 'ar';

  return (
    <section
      id="journal"
      className="bg-[color:var(--surface-elevated)]"
      style={{ padding: 'clamp(72px, 12vw, 140px) clamp(20px, 4vw, 48px)' }}
    >
      <div className="mx-auto" style={{ maxWidth: 1400 }}>
        <header className="flex flex-wrap items-end justify-between gap-y-6 mb-16">
          <div className="max-w-[800px]">
            <Reveal>
              <Eyebrow tone="maroon">{copy.journal.eyebrow}</Eyebrow>
            </Reveal>
            <Reveal delay={120}>
              <h2
                className="m-0 mt-6 text-balance text-[color:var(--ink-strong)]"
                style={{
                  fontFamily: isRtl
                    ? 'var(--font-arabic), var(--font-sans)'
                    : 'var(--font-sans)',
                  fontWeight: isRtl ? 500 : 400,
                  fontSize: 'clamp(36px, 4.8vw, 72px)',
                  lineHeight: isRtl ? 1.2 : 0.95,
                  letterSpacing: isRtl ? '-0.005em' : '-0.04em',
                }}
              >
                {parseHeadline(copy.journal.title, {
                  accentStyle: {
                    fontFamily: isRtl
                      ? 'var(--font-arabic-serif), serif'
                      : 'var(--font-serif), serif',
                    fontStyle: 'italic',
                    fontWeight: 400,
                    color: 'var(--color-maroon)',
                  },
                })}
              </h2>
            </Reveal>
          </div>

          {entries.length > 0 && (
            <Reveal delay={240}>
              <Link
                href={indexHref}
                className="inline-flex items-center gap-2 text-[13px] text-[color:var(--ink-strong)] no-underline pb-0.5"
                style={{ borderBottom: '1px solid var(--color-gold)' }}
              >
                {copy.journal.indexLink}{' '}
                <span aria-hidden className="rtl-flip-arrow">→</span>
              </Link>
            </Reveal>
          )}
        </header>

        {entries.length === 0 ? (
          <Reveal delay={240}>
            <div
              className="grid gap-10 md:grid-cols-[1.3fr_1fr]"
              style={{
                borderTop: '1px solid var(--surface-rule-strong)',
                paddingTop: 32,
              }}
            >
              <div>
                <p
                  className="m-0 text-balance text-[color:var(--ink-strong)]"
                  style={{
                    fontFamily: isRtl
                      ? 'var(--font-arabic), var(--font-sans)'
                      : 'var(--font-sans)',
                    fontSize: 'clamp(24px, 2.4vw, 36px)',
                    fontWeight: 400,
                    lineHeight: 1.25,
                    letterSpacing: isRtl ? 0 : '-0.02em',
                  }}
                >
                  {copy.journal.empty.title}
                </p>
                <p
                  className="mt-4 max-w-[55ch] text-[color:var(--ink-muted)]"
                  style={{
                    fontFamily: isRtl
                      ? 'var(--font-arabic), var(--font-sans)'
                      : 'var(--font-sans)',
                    fontSize: 16,
                    lineHeight: isRtl ? 1.7 : 1.55,
                  }}
                >
                  {copy.journal.empty.body}
                </p>
              </div>
              <div className={isRtl ? 'md:justify-self-start' : 'md:justify-self-end'}>
                <Link
                  href={indexHref}
                  className="font-mono text-[11px] uppercase no-underline pb-1 text-[color:var(--color-maroon)]"
                  style={{
                    letterSpacing: '0.1em',
                    borderBottom: '1px solid var(--color-gold)',
                  }}
                >
                  {copy.journal.indexLink}{' '}
                  <span aria-hidden className="rtl-flip-arrow">→</span>
                </Link>
              </div>
            </div>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
