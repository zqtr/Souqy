'use client';

import { useEffect, useState } from 'react';
import {
  BREAKPOINTS,
  type Breakpoint,
  widthToBreakpoint,
  isAtLeast,
} from '@/lib/breakpoints';

export type Viewport = {
  width: number;
  height: number;
  /** Currently-active named breakpoint. */
  bp: Breakpoint;
  /** True at md and above. */
  md: boolean;
  /** True at lg and above. */
  lg: boolean;
  /** True at xl. */
  xl: boolean;
  /** True if the user has not opted into reduced motion. */
  motion: boolean;
};

/**
 * Reactively observes window size + reduced-motion. Returns a snapshot
 * every render. SSR-safe — returns a sensible "desktop xl, motion ok"
 * default before mount so first paint never collapses to a phone
 * layout. After mount it switches to the real measurement.
 *
 *     const v = useViewport();
 *     if (v.bp === 'sm') return <MobileNav />;
 *     return <DesktopNav />;
 */
export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(() => ({
    width: BREAKPOINTS.xl,
    height: 800,
    bp: 'xl',
    md: true,
    lg: true,
    xl: true,
    motion: true,
  }));

  useEffect(() => {
    function read() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const bp = widthToBreakpoint(w);
      const motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setVp({
        width: w,
        height: h,
        bp,
        md: isAtLeast(w, 'md'),
        lg: isAtLeast(w, 'lg'),
        xl: isAtLeast(w, 'xl'),
        motion,
      });
    }
    read();
    window.addEventListener('resize', read, { passive: true });
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener?.('change', read);
    return () => {
      window.removeEventListener('resize', read);
      mq.removeEventListener?.('change', read);
    };
  }, []);

  return vp;
}
