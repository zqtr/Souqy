'use client';

import { motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { useRef, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import type { BlockVariant } from '@/lib/blocks/types';
import {
  ChromaDepthSurface,
  GradientBarsSurface,
  GrainWaveSurface,
  HalftoneWaveSurface,
  MetallicSwirlSurface,
  SilkWavesSurface,
} from '@/components/react-bits/PremiumSurfaces';

/**
 * VariantFrame — wraps the inner content of a Hero / Banner / Gallery /
 * InquireCta block with a Pro-tier visual treatment. Three variants:
 *
 *   - `pro-aurora`   : animated gradient mesh sitting behind the content,
 *                      slowly drifting; gives any hero an editorial /
 *                      atelier-grade backdrop without needing imagery.
 *   - `pro-magnetic` : soft parallax tilt that follows the cursor — the
 *                      whole block subtly leans into the visitor's
 *                      pointer. Pairs especially well with Hero CTAs.
 *   - `pro-neon`     : gradient stroke with a soft glow; reads as a
 *                      premium framed-card treatment for CTAs and
 *                      featured galleries.
 *
 * `'classic'` (default) and any unknown value pass the children through
 * untouched. Reduced-motion users get a static rendering of the
 * background with no parallax / drift.
 */
export function VariantFrame({
  variant,
  children,
  style,
  className,
}: {
  variant: BlockVariant | undefined;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  const v = variant ?? 'classic';
  if (v === 'classic') {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  if (v === 'pro-aurora') {
    return (
      <AuroraFrame className={className} style={style}>
        {children}
      </AuroraFrame>
    );
  }
  if (v === 'pro-magnetic') {
    return (
      <MagneticFrame className={className} style={style}>
        {children}
      </MagneticFrame>
    );
  }
  if (v === 'pro-neon') {
    return (
      <NeonFrame className={className} style={style}>
        {children}
      </NeonFrame>
    );
  }
  if (v === 'pro-silk') {
    return (
      <SilkWavesSurface className={className}>
        <div style={style}>{children}</div>
      </SilkWavesSurface>
    );
  }
  if (v === 'pro-grain') {
    return (
      <GrainWaveSurface className={className}>
        <div style={style}>{children}</div>
      </GrainWaveSurface>
    );
  }
  if (v === 'pro-halftone') {
    return (
      <HalftoneWaveSurface className={className}>
        <div style={style}>{children}</div>
      </HalftoneWaveSurface>
    );
  }
  if (v === 'pro-metallic') {
    return (
      <MetallicSwirlSurface className={className}>
        <div style={style}>{children}</div>
      </MetallicSwirlSurface>
    );
  }
  if (v === 'pro-bars') {
    return (
      <GradientBarsSurface className={className}>
        <div style={style}>{children}</div>
      </GradientBarsSurface>
    );
  }
  if (v === 'pro-chroma') {
    return (
      <ChromaDepthSurface className={className}>
        <div style={style}>{children}</div>
      </ChromaDepthSurface>
    );
  }
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

function AuroraFrame({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        isolation: 'isolate',
        borderRadius: 18,
        overflow: 'hidden',
        ...style,
      }}
    >
      <motion.div
        aria-hidden
        initial={false}
        animate={
          reduced
            ? undefined
            : {
                backgroundPosition: [
                  '0% 0%, 0% 0%, 0% 0%',
                  '100% 50%, 30% 80%, 60% 20%',
                  '0% 0%, 0% 0%, 0% 0%',
                ],
              }
        }
        transition={{ duration: 22, ease: 'easeInOut', repeat: Infinity }}
        style={{
          position: 'absolute',
          inset: '-20%',
          zIndex: -1,
          background: [
            'radial-gradient(60% 40% at 20% 30%, color-mix(in srgb, var(--sf-accent) 28%, transparent) 0%, transparent 60%)',
            'radial-gradient(50% 50% at 80% 20%, color-mix(in srgb, var(--sf-accent) 20%, transparent) 0%, transparent 60%)',
            'radial-gradient(70% 50% at 50% 90%, color-mix(in srgb, var(--sf-ink) 12%, transparent) 0%, transparent 60%)',
          ].join(','),
          backgroundSize: '200% 200%, 200% 200%, 200% 200%',
          filter: 'blur(8px) saturate(120%)',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          background:
            'linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--sf-ground) 60%, transparent) 100%)',
        }}
      />
      {children}
    </div>
  );
}

function MagneticFrame({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rotateX = useTransform(y, [0, 1], [3, -3]);
  const rotateY = useTransform(x, [0, 1], [-3, 3]);

  function onMove(e: MouseEvent<HTMLDivElement>) {
    if (reduced) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width);
    y.set((e.clientY - rect.top) / rect.height);
  }
  function onLeave() {
    if (reduced) return;
    x.set(0.5);
    y.set(0.5);
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{ perspective: 1200, ...style }}
    >
      <motion.div
        style={{
          rotateX: reduced ? 0 : rotateX,
          rotateY: reduced ? 0 : rotateY,
          transformStyle: 'preserve-3d',
          transition: 'transform 220ms ease',
          willChange: 'transform',
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

function NeonFrame({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        padding: 1,
        borderRadius: 20,
        background:
          'conic-gradient(from 220deg, color-mix(in srgb, var(--sf-accent) 80%, transparent), color-mix(in srgb, var(--sf-ink) 35%, transparent), color-mix(in srgb, var(--sf-accent) 80%, transparent))',
        boxShadow:
          '0 0 0 1px color-mix(in srgb, var(--sf-accent) 22%, transparent), 0 24px 80px -32px color-mix(in srgb, var(--sf-accent) 60%, transparent)',
        isolation: 'isolate',
        ...style,
      }}
    >
      <div
        style={{
          position: 'relative',
          borderRadius: 19,
          overflow: 'hidden',
          background: 'var(--sf-ground)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
