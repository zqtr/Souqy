import type { BackgroundEffect } from './types';

export type BackgroundEffectPickerOption = {
  id: BackgroundEffect;
  label: string;
  group: 'Static' | 'Soft' | 'Light' | 'Lines' | 'Texture' | 'Depth';
  blurb: string;
  preview: string;
  dark?: boolean;
};

export const BACKGROUND_EFFECT_PICKER_OPTIONS: BackgroundEffectPickerOption[] = [
  {
    id: 'none',
    label: 'None',
    group: 'Static',
    blurb: 'Use the normal section surface.',
    preview: 'var(--bld-tile-bg)',
  },
  {
    id: 'silk-waves',
    label: 'Silk',
    group: 'Soft',
    blurb: 'Slow fabric-like motion.',
    preview:
      'radial-gradient(circle at 18% 28%, rgba(232,220,196,0.36), transparent 34%), linear-gradient(135deg, #2A2A2A 0%, #37322a 54%, #E8DCC4 140%)',
    dark: true,
  },
  {
    id: 'grain-wave',
    label: 'Grain',
    group: 'Texture',
    blurb: 'Soft moving grain.',
    preview:
      'radial-gradient(circle at 28% 24%, rgba(232,220,196,0.34), transparent 34%), radial-gradient(circle at 78% 74%, rgba(232,220,196,0.18), transparent 42%), #2A2A2A',
    dark: true,
  },
  {
    id: 'aurora-blur',
    label: 'Aurora',
    group: 'Soft',
    blurb: 'Blurred ambient glow.',
    preview:
      'radial-gradient(circle at 26% 24%, rgba(232,220,196,0.42), transparent 36%), radial-gradient(circle at 78% 68%, rgba(173,161,139,0.42), transparent 42%), #2A2A2A',
    dark: true,
  },
  {
    id: 'glass-flow',
    label: 'Glass',
    group: 'Light',
    blurb: 'Bright liquid glass.',
    preview:
      'conic-gradient(from 130deg, #E8DCC4, rgba(232,220,196,0.48), #7b725f, #2A2A2A, #E8DCC4)',
  },
  {
    id: 'falling-rays',
    label: 'Rays',
    group: 'Light',
    blurb: 'Subtle falling light.',
    preview:
      'linear-gradient(115deg, transparent 0 28%, rgba(232,220,196,0.34) 30% 34%, transparent 36% 62%, rgba(232,220,196,0.22) 64% 68%, transparent 70%), #2A2A2A',
    dark: true,
  },
  {
    id: 'gradient-bars',
    label: 'Bars',
    group: 'Lines',
    blurb: 'Measured editorial stripes.',
    preview:
      'repeating-linear-gradient(90deg, #2A2A2A 0 18px, rgba(232,220,196,0.24) 18px 30px, rgba(232,220,196,0.62) 30px 34px, #2A2A2A 34px 56px)',
    dark: true,
  },
  {
    id: 'mosaic',
    label: 'Mosaic',
    group: 'Texture',
    blurb: 'Small dotted texture.',
    preview:
      'radial-gradient(circle, rgba(232,220,196,0.72) 1.5px, transparent 2px) 0 0/12px 12px, #2A2A2A',
    dark: true,
  },
  {
    id: 'metallic-swirl',
    label: 'Metal',
    group: 'Depth',
    blurb: 'Dimensional metallic motion.',
    preview:
      'radial-gradient(circle at 52% 50%, rgba(232,220,196,0.62), transparent 22%), radial-gradient(circle at 18% 22%, rgba(232,220,196,0.16), transparent 36%), #161616',
    dark: true,
  },
];
