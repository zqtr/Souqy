'use client';

import { useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { BlockRenderProps } from './BlockContext';
import type { SpotlightCardProps } from '@/lib/blocks/types';

/**
 * Spotlight content card. Bold accent fill, an optional decorative
 * pattern strip in the top-end corner (stripes / dots / grid), an
 * optional editable date badge, and a staggered "rise" of inner copy
 * on hover. Whole card sits on a small resting tilt and lifts further
 * on hover. Pro-tier — `saveDraftBlocks` rewrites this row to a plain
 * `text` at save time when the founder's plan can't reach pro.
 */
export function SpotlightCardBlock({
  block,
  ctx,
}: BlockRenderProps<SpotlightCardProps>) {
  const { isRtl } = ctx;
  const props = block.props;
  const tiltDirection = props.tiltDirection ?? 'right';
  const intensity = props.intensity ?? 'medium';
  const pattern = props.pattern ?? 'stripes';
  const width = props.width ?? 'wide';
  const accent = props.accentColor?.trim() || 'var(--sf-accent)';
  const showDate =
    props.showDate ?? !!((props.dateMonth || '').trim() || (props.dateDay || '').trim());

  return (
    <Spotlight
      eyebrow={props.eyebrow}
      title={props.title}
      body={props.body}
      cta={props.cta}
      showDate={showDate}
      dateMonth={props.dateMonth?.trim() || ''}
      dateDay={props.dateDay?.trim() || ''}
      pattern={pattern}
      tiltDirection={tiltDirection}
      intensity={intensity}
      accent={accent}
      width={width}
      isRtl={isRtl}
    />
  );
}

const WIDTH_CLAMP: Record<NonNullable<SpotlightCardProps['width']>, string> = {
  narrow: 'min(100%, 420px)',
  wide: 'min(100%, 560px)',
  full: '100%',
};

const STRENGTH: Record<
  NonNullable<SpotlightCardProps['intensity']>,
  { lift: number; rotY: number; rotX: number; restingTilt: number; perspective: number }
> = {
  subtle: { lift: 6, rotY: 4, rotX: 1.5, restingTilt: 1, perspective: 1500 },
  medium: { lift: 12, rotY: 8, rotX: 3, restingTilt: 2, perspective: 1200 },
  strong: { lift: 20, rotY: 12, rotX: 4.5, restingTilt: 3, perspective: 1000 },
};

function Spotlight({
  eyebrow,
  title,
  body,
  cta,
  showDate,
  dateMonth,
  dateDay,
  pattern,
  tiltDirection,
  intensity,
  accent,
  width,
  isRtl,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  cta?: SpotlightCardProps['cta'];
  showDate: boolean;
  dateMonth: string;
  dateDay: string;
  pattern: NonNullable<SpotlightCardProps['pattern']>;
  tiltDirection: NonNullable<SpotlightCardProps['tiltDirection']>;
  intensity: NonNullable<SpotlightCardProps['intensity']>;
  accent: string;
  width: NonNullable<SpotlightCardProps['width']>;
  isRtl: boolean;
}) {
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const serifFamily = isRtl ? 'var(--font-arabic-serif), serif' : 'var(--font-serif), serif';

  const dirSign = tiltDirection === 'left' ? -1 : tiltDirection === 'right' ? 1 : 0;
  const { lift, rotY, rotX, restingTilt, perspective } = STRENGTH[intensity];

  // Resting transform — a small fixed tilt so the card never reads
  // perfectly flat, even before the visitor hovers. Direction follows
  // the founder's pick so the resting and hover states share an axis.
  const restY = restingTilt * (dirSign === 0 ? 1 : dirSign);
  const restingTransform = `rotateY(${restY}deg) rotateX(0.5deg) translateY(0)`;
  const hoverTransform = reduced
    ? restingTransform
    : `rotateY(${(rotY + restingTilt) * (dirSign === 0 ? 0 : dirSign)}deg) rotateX(${rotX}deg) translateY(-${lift}px)`;

  // The decorative pattern strip lives in the top-end corner (logical
  // direction). On RTL it wraps to the top-left so the badge always
  // sits opposite the pattern's narrow point.
  const patternBg = patternBackground(pattern);

  // ── Inner-text "rise" stagger. Each element gets the same easing
  // but a small per-index `transition-delay` so the eyebrow lifts
  // first, then title, then body, then CTA — reads as a soft cascade.
  const riseStyle = (index: number): React.CSSProperties => ({
    transform: hovered && !reduced ? 'translateY(-4px)' : 'translateY(0)',
    opacity: hovered || !reduced ? 1 : 1, // always visible at rest; hover only adds lift
    transition: reduced
      ? 'none'
      : `transform 420ms cubic-bezier(0.22, 1, 0.36, 1) ${index * 60}ms`,
    willChange: reduced ? undefined : 'transform',
  });

  const ctaHref = cta?.scrollTo ? `#b-${cta.scrollTo}` : cta?.href;

  return (
    <section
      style={{
        padding: 'clamp(28px, 4vw, 56px) 0',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: WIDTH_CLAMP[width],
          perspective: `${perspective}px`,
          perspectiveOrigin: 'center center',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <div
          style={{
            position: 'relative',
            aspectRatio: '1 / 1',
            background: accent,
            color: 'var(--sf-ink)',
            border: '2px solid var(--sf-ink)',
            borderRadius: 4,
            transformStyle: 'preserve-3d',
            transform: hovered ? hoverTransform : restingTransform,
            boxShadow: hovered
              ? '0 40px 80px -32px color-mix(in srgb, var(--sf-ink) 65%, transparent)'
              : '0 18px 36px -22px color-mix(in srgb, var(--sf-ink) 50%, transparent)',
            transition: reduced
              ? 'none'
              : 'transform 540ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 320ms ease',
            overflow: 'visible',
          }}
        >
          {pattern !== 'none' ? (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                insetInlineStart: 0,
                width: '70%',
                height: '36%',
                background: patternBg,
                backgroundColor: 'var(--sf-ground)',
                borderInlineEnd: '2px solid var(--sf-ink)',
                borderBottom: '2px solid var(--sf-ink)',
                // Diagonal cut on the inner corner — the side opposite
                // the badge — so the strip doesn't read as a flat
                // rectangle pasted onto the card. RTL flips the cut.
                clipPath: isRtl
                  ? 'polygon(0 0, 100% 0, 100% 100%, 28% 100%, 0 70%)'
                  : 'polygon(0 0, 100% 0, 72% 100%, 0 100%)',
              }}
            />
          ) : null}

          {showDate && (dateMonth || dateDay) ? (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: -10,
                insetInlineEnd: -10,
                minWidth: 64,
                padding: '8px 10px',
                background: 'var(--sf-ink)',
                color: accent,
                border: `2px solid ${accent}`,
                borderRadius: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                lineHeight: 1.05,
                textAlign: 'center',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                boxShadow: '0 6px 14px -6px rgba(0,0,0,0.35)',
                zIndex: 2,
              }}
            >
              {dateMonth ? <span>{dateMonth}</span> : null}
              {dateDay ? (
                <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: 0 }}>
                  {dateDay}
                </span>
              ) : null}
            </div>
          ) : null}

          <div
            style={{
              position: 'absolute',
              insetInline: 0,
              bottom: 0,
              padding: 'clamp(20px, 4vw, 36px)',
              paddingTop: 'clamp(110px, 22%, 180px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 14,
              textAlign: 'start',
            }}
          >
            {eyebrow ? (
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'color-mix(in srgb, var(--sf-ink) 70%, transparent)',
                  ...riseStyle(0),
                }}
              >
                {eyebrow}
              </div>
            ) : null}
            <h3
              style={{
                margin: 0,
                fontFamily: serifFamily,
                fontWeight: 700,
                fontSize: 'clamp(24px, 3.4vw, 36px)',
                lineHeight: 1.1,
                letterSpacing: '-0.01em',
                ...riseStyle(1),
              }}
            >
              {title}
            </h3>
            {body ? (
              <p
                style={{
                  margin: 0,
                  fontFamily,
                  fontSize: 'clamp(14px, 1.6vw, 17px)',
                  lineHeight: 1.55,
                  color: 'color-mix(in srgb, var(--sf-ink) 82%, transparent)',
                  maxWidth: '92%',
                  ...riseStyle(2),
                }}
              >
                {body}
              </p>
            ) : null}
            {cta?.label ? (
              <a
                href={ctaHref || '#'}
                style={{
                  marginTop: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 20px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: accent,
                  background: 'var(--sf-ink)',
                  textDecoration: 'none',
                  borderRadius: 2,
                  border: `2px solid var(--sf-ink)`,
                  ...riseStyle(3),
                }}
              >
                {cta.label}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function patternBackground(kind: NonNullable<SpotlightCardProps['pattern']>): string {
  switch (kind) {
    case 'stripes':
      // Bold diagonal stripes — repeating-linear-gradient is a CSS
      // primitive, not copyable from any source.
      return 'repeating-linear-gradient(135deg, var(--sf-ink) 0 10px, var(--sf-ground) 10px 20px)';
    case 'dots':
      return 'radial-gradient(var(--sf-ink) 1.6px, transparent 1.8px) 0 0 / 12px 12px';
    case 'grid':
      return 'linear-gradient(var(--sf-ink) 1px, transparent 1px) 0 0 / 14px 14px, linear-gradient(90deg, var(--sf-ink) 1px, transparent 1px) 0 0 / 14px 14px';
    case 'none':
    default:
      return 'transparent';
  }
}
