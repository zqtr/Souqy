'use client';

import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useRef } from 'react';
import { palette } from '@/lib/tokens';

type Props = {
  /** Mirror the arch left/right for RTL pages. */
  isRtl: boolean;
};

/**
 * Threshold arch — a taller cousin of `HeroArch` that sits behind the
 * BeginIntake card so the form reads as "passing through the door".
 *
 * Three concentric gold arches plus a hairline baseline and a keystone
 * dot. When the section enters viewport the arches draw themselves in
 * (stroke-dashoffset → 0) over ~1.1s. Reduced-motion users get the
 * arches already fully drawn.
 */
export function BeginArch({ isRtl }: Props) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.25, once: true });

  const draw = (delay: number) => ({
    initial: reduced ? { pathLength: 1 } : { pathLength: 0 },
    animate: inView || reduced ? { pathLength: 1 } : { pathLength: 0 },
    transition: { duration: 1.1, ease: [0.2, 0.7, 0.15, 1] as const, delay },
  });

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto"
      style={{
        width: 'min(94%, 1080px)',
        maxWidth: 1080,
        height: 'clamp(560px, 78%, 880px)',
        opacity: 0.7,
        transform: isRtl ? 'translateY(-50%) scaleX(-1)' : 'translateY(-50%)',
      }}
    >
      <svg
        viewBox="0 0 600 800"
        width="100%"
        height="100%"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
      >
        <motion.path
          d="M 40 760 L 40 360 A 260 260 0 0 1 560 360 L 560 760"
          stroke={palette.gold}
          strokeWidth="1"
          opacity="0.55"
          {...draw(0)}
        />
        <motion.path
          d="M 100 760 L 100 380 A 200 200 0 0 1 500 380 L 500 760"
          stroke={palette.gold}
          strokeWidth="1"
          opacity="0.32"
          {...draw(0.18)}
        />
        <motion.path
          d="M 160 760 L 160 400 A 140 140 0 0 1 440 400 L 440 760"
          stroke={palette.gold}
          strokeWidth="1"
          opacity="0.2"
          {...draw(0.34)}
        />

        <motion.line
          x1="20"
          x2="580"
          y1="760"
          y2="760"
          stroke={palette.gold}
          strokeWidth="0.6"
          opacity="0.35"
          {...draw(0.5)}
        />

        <motion.circle
          cx="300"
          cy="100"
          r="2.5"
          fill={palette.gold}
          initial={{ opacity: reduced ? 1 : 0 }}
          animate={{ opacity: inView || reduced ? 1 : 0 }}
          transition={{ duration: 0.6, delay: 1.4 }}
        />
        <motion.line
          x1="300"
          x2="300"
          y1="108"
          y2="160"
          stroke={palette.gold}
          strokeWidth="0.6"
          opacity="0.5"
          {...draw(1.2)}
        />
      </svg>
    </div>
  );
}
