'use client';

import { useReducedMotion } from 'framer-motion';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';

type Props = {
  color?: string;
  radiusPx?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/**
 * Soft radial spotlight that follows the cursor. Used to add warmth to
 * dark sections without resorting to gradient noise. Reduced-motion
 * users get a static, centred glow.
 */
export function Spotlight({
  color = 'rgba(201,169,97,0.14)',
  radiusPx = 600,
  className,
  style,
  children,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });

  function onMove(e: MouseEvent<HTMLDivElement>) {
    if (reduced) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={className}
      style={{ position: 'relative', ...style }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(${radiusPx}px circle at ${pos.x}% ${pos.y}%, ${color}, transparent 55%)`,
          transition: reduced ? undefined : 'background 120ms linear',
        }}
      />
      {children}
    </div>
  );
}
