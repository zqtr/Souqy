import type { Locale } from '@/i18n/locales';
import type { Copy } from '@/content/copy';
import { getCopy } from '@/content/copy';
import { Eyebrow } from '@/components/primitives/Eyebrow';
import { Reveal } from '@/components/motion/Reveal';
import { parseHeadline } from '@/lib/headline';
import { palette } from '@/lib/tokens';

type Props = {
  locale: Locale;
  copy: Copy;
};

/**
 * Maroon-saturated section. Establishes the team-as-atelier framing.
 * Three values stacked beneath the headline; large arch watermark in
 * the trailing corner.
 */
export function Atelier({ locale, copy }: Props) {
  const isRtl = locale === 'ar';
  const echo = getCopy(locale === 'en' ? 'ar' : 'en');

  return (
    <section
      id="atelier"
      className="relative overflow-hidden text-[color:var(--color-sand-pale)]"
      style={{
        background: 'var(--color-maroon)',
        padding: 'clamp(80px, 14vw, 160px) clamp(20px, 4vw, 48px)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: isRtl ? 'auto' : '-10vw',
          right: isRtl ? '-10vw' : 'auto',
          bottom: '-20vh',
          width: '60vw',
          height: '110vh',
          opacity: 0.22,
          transform: isRtl ? 'scaleX(-1)' : undefined,
        }}
      >
        <svg viewBox="0 0 400 600" width="100%" height="100%" fill="none">
          <path
            d="M 40 580 L 40 260 A 160 160 0 0 1 360 260 L 360 580"
            stroke={palette.gold}
            strokeWidth="1"
          />
          <path
            d="M 90 580 L 90 290 A 110 110 0 0 1 310 290 L 310 580"
            stroke={palette.gold}
            strokeWidth="1"
            opacity="0.55"
          />
          <path
            d="M 140 580 L 140 320 A 60 60 0 0 1 260 320 L 260 580"
            stroke={palette.gold}
            strokeWidth="1"
            opacity="0.3"
          />
        </svg>
      </div>

      <div className="relative z-[2] mx-auto" style={{ maxWidth: 1400 }}>
        <Reveal>
          <Eyebrow tone="gold">{copy.atelier.eyebrow}</Eyebrow>
        </Reveal>
        <Reveal delay={120}>
          <h2
            className="text-balance"
            style={{
              fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
              fontWeight: isRtl ? 400 : 300,
              fontSize: 'clamp(40px, 6vw, 104px)',
              lineHeight: isRtl ? 1.2 : 0.96,
              letterSpacing: isRtl ? '-0.005em' : '-0.04em',
              color: 'var(--color-sand-pale)',
              margin: '24px 0 40px',
              maxWidth: 1100,
            }}
          >
            {parseHeadline(copy.atelier.title, {
              accentStyle: {
                fontFamily: isRtl
                  ? 'var(--font-arabic-serif), serif'
                  : 'var(--font-serif), serif',
                fontStyle: 'italic',
                fontWeight: 400,
                color: 'var(--color-gold)',
              },
            })}
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p
            dir={isRtl ? 'ltr' : 'rtl'}
            style={{
              fontFamily: isRtl ? 'var(--font-sans)' : 'var(--font-arabic), var(--font-sans)',
              fontSize: 'clamp(20px, 2.2vw, 34px)',
              color: 'rgba(232,220,196,0.72)',
              fontWeight: 300,
              marginBottom: 80,
              maxWidth: 900,
              lineHeight: 1.45,
            }}
          >
            {echo.atelier.sub}
          </p>
        </Reveal>

        <div
          className="grid gap-10 md:grid-cols-3"
          style={{
            borderTop: `1px solid ${palette.gold}55`,
            paddingTop: 48,
          }}
        >
          {copy.atelier.values.map((value, i) => {
            const echoValue = echo.atelier.values[i];
            return (
              <Reveal key={`${i}-${value}`} delay={i * 120}>
                <div>
                  <div
                    aria-hidden
                    style={{
                      fontFamily: 'var(--font-serif), serif',
                      fontStyle: 'italic',
                      fontSize: 22,
                      color: 'var(--color-gold)',
                      marginBottom: 12,
                    }}
                  >
                    — 0{i + 1}
                  </div>
                  <p
                    className="m-0 text-pretty"
                    style={{
                      fontFamily: isRtl
                        ? 'var(--font-arabic), var(--font-sans)'
                        : 'var(--font-sans)',
                      fontSize: 22,
                      lineHeight: isRtl ? 1.65 : 1.35,
                      color: 'var(--color-sand-pale)',
                      fontWeight: 400,
                      letterSpacing: isRtl ? 0 : '-0.015em',
                    }}
                  >
                    {value}
                  </p>
                  {echoValue !== undefined && (
                    <p
                      dir={isRtl ? 'ltr' : 'rtl'}
                      className="mt-2 m-0"
                      style={{
                        fontFamily: isRtl
                          ? 'var(--font-sans)'
                          : 'var(--font-arabic), var(--font-sans)',
                        fontSize: 15,
                        color: 'rgba(232,220,196,0.6)',
                      }}
                    >
                      {echoValue}
                    </p>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
