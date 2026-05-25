'use client';

import { useEffect, useState } from 'react';
import type { CursorEffect } from '@/lib/blocks/types';

export function PremiumCursor({ effect }: { effect?: CursorEffect }) {
  const [point, setPoint] = useState({ x: -80, y: -80 });

  useEffect(() => {
    if (!effect || effect === 'none') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches || window.matchMedia('(pointer: coarse)').matches) return;
    const onMove = (event: PointerEvent) => setPoint({ x: event.clientX, y: event.clientY });
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [effect]);

  if (!effect || effect === 'none') return null;

  const label = effect.replace(/-/g, ' ');
  const isAscii = effect === 'ascii-cursor';
  const isGlass = effect === 'glass-cursor';
  const isDither = effect === 'dither-cursor';

  return (
    <div
      aria-hidden
      title={label}
      style={{
        position: 'fixed',
        left: point.x,
        top: point.y,
        width: isAscii ? 38 : 26,
        height: isAscii ? 26 : 26,
        borderRadius: isAscii ? 4 : 999,
        pointerEvents: 'none',
        zIndex: 2147483000,
        transform: 'translate(-50%, -50%)',
        transition: effect === 'smooth-cursor' ? 'left 120ms ease, top 120ms ease' : 'none',
        border: isGlass
          ? '1px solid color-mix(in srgb, var(--sf-accent) 56%, white)'
          : '1px solid color-mix(in srgb, var(--sf-accent) 72%, transparent)',
        background: isAscii
          ? 'transparent'
          : isDither
            ? 'radial-gradient(circle, var(--sf-accent) 1px, transparent 1.6px) 0 0/6px 6px'
            : isGlass
              ? 'color-mix(in srgb, var(--sf-ground) 34%, transparent)'
              : 'color-mix(in srgb, var(--sf-accent) 22%, transparent)',
        boxShadow: isGlass
          ? '0 10px 30px color-mix(in srgb, var(--sf-ink) 18%, transparent), inset 0 1px 0 rgba(255,255,255,0.45)'
          : '0 0 24px color-mix(in srgb, var(--sf-accent) 42%, transparent)',
        backdropFilter: isGlass ? 'blur(10px) saturate(150%)' : undefined,
        color: 'var(--sf-accent)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        display: 'grid',
        placeItems: 'center',
        mixBlendMode: effect === 'custom-cursor' ? 'difference' : 'normal',
      }}
    >
      {isAscii ? '>' : null}
    </div>
  );
}
