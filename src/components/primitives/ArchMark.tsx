import type { CSSProperties } from 'react';
import { palette } from '@/lib/tokens';

type Props = {
  size?: number;
  stroke?: string;
  inner?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
};

/**
 * The arch — Souqna's only recurring graphic device.
 * Built on a 25-px unit grid (R = 2u, W = 4u). Outer arch + optional
 * inner echo + keystone dot.
 */
export function ArchMark({
  size = 32,
  stroke = palette.gold,
  inner = true,
  className,
  style,
  ariaLabel,
}: Props) {
  const sw = Math.max(1, size / 32);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={className}
      style={{ display: 'block', ...style }}
    >
      <path
        d="M 8 56 L 8 32 A 24 24 0 0 1 56 32 L 56 56"
        stroke={stroke}
        strokeWidth={sw * 1.4}
        fill="none"
        strokeLinecap="square"
      />
      {inner && (
        <path
          d="M 18 56 L 18 34 A 14 14 0 0 1 46 34 L 46 56"
          stroke={stroke}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="square"
          opacity="0.55"
        />
      )}
      <circle cx="32" cy="8.5" r={sw * 0.9} fill={stroke} />
    </svg>
  );
}
