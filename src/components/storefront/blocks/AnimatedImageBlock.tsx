'use client';

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { useRef, type CSSProperties, type MouseEvent } from 'react';
import type { BlockRenderProps } from './BlockContext';
import type { AnimatedImageProps } from '@/lib/blocks/types';

/**
 * Pro-tier animated image block. The effect catalogue:
 *
 *   - `parallax` : image translates against scroll position; subtle on
 *                  mobile via reduced-motion fallback.
 *   - `magnetic` : cursor-magnetic translate within the wrapper.
 *   - `kenburns` : slow zoom + pan loop (no interaction).
 *   - `tilt`     : 3-D rotateX/rotateY tilt that follows the cursor.
 *
 * Width and aspect mirror the plain `image` block. Reduced-motion users
 * always see a static crop. The block degrades to a plain image when
 * the storefront's plan no longer covers Pro+ (server-side gate in
 * `saveDraftBlocks`); the renderer here assumes a Pro draft.
 */
export function AnimatedImageBlock({
  block,
}: BlockRenderProps<AnimatedImageProps>) {
  const props = block.props;
  const intensity = props.intensity ?? 'medium';
  const aspect = props.aspect && props.aspect !== 'auto' ? props.aspect : '16/9';
  const widthClass =
    props.width === 'narrow'
      ? { maxWidth: 720, marginInline: 'auto' }
      : props.width === 'wide'
        ? { maxWidth: 1100, marginInline: 'auto' }
        : { maxWidth: '100%' };

  if (!props.imageUrl) return null;

  const inner =
    props.effect === 'parallax' ? (
      <ParallaxImage src={props.imageUrl} alt={props.alt ?? ''} aspect={aspect} intensity={intensity} />
    ) : props.effect === 'magnetic' ? (
      <MagneticImage src={props.imageUrl} alt={props.alt ?? ''} aspect={aspect} intensity={intensity} />
    ) : props.effect === 'kenburns' ? (
      <KenBurnsImage src={props.imageUrl} alt={props.alt ?? ''} aspect={aspect} intensity={intensity} />
    ) : (
      <TiltImage src={props.imageUrl} alt={props.alt ?? ''} aspect={aspect} intensity={intensity} />
    );

  return (
    <figure style={{ margin: 0, padding: 'clamp(20px, 3vw, 40px) 0', ...widthClass }}>
      {inner}
      {props.caption ? (
        <figcaption
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            color: 'color-mix(in srgb, var(--sf-ink) 60%, transparent)',
            marginTop: 10,
            textAlign: 'center',
          }}
        >
          {props.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function intensityToPx(intensity: AnimatedImageProps['intensity']): number {
  if (intensity === 'subtle') return 24;
  if (intensity === 'strong') return 80;
  return 48;
}

function ParallaxImage({
  src,
  alt,
  aspect,
  intensity,
}: {
  src: string;
  alt: string;
  aspect: string;
  intensity: AnimatedImageProps['intensity'];
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const range = intensityToPx(intensity);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const yRaw = useTransform(scrollYProgress, [0, 1], [range, -range]);
  const y = useSpring(yRaw, { stiffness: 80, damping: 22, mass: 0.4 });
  return (
    <div
      ref={ref}
      style={frame(aspect)}
    >
      <motion.div
        style={{
          position: 'absolute',
          inset: `-${range}px 0`,
          y: reduced ? 0 : y,
          backgroundImage: `url(${src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        role="img"
        aria-label={alt}
      />
    </div>
  );
}

function MagneticImage({
  src,
  alt,
  aspect,
  intensity,
}: {
  src: string;
  alt: string;
  aspect: string;
  intensity: AnimatedImageProps['intensity'];
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const range = intensityToPx(intensity) / 2;
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  function onMove(e: MouseEvent<HTMLDivElement>) {
    if (reduced) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set(((e.clientX - rect.left) / rect.width - 0.5) * range);
    y.set(((e.clientY - rect.top) / rect.height - 0.5) * range);
  }
  function onLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={frame(aspect)}
    >
      <motion.img
        src={src}
        alt={alt}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          x,
          y,
        }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      />
    </div>
  );
}

function KenBurnsImage({
  src,
  alt,
  aspect,
  intensity,
}: {
  src: string;
  alt: string;
  aspect: string;
  intensity: AnimatedImageProps['intensity'];
}) {
  const reduced = useReducedMotion();
  const scaleHigh = intensity === 'subtle' ? 1.06 : intensity === 'strong' ? 1.18 : 1.1;
  return (
    <div style={frame(aspect)}>
      <motion.img
        src={src}
        alt={alt}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          willChange: 'transform',
        }}
        animate={
          reduced
            ? undefined
            : {
                scale: [1, scaleHigh, 1],
                x: [0, 12, 0],
                y: [0, -8, 0],
              }
        }
        transition={{ duration: 14, ease: 'easeInOut', repeat: Infinity }}
      />
    </div>
  );
}

function TiltImage({
  src,
  alt,
  aspect,
  intensity,
}: {
  src: string;
  alt: string;
  aspect: string;
  intensity: AnimatedImageProps['intensity'];
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const max = intensity === 'subtle' ? 4 : intensity === 'strong' ? 12 : 8;
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rotateX = useTransform(y, [0, 1], [max, -max]);
  const rotateY = useTransform(x, [0, 1], [-max, max]);

  function onMove(e: MouseEvent<HTMLDivElement>) {
    if (reduced) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width);
    y.set((e.clientY - rect.top) / rect.height);
  }
  function onLeave() {
    x.set(0.5);
    y.set(0.5);
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ ...frame(aspect), perspective: 1200 }}
    >
      <motion.img
        src={src}
        alt={alt}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          rotateX: reduced ? 0 : rotateX,
          rotateY: reduced ? 0 : rotateY,
          transformStyle: 'preserve-3d',
        }}
      />
    </div>
  );
}

function frame(aspect: string): CSSProperties {
  return {
    position: 'relative',
    aspectRatio: aspect,
    overflow: 'hidden',
    borderRadius: 8,
    background: 'color-mix(in srgb, var(--sf-ink) 6%, transparent)',
    border: '1px solid color-mix(in srgb, var(--sf-accent) 18%, transparent)',
    isolation: 'isolate',
  };
}
