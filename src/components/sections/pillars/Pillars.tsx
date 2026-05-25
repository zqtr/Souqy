import type { Locale } from '@/i18n/locales';
import type { Copy } from '@/content/copy';
import { getCopy } from '@/content/copy';
import { Eyebrow } from '@/components/primitives/Eyebrow';
import { Reveal } from '@/components/motion/Reveal';
import { parseHeadline } from '@/lib/headline';
import { PillarRow } from './PillarRow';

type Props = {
  locale: Locale;
  copy: Copy;
};

const PILLAR_ORDER = ['human', 'social', 'economic', 'environmental'] as const;

export function Pillars({ locale, copy }: Props) {
  const isRtl = locale === 'ar';
  const echo = getCopy(isRtl ? 'en' : 'ar').pillars;
  const aside = echo.aside;
  const asideLabel = copy.pillars.asideLabel;

  return (
    <section
      id="pillars"
      className="souqna-pillars bg-[color:var(--surface-bg)]"
      style={{ padding: 'clamp(72px, 12vw, 140px) clamp(20px, 4vw, 48px)' }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media (max-width: 767px) {
          .souqna-pillars header { margin-bottom: 48px !important; }
        }
      `,
        }}
      />
      <div className="mx-auto" style={{ maxWidth: 1600 }}>
        <header className="flex flex-wrap items-end justify-between gap-y-6 gap-x-10 mb-20">
          <div className="max-w-[1000px]">
            <Reveal>
              <Eyebrow tone="maroon">{copy.pillars.eyebrow}</Eyebrow>
            </Reveal>
            <Reveal delay={120}>
              <h2
                className="m-0 text-balance text-[color:var(--ink-strong)] mt-6"
                style={{
                  fontFamily: isRtl
                    ? 'var(--font-arabic), var(--font-sans)'
                    : 'var(--font-sans)',
                  fontWeight: isRtl ? 500 : 400,
                  fontSize: 'clamp(40px, 5.6vw, 88px)',
                  lineHeight: isRtl ? 1.15 : 0.95,
                  letterSpacing: isRtl ? '-0.005em' : '-0.04em',
                }}
              >
                {parseHeadline(copy.pillars.title, {
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
          <Reveal delay={240}>
            <div
              className={`flex items-center gap-3.5 ${isRtl ? 'text-left' : 'text-right'}`}
              style={{ alignSelf: 'flex-end' }}
            >
              <span
                aria-hidden
                className="inline-block h-px w-8 shrink-0"
                style={{ background: 'var(--color-maroon)', opacity: 0.5 }}
              />
              <div className="flex flex-col">
                <span
                  className="font-mono uppercase"
                  style={{
                    color: 'var(--color-maroon)',
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    opacity: 0.85,
                    fontFamily: isRtl
                      ? 'var(--font-arabic), var(--font-mono)'
                      : 'var(--font-mono)',
                  }}
                >
                  {asideLabel}
                </span>
                <span
                  dir={isRtl ? 'ltr' : 'rtl'}
                  style={{
                    fontFamily: isRtl
                      ? 'var(--font-sans)'
                      : 'var(--font-arabic), var(--font-sans)',
                    fontWeight: 400,
                    fontSize: 'clamp(16px, 1.6vw, 26px)',
                    lineHeight: 1.4,
                    color: 'var(--ink-muted)',
                    marginTop: 4,
                  }}
                >
                  {aside}
                </span>
              </div>
            </div>
          </Reveal>
        </header>

        <div className="flex flex-col">
          {PILLAR_ORDER.map((key, i) => (
            <PillarRow
              key={key}
              locale={locale}
              pillarKey={key}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
