'use client';

import { createElement, type CSSProperties, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import StaggeredText from '@/components/react-bits/staggered-text';
import type { TextEffect } from '@/lib/blocks/types';

type Props = {
  effect?: TextEffect;
  as: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
};

export function TextEffectRenderer({ effect, as, children, style, className }: Props) {
  const reduced = useReducedMotion();
  const text = typeof children === 'string' ? children : '';
  if (!effect || effect === 'none' || reduced || !text) {
    return createElement(as, { style, className }, children);
  }

  if (effect === 'staggered-text') {
    return (
      <div style={style} className={className}>
        <StaggeredText text={text} as={as === 'div' ? 'p' : as} segmentBy="words" delay={45} duration={0.54} blur />
      </div>
    );
  }

  if (effect === 'blur-highlight') {
    return (
      <>
        <style>{`
          @keyframes souqna-blur-highlight {
            0% { filter: blur(8px); opacity: .4; background-size: 0% 42%; }
            100% { filter: blur(0); opacity: 1; background-size: 100% 42%; }
          }
        `}</style>
        {createElement(
          as,
          {
            style: {
              ...style,
              display: 'inline',
              backgroundImage: 'linear-gradient(color-mix(in srgb, var(--sf-accent) 34%, transparent), color-mix(in srgb, var(--sf-accent) 34%, transparent))',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: '0 86%',
              animation: 'souqna-blur-highlight 850ms ease both',
            },
            className,
          },
          children,
        )}
      </>
    );
  }

  if (effect === 'glitch-text') {
    return (
      <>
        <style>{`
          @keyframes souqna-glitch {
            0%, 100% { text-shadow: none; transform: translateX(0); }
            22% { text-shadow: 2px 0 #7ccfa8, -2px 0 #8b3a3a; transform: translateX(-1px); }
            44% { text-shadow: -2px 0 #c9a961, 2px 0 #365f8f; transform: translateX(1px); }
          }
        `}</style>
        {createElement(as, { style: { ...style, animation: 'souqna-glitch 2.6s steps(2, end) infinite' }, className }, children)}
      </>
    );
  }

  const motionProps =
    effect === '3d-letter-swap' || effect === '3d-text-reveal'
      ? { rotateX: [70, 0], y: [18, 0], opacity: [0, 1] }
      : effect === 'particle-text' || effect === 'text-scatter'
        ? { letterSpacing: ['0.22em', '0em'], filter: ['blur(4px)', 'blur(0px)'], opacity: [0, 1] }
        : effect === 'text-path'
          ? { x: [-18, 0], opacity: [0, 1] }
          : { opacity: [0, 1] };

  const MotionTag = motion[as === 'div' ? 'div' : as];
  return (
    <MotionTag
      initial={false}
      animate={motionProps}
      transition={{ duration: 0.72, ease: 'easeOut' }}
      style={{
        ...style,
        transformStyle: effect.includes('3d') ? 'preserve-3d' : undefined,
      }}
      className={className}
    >
      {children}
    </MotionTag>
  );
}
