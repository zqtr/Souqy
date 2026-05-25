'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import AuroraBlur from './aurora-blur';
import GrainWave from './grain-wave';
import GradientBars from './gradient-bars';
import GlassFlow from './glass-flow';
import DotShift from './dot-shift';
import Mosaic from './mosaic';

type SurfaceProps = {
  children?: ReactNode;
  className?: string;
};

function PremiumRoot({ children, className, style }: SurfaceProps & { style: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        isolation: 'isolate',
        overflow: 'hidden',
        borderRadius: 22,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function EffectLayer({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: -2, pointerEvents: 'none' }}>
      {children}
    </div>
  );
}

export function SilkWavesSurface({ children, className }: SurfaceProps) {
  const reduced = useReducedMotion();
  return (
    <PremiumRoot className={className} style={{ background: 'var(--sf-ground)' }}>
      {!reduced ? (
        <EffectLayer>
          <AuroraBlur width="100%" height="100%" speed={0.55} opacity={0.7} />
        </EffectLayer>
      ) : null}
      <motion.div
        aria-hidden
        initial={false}
        animate={reduced ? undefined : { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
        transition={{ duration: 24, ease: 'easeInOut', repeat: Infinity }}
        style={{
          position: 'absolute',
          inset: '-28%',
          zIndex: -2,
          background:
            'linear-gradient(110deg, transparent 0%, color-mix(in srgb, var(--sf-accent) 24%, transparent) 28%, transparent 54%, color-mix(in srgb, var(--sf-ink) 14%, transparent) 82%, transparent 100%)',
          backgroundSize: '220% 220%',
          filter: 'blur(18px) saturate(130%)',
          transform: 'rotate(-8deg)',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          background:
            'repeating-linear-gradient(105deg, color-mix(in srgb, var(--sf-ink) 8%, transparent) 0 1px, transparent 1px 18px)',
          opacity: 0.3,
          mixBlendMode: 'multiply',
        }}
      />
      {children}
    </PremiumRoot>
  );
}

export function GrainWaveSurface({ children, className }: SurfaceProps) {
  const reduced = useReducedMotion();
  return (
    <PremiumRoot className={className} style={{ background: 'var(--sf-ground)' }}>
      {!reduced ? (
        <EffectLayer>
          <GrainWave width="100%" height="100%" speed={0.45} grainIntensity={0.22} />
        </EffectLayer>
      ) : null}
      <motion.div
        aria-hidden
        initial={false}
        animate={reduced ? undefined : { x: ['-8%', '8%', '-8%'], y: ['0%', '4%', '0%'] }}
        transition={{ duration: 18, ease: 'easeInOut', repeat: Infinity }}
        style={{
          position: 'absolute',
          inset: '-16%',
          zIndex: -2,
          background:
            'radial-gradient(45% 65% at 20% 30%, color-mix(in srgb, var(--sf-accent) 28%, transparent), transparent 70%), radial-gradient(55% 45% at 80% 70%, color-mix(in srgb, var(--sf-ink) 14%, transparent), transparent 68%)',
          filter: 'blur(22px)',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          backgroundImage:
            'radial-gradient(color-mix(in srgb, var(--sf-ink) 14%, transparent) 0.7px, transparent 0.7px)',
          backgroundSize: '8px 8px',
          opacity: 0.38,
        }}
      />
      {children}
    </PremiumRoot>
  );
}

export function HalftoneWaveSurface({ children, className }: SurfaceProps) {
  const reduced = useReducedMotion();
  return (
    <PremiumRoot className={className} style={{ background: 'var(--sf-ground)' }}>
      {!reduced ? (
        <EffectLayer>
          <Mosaic width="100%" height="100%" speed={0.35} opacity={0.34} pixelSize={18} />
        </EffectLayer>
      ) : null}
      <motion.div
        aria-hidden
        initial={false}
        animate={reduced ? undefined : { backgroundPosition: ['0 0', '44px 26px', '0 0'] }}
        transition={{ duration: 20, ease: 'linear', repeat: Infinity }}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--sf-accent) 34%, transparent) 0 1.6px, transparent 1.8px)',
          backgroundSize: '22px 22px',
          maskImage: 'linear-gradient(115deg, black, transparent 72%)',
          opacity: 0.72,
        }}
      />
      {children}
    </PremiumRoot>
  );
}

export function MetallicSwirlSurface({ children, className }: SurfaceProps) {
  const reduced = useReducedMotion();
  return (
    <PremiumRoot
      className={className}
      style={{
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--sf-ground) 92%, var(--sf-accent)), var(--sf-ground))',
      }}
    >
      {!reduced ? (
        <EffectLayer>
          <GlassFlow width="100%" height="100%" speed={0.24} stripeCount={9} frostAmount={0.38} />
        </EffectLayer>
      ) : null}
      <motion.div
        aria-hidden
        initial={false}
        animate={reduced ? undefined : { rotate: [0, 12, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 26, ease: 'easeInOut', repeat: Infinity }}
        style={{
          position: 'absolute',
          inset: '-32%',
          zIndex: -1,
          background:
            'conic-gradient(from 120deg, transparent, color-mix(in srgb, var(--sf-accent) 42%, transparent), color-mix(in srgb, var(--sf-ink) 18%, transparent), transparent, color-mix(in srgb, var(--sf-accent) 30%, transparent), transparent)',
          filter: 'blur(16px) contrast(118%)',
        }}
      />
      {children}
    </PremiumRoot>
  );
}

export function GradientBarsSurface({ children, className }: SurfaceProps) {
  const reduced = useReducedMotion();
  return (
    <PremiumRoot className={className} style={{ background: 'var(--sf-ground)' }}>
      {!reduced ? (
        <EffectLayer>
          <GradientBars width="100%" height="100%" speed={0.4} opacity={0.42} cursorInteraction={false} />
        </EffectLayer>
      ) : null}
      <motion.div
        aria-hidden
        initial={false}
        animate={reduced ? undefined : { backgroundPosition: ['0% 0%', '160% 0%', '0% 0%'] }}
        transition={{ duration: 16, ease: 'easeInOut', repeat: Infinity }}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          background:
            'linear-gradient(90deg, color-mix(in srgb, var(--sf-accent) 28%, transparent) 0 12%, transparent 12% 22%, color-mix(in srgb, var(--sf-ink) 10%, transparent) 22% 34%, transparent 34% 48%, color-mix(in srgb, var(--sf-accent) 18%, transparent) 48% 62%, transparent 62%)',
          backgroundSize: '180% 100%',
          opacity: 0.8,
        }}
      />
      {children}
    </PremiumRoot>
  );
}

export function ChromaDepthSurface({ children, className }: SurfaceProps) {
  return (
    <PremiumRoot
      className={className}
      style={{
        padding: 1,
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--sf-accent) 72%, transparent), color-mix(in srgb, var(--sf-ink) 18%, transparent), color-mix(in srgb, var(--sf-accent) 42%, transparent))',
        boxShadow:
          '0 30px 90px -42px color-mix(in srgb, var(--sf-accent) 80%, transparent), 0 1px 0 color-mix(in srgb, var(--sf-ink) 12%, transparent)',
      }}
    >
      <EffectLayer>
        <DotShift color="#c9a961" speed={0.22} size={0.82} blur={0.65} />
      </EffectLayer>
      <div
        style={{
          position: 'relative',
          borderRadius: 21,
          overflow: 'hidden',
          background: 'var(--sf-ground)',
        }}
      >
        {children}
      </div>
    </PremiumRoot>
  );
}
