'use client';

import type { ReactNode } from 'react';
import type { BackgroundEffect } from '@/lib/blocks/types';
import {
  GradientBarsSurface,
  GrainWaveSurface,
  HalftoneWaveSurface,
  MetallicSwirlSurface,
  SilkWavesSurface,
} from '@/components/react-bits/PremiumSurfaces';

export function BlockBackgroundFrame({
  effect,
  children,
}: {
  effect?: BackgroundEffect;
  children: ReactNode;
}) {
  switch (effect) {
    case 'silk-waves':
    case 'shader-waves':
    case 'chroma-waves':
    case 'dither-wave':
    case 'radial-liquid':
    case 'portal':
    case 'vortex':
    case 'black-hole':
    case 'rubber-fluid':
    case 'simple-swirl':
    case 'swirl-blend':
      return <SilkWavesSurface>{children}</SilkWavesSurface>;
    case 'aurora-blur':
    case 'gradient-blob':
    case 'ai-blob':
    case 'grain-wave':
    case 'glass-flow':
    case 'falling-rays':
    case 'light-droplets':
    case 'color-loops':
    case 'flicker':
    case 'glitter-warp':
    case 'neon-reveal':
    case 'agentic-ball':
    case 'blurred-rays':
    case 'flame-paths':
    case 'watercolor':
      return <GrainWaveSurface>{children}</GrainWaveSurface>;
    case 'gradient-bars':
    case 'lightspeed':
    case 'rising-lines':
    case 'liquid-bars':
    case 'liquid-lines':
    case 'shadow-bars':
    case 'perspective-grid':
    case 'frame-border':
    case 'retro-lines':
    case 'star-swipe':
    case 'text-cube':
    case 'dot-shift':
      return <GradientBarsSurface>{children}</GradientBarsSurface>;
    case 'halftone-wave':
    case 'halftone-vortex':
    case 'liquid-ascii':
    case 'mosaic':
    case 'synaptic-shift':
    case 'ascii-waves':
    case 'squircle-shift':
    case 'center-flow':
    case 'square-matrix':
      return <HalftoneWaveSurface>{children}</HalftoneWaveSurface>;
    case 'metallic-swirl':
    case 'star-burst':
    case 'rotating-stars':
    case 'warp-twister':
      return <MetallicSwirlSurface>{children}</MetallicSwirlSurface>;
    default:
      return <>{children}</>;
  }
}
