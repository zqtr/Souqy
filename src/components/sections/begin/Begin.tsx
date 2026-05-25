import type { Locale } from '@/i18n/locales';
import type { Copy } from '@/content/copy';
import { Eyebrow } from '@/components/primitives/Eyebrow';
import { Reveal } from '@/components/motion/Reveal';
import { Spotlight } from '@/components/motion/Spotlight';
import { parseHeadline } from '@/lib/headline';
import { palette } from '@/lib/tokens';
import type { Plan } from '@/lib/plans';
import { BeginIntake } from './BeginIntake';
import { BeginArch } from './BeginArch';

type Props = {
  locale: Locale;
  copy: Copy;
  currentPlan?: Plan;
};

/**
 * Begin section — the home-page closer that opens the onboarding flow.
 *
 * Composition (Option C — Threshold arch):
 *   - Centered header (eyebrow + title + lede) above an SVG arch that
 *     draws itself in as the section enters viewport.
 *   - The intake card sits inside the arch's interior with a slightly
 *     warmer sand-tinted backdrop, so the form reads as "the room
 *     beyond the door".
 *   - Two vertical mono rails run up the section's left and right
 *     edges (RTL-mirrored). They hide on `< 1024px` to avoid crowding
 *     the card on tablets.
 *
 * `BeginIntake` is unchanged — the form, slug checker, CSV import,
 * and template picker all keep behaving the same way.
 */
export function Begin({ locale, copy, currentPlan = 'free' }: Props) {
  const isRtl = locale === 'ar';
  const fontFamily = isRtl
    ? 'var(--font-arabic), var(--font-sans)'
    : 'var(--font-sans)';

  return (
    <Spotlight
      className="bg-[color:var(--surface-contrast)] text-[color:var(--ink-on-contrast)]"
      color="rgba(201,169,97,0.10)"
      radiusPx={680}
    >
      <section
        id="begin"
        className="relative z-[2] overflow-hidden"
        style={{
          padding:
            'clamp(72px, 12vw, 120px) clamp(20px, 4vw, 48px) clamp(80px, 14vw, 140px)',
        }}
      >
        <SideRail side="left" text={copy.begin.frameLeft} isRtl={isRtl} />
        <SideRail side="right" text={copy.begin.frameRight} isRtl={isRtl} />

        <div
          className="relative mx-auto"
          style={{ maxWidth: 1040 }}
        >
          <BeginArch isRtl={isRtl} />

          <div className="relative" style={{ zIndex: 2 }}>
            <header
              className="text-center mx-auto"
              style={{ maxWidth: 720, marginBottom: 'clamp(36px, 5vw, 64px)' }}
            >
              <Reveal>
                <div className="flex justify-center">
                  <Eyebrow tone="gold">{copy.begin.eyebrow}</Eyebrow>
                </div>
              </Reveal>
              <Reveal delay={120}>
                <h1
                  className="text-balance"
                  style={{
                    fontFamily,
                    fontWeight: isRtl ? 400 : 300,
                    fontSize: 'clamp(40px, 5.6vw, 78px)',
                    lineHeight: isRtl ? 1.18 : 0.98,
                    letterSpacing: isRtl ? '-0.005em' : '-0.04em',
                    color: 'var(--ink-on-contrast)',
                    margin: '24px 0 18px',
                  }}
                >
                  {parseHeadline(copy.begin.title, {
                    accentStyle: {
                      fontFamily: isRtl
                        ? 'var(--font-arabic-serif), serif'
                        : 'var(--font-serif), serif',
                      fontStyle: 'italic',
                      fontWeight: 400,
                      color: 'var(--color-gold)',
                    },
                  })}
                </h1>
              </Reveal>
              <Reveal delay={200}>
                <span
                  aria-hidden
                  className="block mx-auto"
                  style={{
                    width: 'clamp(80px, 8vw, 120px)',
                    height: 1,
                    background: `linear-gradient(90deg, transparent, ${palette.gold}, transparent)`,
                    marginBottom: 22,
                  }}
                />
              </Reveal>
              <Reveal delay={260}>
                <p
                  className="mx-auto"
                  style={{
                    fontFamily,
                    fontSize: 18,
                    color: 'var(--ink-on-contrast-muted)',
                    fontWeight: 300,
                    lineHeight: 1.6,
                    margin: 0,
                    maxWidth: 580,
                  }}
                >
                  {copy.begin.sub}
                </p>
              </Reveal>
            </header>

            <Reveal delay={360}>
              <div
                className="mx-auto"
                style={{
                  maxWidth: 920,
                  position: 'relative',
                  background:
                    'radial-gradient(ellipse at top, rgba(241,233,215,0.04), transparent 70%)',
                  padding: 'clamp(8px, 1.5vw, 20px) 0 0',
                }}
              >
                <BeginIntake locale={locale} copy={copy} currentPlan={currentPlan} />
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </Spotlight>
  );
}

/**
 * Vertical brand rail running up one edge of the section. Hidden on
 * `< 1024px` to avoid crowding the intake card on tablets and phones.
 * On RTL pages the left/right slot assignment swaps so the Arabic rail
 * sits on the dominant side.
 */
function SideRail({
  side,
  text,
  isRtl,
}: {
  side: 'left' | 'right';
  text: string;
  isRtl: boolean;
}) {
  const onLeft = isRtl ? side === 'right' : side === 'left';
  return (
    <span
      aria-hidden
      className="souqna-begin-rail hidden lg:block"
      style={{
        position: 'absolute',
        top: '50%',
        [onLeft ? 'left' : 'right']: 'clamp(12px, 2vw, 28px)',
        writingMode: 'vertical-rl',
        transform: onLeft
          ? 'translateY(-50%) rotate(180deg)'
          : 'translateY(-50%)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: 'var(--ink-on-contrast-muted)',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {text}
    </span>
  );
}
