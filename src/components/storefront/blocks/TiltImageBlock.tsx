'use client';

import { useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { BlockRenderProps } from './BlockContext';
import type { TiltImageProps } from '@/lib/blocks/types';

/**
 * Single image rendered as a card that lifts and tilts on hover. The
 * tilt direction is an authoring choice (left / right / none) — for
 * cursor-following 3D parallax use `animatedImage` with
 * `effect: 'tilt'` instead. Optional headline + subhead overlay sits
 * on top of the image with an optional scrim so copy stays legible
 * over busy photography or as the focal element on a flat colour.
 *
 * Pro-tier only — `saveDraftBlocks` rewrites this row to a plain
 * `image` at save time when the founder's plan can't reach pro, so
 * the stored draft never breaks on churn-down.
 */
export function TiltImageBlock({
  block,
  ctx,
}: BlockRenderProps<TiltImageProps>) {
  const { isRtl } = ctx;
  const props = block.props;
  const tiltDirection = props.tiltDirection ?? 'right';
  const intensity = props.intensity ?? 'medium';
  const aspect = props.aspect ?? '16/9';
  const width = props.width ?? 'wide';
  const scrim = props.scrim ?? (props.title || props.subtitle ? 'soft' : 'none');

  return (
    <Tilt
      imageUrl={props.imageUrl}
      alt={props.alt}
      title={props.title}
      subtitle={props.subtitle}
      cta={props.cta}
      scrim={scrim}
      tiltDirection={tiltDirection}
      intensity={intensity}
      aspect={aspect}
      width={width}
      isRtl={isRtl}
    />
  );
}

const WIDTH_CLAMP: Record<NonNullable<TiltImageProps['width']>, string> = {
  narrow: 'min(100%, 560px)',
  wide: 'min(100%, 880px)',
  full: '100%',
};

// Lift (px) and tilt (deg) per intensity. Tilt is applied as a 3D
// rotateY (so the corner the founder picked rises out of the page) +
// a slight rotateX for a bit of forward dip — matches the way a
// physical card moves when you press the opposite corner.
const STRENGTH: Record<
  NonNullable<TiltImageProps['intensity']>,
  { lift: number; rotY: number; rotX: number; perspective: number }
> = {
  subtle: { lift: 6, rotY: 4, rotX: 1.5, perspective: 1400 },
  medium: { lift: 10, rotY: 7, rotX: 2.5, perspective: 1200 },
  strong: { lift: 16, rotY: 11, rotX: 4, perspective: 1000 },
};

function Tilt({
  imageUrl,
  alt,
  title,
  subtitle,
  cta,
  scrim,
  tiltDirection,
  intensity,
  aspect,
  width,
  isRtl,
}: {
  imageUrl: string;
  alt?: string;
  title?: string;
  subtitle?: string;
  cta?: TiltImageProps['cta'];
  scrim: 'none' | 'soft' | 'strong';
  tiltDirection: 'left' | 'right' | 'none';
  intensity: 'subtle' | 'medium' | 'strong';
  aspect: NonNullable<TiltImageProps['aspect']>;
  width: NonNullable<TiltImageProps['width']>;
  isRtl: boolean;
}) {
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const serifFamily = isRtl ? 'var(--font-arabic-serif), serif' : 'var(--font-serif), serif';

  const dirSign = tiltDirection === 'left' ? -1 : tiltDirection === 'right' ? 1 : 0;
  const { lift, rotY, rotX, perspective } = STRENGTH[intensity];
  const maxWidth = WIDTH_CLAMP[width];
  const aspectValue = aspect === 'auto' ? undefined : aspect.replace('/', ' / ');

  // Build the resting / hover transforms separately so the transition
  // interpolates smoothly. `perspective(...)` lives on the wrapper so
  // children share the same vanishing point for the rotateY effect.
  const transform = reduced || !hovered
    ? 'translateY(0) rotateX(0deg) rotateY(0deg)'
    : `translateY(-${lift}px) rotateX(${rotX}deg) rotateY(${rotY * dirSign}deg)`;

  const ctaHref = cta?.scrollTo ? `#b-${cta.scrollTo}` : cta?.href;
  const wrapperAsLink = !!ctaHref;

  const inner = (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: imageUrl
            ? undefined
            : 'linear-gradient(135deg, color-mix(in srgb, var(--sf-accent) 22%, transparent), color-mix(in srgb, var(--sf-ink) 14%, transparent) 70%)',
        }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={alt ?? title ?? ''}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              transform: hovered && !reduced ? 'scale(1.04)' : 'scale(1)',
              transition: reduced ? 'none' : 'transform 600ms ease',
            }}
          />
        ) : null}
      </div>

      {scrim !== 'none' && (title || subtitle) ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              scrim === 'strong'
                ? 'linear-gradient(180deg, color-mix(in srgb, var(--sf-ink) 35%, transparent) 0%, color-mix(in srgb, var(--sf-ink) 65%, transparent) 100%)'
                : 'linear-gradient(180deg, color-mix(in srgb, var(--sf-ink) 12%, transparent) 0%, color-mix(in srgb, var(--sf-ink) 45%, transparent) 100%)',
          }}
        />
      ) : null}

      {title || subtitle ? (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: 'clamp(24px, 4vw, 48px)',
            color: 'var(--sf-ground)',
            gap: 16,
          }}
        >
          {title ? (
            <h3
              style={{
                margin: 0,
                fontFamily: serifFamily,
                fontWeight: 700,
                fontSize: 'clamp(24px, 3.4vw, 44px)',
                lineHeight: 1.1,
                letterSpacing: '-0.01em',
                textTransform: 'uppercase',
                color: 'var(--sf-ground)',
              }}
            >
              {title}
            </h3>
          ) : null}
          {subtitle ? (
            <p
              style={{
                margin: 0,
                fontFamily,
                fontSize: 'clamp(14px, 1.6vw, 18px)',
                lineHeight: 1.55,
                maxWidth: 520,
                color: 'color-mix(in srgb, var(--sf-ground) 88%, transparent)',
              }}
            >
              {subtitle}
            </p>
          ) : null}
          {cta?.label ? (
            <span
              style={{
                marginTop: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--sf-ground)',
                background: 'color-mix(in srgb, var(--sf-ground) 14%, transparent)',
                border: '1px solid color-mix(in srgb, var(--sf-ground) 60%, transparent)',
                borderRadius: 999,
                transform: hovered && !reduced ? 'translateY(-2px)' : 'translateY(0)',
                transition: reduced ? 'none' : 'transform 280ms ease',
              }}
            >
              {cta.label}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    display: 'block',
    width: '100%',
    aspectRatio: aspectValue,
    borderRadius: 18,
    overflow: 'hidden',
    transformStyle: 'preserve-3d',
    transform,
    boxShadow: hovered
      ? '0 40px 80px -32px color-mix(in srgb, var(--sf-ink) 60%, transparent)'
      : '0 16px 36px -22px color-mix(in srgb, var(--sf-ink) 45%, transparent)',
    transition: reduced
      ? 'none'
      : 'transform 540ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 320ms ease',
    color: 'var(--sf-ground)',
    textDecoration: 'none',
    background: 'color-mix(in srgb, var(--sf-ink) 10%, transparent)',
  };

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
          width: maxWidth,
          perspective: `${perspective}px`,
          perspectiveOrigin: 'center center',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        {wrapperAsLink ? (
          <a href={ctaHref} aria-label={cta?.label || title || alt || 'Open'} style={cardStyle}>
            {inner}
          </a>
        ) : (
          <div style={cardStyle}>{inner}</div>
        )}
      </div>
    </section>
  );
}
