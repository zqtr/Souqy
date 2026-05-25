'use client';

import { useEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import {
  MetalFx,
  type MetalFxPreset,
  type MetalFxTheme,
  type MetalFxVariant,
} from 'metal-fx';
import { useThemeOptional } from '@/components/theme/ThemeProvider';

type MetalFrameProps = {
  children: ReactNode;
  variant?: MetalFxVariant;
  preset?: MetalFxPreset;
  strength?: number;
  theme?: MetalFxTheme;
  paused?: boolean;
  borderRadius?: number;
  style?: CSSProperties;
  reflectionTargets?: ReadonlyArray<RefObject<HTMLElement | null>>;
};

const metalFrameFallbackStyle = `
  .sq-metal-frame {
    opacity: 1 !important;
    visibility: visible !important;
  }
`;

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(query.matches);

    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return prefersReducedMotion;
}

export function MetalFrame({
  children,
  variant = 'button',
  preset = 'chromatic',
  strength = 0.65,
  theme,
  paused = false,
  borderRadius,
  style,
  reflectionTargets,
}: MetalFrameProps) {
  const themeContext = useThemeOptional();
  const prefersReducedMotion = usePrefersReducedMotion();
  const resolvedTheme = theme ?? themeContext?.theme ?? 'auto';

  return (
    <>
      <style>{metalFrameFallbackStyle}</style>
      <MetalFx
        className="sq-metal-frame"
        variant={variant}
        preset={preset}
        strength={strength}
        theme={resolvedTheme}
        paused={paused || prefersReducedMotion}
        borderRadius={borderRadius}
        style={style}
        reflectionTargets={reflectionTargets}
        normalizeHostStyles={false}
      >
        {children}
      </MetalFx>
    </>
  );
}
