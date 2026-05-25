'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Fragment, useState } from 'react';

type Props = {
  items: ReactNode[];
  /** Seconds to traverse one full copy of the items. */
  speed?: number;
  separator?: ReactNode;
  direction?: 'ltr' | 'rtl';
  className?: string;
  style?: CSSProperties;
  pauseOnHover?: boolean;
  ariaLabel?: string;
};

/**
 * Infinite horizontal marquee. Items render three times so the loop point
 * is invisible. RTL uses a mirrored keyframe so the strip still scrolls
 * "into" the start edge in either script.
 *
 * Reduced motion: handled in globals.css — animation-duration is forced
 * to 0.001ms, which holds the strip at its initial offset (no scroll).
 */
export function Marquee({
  items,
  speed = 60,
  separator = '·',
  direction = 'ltr',
  className,
  style,
  pauseOnHover = true,
  ariaLabel,
}: Props) {
  const [paused, setPaused] = useState(false);
  const tripled = [...items, ...items, ...items];
  const animation = direction === 'rtl' ? 'mrq-rtl' : 'mrq-ltr';

  return (
    <div
      className={className}
      role="marquee"
      aria-label={ariaLabel}
      onMouseEnter={pauseOnHover ? () => setPaused(true) : undefined}
      onMouseLeave={pauseOnHover ? () => setPaused(false) : undefined}
      style={{
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <div
        aria-hidden
        // The `souqna-marquee-track` class lets globals.css exempt this
        // element from the global `prefers-reduced-motion` animation kill
        // — a marquee is content rotation (the user can only see one slice
        // of the strip at a time), not decorative motion. Without the
        // exemption, the strip freezes for any visitor whose OS reports
        // reduced-motion (very common on Windows 11 by default). The
        // override pulls duration from `--mrq-speed` so any speed prop
        // still wins over the global kill.
        className="souqna-marquee-track"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3vw',
          ['--mrq-speed' as string]: `${speed}s`,
          animation: `${animation} ${speed}s linear infinite`,
          animationPlayState: paused ? 'paused' : 'running',
          willChange: 'transform',
        }}
      >
        {tripled.map((item, i) => (
          <Fragment key={i}>
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>{item}</span>
            <span aria-hidden style={{ opacity: 0.3, display: 'inline-flex', alignItems: 'center' }}>
              {separator}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
