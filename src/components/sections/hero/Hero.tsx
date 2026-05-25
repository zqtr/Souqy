import type { Copy } from '@/content/copy';
import type { Locale } from '@/i18n/locales';
import { getCopy } from '@/content/copy';
import { Eyebrow } from '@/components/primitives/Eyebrow';
import { Reveal } from '@/components/motion/Reveal';
import { Kinetic } from '@/components/motion/Kinetic';
import { HeroArch } from './HeroArch';
import { HeroTopRail } from './HeroTopRail';
import { HeroFlowRail } from './HeroFlowRail';

type Props = {
  locale: Locale;
  copy: Copy;
};

export function Hero({ locale, copy }: Props) {
  const isRtl = locale === 'ar';
  const echoLocale: Locale = locale === 'en' ? 'ar' : 'en';
  const echo = getCopy(echoLocale).hero;

  const splitMode = isRtl ? 'word' : 'char';
  const echoIsRtl = echoLocale === 'ar';

  const bilingualFraming = `${copy.meta.framing} / ${getCopy(echoLocale).meta.framing}`;

  const isAr = isRtl;
  const headlineFontFamily = isAr
    ? 'var(--font-arabic), var(--font-sans)'
    : 'var(--font-sans)';
  const accentFontFamily = isAr
    ? 'var(--font-arabic-serif), var(--font-arabic), serif'
    : 'var(--font-serif), serif';

  return (
    <section
      className="souqna-hero relative overflow-hidden flex flex-col bg-[color:var(--surface-bg)]"
      style={{
        minHeight: '100vh',
        padding: '120px clamp(20px, 4vw, 48px) 48px',
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media (max-width: 767px) {
          .souqna-hero { padding-top: 96px !important; padding-bottom: 64px !important; min-height: auto !important; }
          .souqna-hero-line2 { display: inline !important; }
          .souqna-hero-bottom { grid-template-columns: 1fr !important; padding-top: 48px !important; gap: 28px !important; }
          .souqna-hero-cta { align-items: flex-start !important; }
          .souqna-hero-rail { align-items: flex-start !important; }
          .souqna-hero-rail-pills { gap: 6px !important; }
          .souqna-hero-rail-link { display: none !important; }
        }
      `,
        }}
      />
      <HeroArch locale={locale} />

      <HeroTopRail copy={copy} bilingualFraming={bilingualFraming} />

      <div className="relative z-[2]" style={{ maxWidth: 'min(1400px, 92vw)' }}>
        <Reveal>
          <Eyebrow tone="maroon">{copy.hero.eyebrow}</Eyebrow>
        </Reveal>

        <h1
          className="m-0 text-balance text-[color:var(--ink-strong)] mt-7"
          style={{
            fontFamily: headlineFontFamily,
            fontWeight: isAr ? 500 : 400,
            fontSize: 'clamp(40px, 9.2vw, 156px)',
            lineHeight: isAr ? 1.05 : 0.92,
            letterSpacing: isAr ? '-0.01em' : '-0.045em',
          }}
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          <Kinetic text={copy.hero.line1} delay={120} stagger={isAr ? 60 : 28} splitBy={splitMode} />
          <br />
          <span className="souqna-hero-line2 inline-flex items-baseline flex-wrap" style={{ gap: '0.18em' }}>
            <Kinetic text={copy.hero.line2a} delay={900} stagger={isAr ? 60 : 28} splitBy={splitMode} />
            <span className="relative inline-block" style={{ padding: '0 0.12em' }}>
              <Kinetic
                text={copy.hero.line2b}
                delay={1100}
                stagger={isAr ? 70 : 32}
                splitBy={splitMode}
                style={{
                  fontFamily: accentFontFamily,
                  fontStyle: 'italic',
                  fontWeight: 400,
                  color: 'var(--color-maroon)',
                }}
              />
              <span
                aria-hidden
                className="absolute inset-x-0"
                style={{
                  bottom: '0.06em',
                  height: '0.06em',
                  background: 'var(--color-gold)',
                  opacity: 0.7,
                }}
              />
            </span>
            <Kinetic text={copy.hero.line2c} delay={1400} stagger={isAr ? 60 : 28} splitBy={splitMode} />
          </span>
        </h1>

        {/* Cross-language echo: subtle, smaller, the other script as countersignature */}
        <div
          dir={echoIsRtl ? 'rtl' : 'ltr'}
          className="mt-9 text-[color:var(--ink-muted)]"
          style={{
            fontFamily: echoIsRtl
              ? 'var(--font-arabic), var(--font-sans)'
              : 'var(--font-sans)',
            fontWeight: 300,
            fontSize: 'clamp(20px, 2.4vw, 36px)',
            lineHeight: 1.3,
            letterSpacing: echoIsRtl ? 0 : '-0.01em',
          }}
        >
          <Reveal delay={1700} y={14}>
            <span>{echo.line1} </span>
            <span
              style={{
                fontFamily: echoIsRtl
                  ? 'var(--font-arabic-serif), serif'
                  : 'var(--font-serif), serif',
                fontStyle: 'italic',
                fontWeight: 400,
                color: 'var(--color-maroon)',
              }}
            >
              {echo.line2a} {echo.line2b}
            </span>{' '}
            <span>{echo.line2c}</span>
          </Reveal>
        </div>
      </div>

      <div
        className="souqna-hero-bottom relative z-[2] mt-auto pt-[12vh] grid gap-10 items-end"
        style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)' }}
      >
        <Reveal delay={1900}>
          <p
            className="m-0 text-[color:var(--ink-muted)] text-pretty"
            style={{
              fontFamily: isAr ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
              fontSize: 15,
              lineHeight: isAr ? 1.7 : 1.55,
              maxWidth: 380,
              fontWeight: isAr ? 400 : 400,
            }}
          >
            {copy.hero.body}
          </p>
        </Reveal>
        <div
          className={isRtl ? 'justify-self-start' : 'justify-self-end'}
          style={{ width: '100%', maxWidth: 520 }}
        >
          <HeroFlowRail locale={locale} copy={copy} />
        </div>
      </div>
    </section>
  );
}
