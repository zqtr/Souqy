import type { Locale } from '@/i18n/locales';
import type { Copy } from '@/content/copy';
import { getCopy } from '@/content/copy';
import { Eyebrow } from '@/components/primitives/Eyebrow';
import { Reveal } from '@/components/motion/Reveal';

type Props = {
  locale: Locale;
  copy: Copy;
};

/**
 * Four principle cards on sand. Each card: italic serif numeral,
 * principle line, Arabic countersignature, mono note pinned to bottom.
 */
export function Principles({ locale, copy }: Props) {
  const isRtl = locale === 'ar';
  const echoItems = getCopy(locale === 'en' ? 'ar' : 'en').principles.items;

  return (
    <section
      id="principles"
      className="bg-[color:var(--surface-bg)]"
      style={{
        padding: 'clamp(64px, 11vw, 120px) clamp(20px, 4vw, 48px)',
        borderBottom: '1px solid var(--surface-rule)',
      }}
    >
      <div className="mx-auto" style={{ maxWidth: 1400 }}>
        <Reveal>
          <Eyebrow tone="maroon">{copy.principles.eyebrow}</Eyebrow>
        </Reveal>

        <div
          className="grid gap-10 md:gap-12 mt-8"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
        >
          {copy.principles.items.map((item, i) => {
            const echo = echoItems[i];
            return (
              <Reveal key={item.title} delay={i * 100}>
                <article
                  className="flex h-full flex-col gap-3.5"
                  style={{
                    borderTop: '1px solid var(--surface-rule-strong)',
                    paddingTop: 24,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      fontFamily: 'var(--font-serif), serif',
                      fontStyle: 'italic',
                      fontSize: 22,
                      color: 'var(--color-maroon)',
                    }}
                  >
                    — 0{i + 1}
                  </span>
                  <p
                    className="m-0 text-balance"
                    style={{
                      fontFamily: isRtl
                        ? 'var(--font-arabic), var(--font-sans)'
                        : 'var(--font-sans)',
                      fontSize: 'clamp(22px, 2vw, 30px)',
                      fontWeight: 400,
                      letterSpacing: isRtl ? 0 : '-0.02em',
                      lineHeight: isRtl ? 1.45 : 1.2,
                      color: 'var(--ink-strong)',
                    }}
                  >
                    {item.title}
                  </p>
                  {echo !== undefined && (
                    <p
                      dir={isRtl ? 'ltr' : 'rtl'}
                      className="m-0"
                      style={{
                        fontFamily: isRtl
                          ? 'var(--font-sans)'
                          : 'var(--font-arabic), var(--font-sans)',
                        fontSize: 15,
                        color: 'var(--ink-muted)',
                        lineHeight: 1.5,
                      }}
                    >
                      {echo.title}
                    </p>
                  )}
                  <p
                    className="font-mono text-[11px] mt-auto"
                    style={{
                      color: 'var(--ink-faint)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {item.note}
                  </p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
