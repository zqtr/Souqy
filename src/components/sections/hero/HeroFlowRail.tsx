'use client';

import type { Copy } from '@/content/copy';
import type { Locale } from '@/i18n/locales';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { Reveal } from '@/components/motion/Reveal';
import { palette } from '@/lib/tokens';

type Props = {
  locale: Locale;
  copy: Copy;
};

/**
 * Hero CTA — a single light pill that fuses the four-step rail
 * (01 → 02 → 03 → 04) with the primary action. The active step
 * auto-cycles, the gold gradient breathes, and the cursor pulls
 * the whole pill magnetically. One button, one sentence:
 * "this is what happens — start it now."
 */
export function HeroFlowRail({ locale, copy }: Props) {
  const isRtl = locale === 'ar';
  const reduced = useReducedMotion();
  const contactHref = locale === 'en' ? '/begin' : `/${locale}/begin`;
  const steps = copy.hero.flowSteps;
  const fontFamily = isRtl
    ? 'var(--font-arabic), var(--font-sans)'
    : 'var(--font-sans)';

  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 280, damping: 24, mass: 0.45 });
  const sy = useSpring(y, { stiffness: 280, damping: 24, mass: 0.45 });

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % steps.length);
    }, 1500);
    return () => window.clearInterval(id);
  }, [reduced, steps.length]);

  function onMove(e: React.MouseEvent<HTMLElement>) {
    if (reduced) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) * 0.08);
    y.set((e.clientY - cy) * 0.18);
  }
  function onLeave() {
    x.set(0);
    y.set(0);
    setHovered(false);
  }

  const stepWidth = 100 / steps.length;

  return (
    <Reveal delay={2100} className="souqna-hero-cta">
      <div
        className={`flex flex-col gap-3 ${isRtl ? 'items-start' : 'items-end'}`}
        style={{ width: '100%' }}
      >
        <Link
          href={contactHref}
          aria-label={`${copy.hero.primaryCta} — ${copy.hero.flowAriaLabel}`}
          onMouseMove={onMove}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={onLeave}
          className="souqna-hero-flow-cta inline-block no-underline"
        >
          <motion.div
            ref={ref}
            style={{
              x: sx,
              y: sy,
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'stretch',
              gap: 0,
              padding: 6,
              borderRadius: 999,
              background: `linear-gradient(135deg, ${palette.sandPale} 0%, ${palette.sand} 50%, ${palette.sandDeep} 100%)`,
              boxShadow: hovered
                ? `inset 0 0 0 1px rgba(201,169,97,0.55), 0 0 0 4px rgba(201,169,97,0.18), 0 18px 36px rgba(31,27,22,0.14), 0 1px 0 rgba(255,255,255,0.6) inset`
                : `inset 0 0 0 1px rgba(201,169,97,0.45), 0 1px 0 rgba(255,255,255,0.55) inset, 0 8px 18px rgba(31,27,22,0.10)`,
              transition: 'box-shadow 320ms ease',
              cursor: 'pointer',
              direction: isRtl ? 'rtl' : 'ltr',
            }}
          >
            {/* Steps capsule */}
            <div
              className="souqna-hero-flow-steps"
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 10px',
                borderRadius: 999,
                background: 'rgba(255,253,247,0.6)',
                border: '1px solid rgba(31,27,22,0.06)',
              }}
            >
              {/* sliding highlight */}
              <motion.span
                aria-hidden
                initial={false}
                animate={{
                  left: `calc(${active * stepWidth}% + 4px)`,
                  width: `calc(${stepWidth}% - 8px)`,
                }}
                transition={{ type: 'spring', stiffness: 220, damping: 26, mass: 0.6 }}
                style={{
                  position: 'absolute',
                  top: 4,
                  bottom: 4,
                  borderRadius: 999,
                  background: `linear-gradient(180deg, ${palette.gold} 0%, ${palette.goldDeep} 100%)`,
                  boxShadow:
                    'inset 0 0 0 1px rgba(31,27,22,0.18), 0 1px 0 rgba(255,255,255,0.45) inset, 0 4px 10px rgba(168,137,63,0.28)',
                }}
              />
              <ol
                aria-label={copy.hero.flowAriaLabel}
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  zIndex: 1,
                }}
              >
                {steps.map((label, i) => {
                  const isActive = i === active;
                  return (
                    <li
                      key={label}
                      onMouseEnter={() => setActive(i)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '6px 10px',
                        minWidth: 78,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10.5,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: isActive ? 'var(--ink-on-gold)' : 'rgba(31,27,22,0.55)',
                        transition: 'color 280ms ease',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          fontFamily: 'var(--font-serif), serif',
                          fontStyle: 'italic',
                          fontSize: 12,
                          color: isActive ? palette.maroon : 'rgba(139,58,58,0.55)',
                          letterSpacing: 0,
                          fontWeight: 400,
                          transition: 'color 280ms ease',
                        }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span
                        style={{
                          fontFamily,
                          letterSpacing: isRtl ? 0 : '0.08em',
                        }}
                      >
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* CTA capsule */}
            <div
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12,
                padding: '0 18px 0 16px',
                marginInlineStart: 4,
                color: 'var(--ink-on-gold)',
                fontFamily: isRtl
                  ? 'var(--font-arabic), var(--font-sans)'
                  : 'var(--font-sans)',
                fontWeight: 500,
                fontSize: 14,
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 1,
                  height: 18,
                  background: 'rgba(31,27,22,0.18)',
                  marginInlineEnd: 4,
                }}
              />
              <span style={{ position: 'relative', zIndex: 1 }}>
                {copy.hero.primaryCta}
              </span>
              <motion.span
                aria-hidden
                className="rtl-flip-arrow"
                animate={{
                  x: hovered ? (isRtl ? -3 : 3) : 0,
                  backgroundColor: hovered ? palette.ink : palette.gold,
                  color: hovered ? palette.gold : palette.ink,
                }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                style={{
                  position: 'relative',
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  border: '1px solid rgba(31,27,22,0.32)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  lineHeight: 1,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
                }}
              >
                →
              </motion.span>
            </div>

            {/* breathing gold halo */}
            {!reduced ? (
              <motion.span
                aria-hidden
                animate={{ opacity: [0.0, 0.35, 0.0] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  position: 'absolute',
                  inset: -2,
                  borderRadius: 999,
                  background:
                    'radial-gradient(60% 90% at 50% 50%, rgba(201,169,97,0.35) 0%, rgba(201,169,97,0) 70%)',
                  pointerEvents: 'none',
                }}
              />
            ) : null}
          </motion.div>
        </Link>

        <a
          href="#process"
          className="font-mono uppercase text-[color:var(--ink-faint)] no-underline tracking-[0.1em]"
          style={{ fontSize: 10 }}
        >
          {copy.hero.secondaryCta}
        </a>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media (max-width: 767px) {
          .souqna-hero-flow-cta > div {
            flex-wrap: wrap;
            gap: 8px;
          }
          .souqna-hero-flow-steps {
            order: 2;
            width: 100%;
            justify-content: space-between;
          }
          .souqna-hero-flow-steps ol {
            width: 100%;
            justify-content: space-between;
          }
          .souqna-hero-flow-steps ol li {
            min-width: 0 !important;
            padding: 6px 6px !important;
          }
        }
      `,
        }}
      />
    </Reveal>
  );
}
