/**
 * Storefront palettes. Each palette is a tiny three-token system:
 *
 *   ink     — body text + most strokes
 *   ground  — page background
 *   accent  — the one editorial highlight (gold-equivalent in current brand)
 *
 * Templates inject these as CSS variables on a wrapper so a palette swap
 * is purely visual; no template code branches on palette id.
 *
 * Each palette ships a `light` and `dark` triplet so a single palette
 * choice renders correctly under either app theme. The owner can also
 * theme-lock their public site via `themeOverrides.themeBehaviour`
 * (handled by the storefront wrapper, not here).
 */

import type { Theme } from '@/lib/theme';

export const PALETTE_IDS = [
  'sand_gold',
  'pearl_ink',
  'olive_brass',
  'maroon_bone',
  'midnight_emerald',
  'terracotta_kiln',
  'bone_obsidian',
  'coral_play',
  'pearl_lagoon',
  'sage_inlet',
  'dune_blush',
] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];

export type PaletteTriplet = {
  ink: string;
  ground: string;
  accent: string;
};

export type Palette = {
  id: PaletteId;
  light: PaletteTriplet;
  dark: PaletteTriplet;
};

export const palettes: Record<PaletteId, Palette> = {
  sand_gold: {
    id: 'sand_gold',
    light: { ink: '#1F1B16', ground: '#E8DCC4', accent: '#C9A961' },
    dark: { ink: '#F1E9D7', ground: '#2A2A2A', accent: '#D8B872' },
  },
  pearl_ink: {
    id: 'pearl_ink',
    light: { ink: '#0E0E10', ground: '#F4F1EB', accent: '#3B3B45' },
    dark: { ink: '#F4F1EB', ground: '#1A1A1C', accent: '#9C9CB0' },
  },
  olive_brass: {
    id: 'olive_brass',
    light: { ink: '#1F2117', ground: '#EFE7CC', accent: '#A2864B' },
    dark: { ink: '#EFE7CC', ground: '#262A1E', accent: '#C9A86A' },
  },
  maroon_bone: {
    id: 'maroon_bone',
    light: { ink: '#2A1212', ground: '#F2EAD8', accent: '#7A1D2A' },
    dark: { ink: '#F2EAD8', ground: '#1F1414', accent: '#B8424E' },
  },
  /**
   * Midnight emerald — dark-first cinematic palette designed for the
   * Noctis template. The "light" triplet is a polite fallback (deep ink
   * on cream with a forest accent) but storefronts using this palette
   * almost always pair it with `themeBehaviour: 'dark'` so visitors land
   * directly on the rich-night surface that gives the template its feel.
   */
  midnight_emerald: {
    id: 'midnight_emerald',
    light: { ink: '#0B1612', ground: '#F1ECE0', accent: '#1F6B4F' },
    dark: { ink: '#F1ECE0', ground: '#0A1714', accent: '#7CCFA8' },
  },
  /**
   * Terracotta kiln — warm fired-clay tones, paired with the Workshop
   * template. Reads as "made by hand": rust accent on a cream ground,
   * deep cocoa ink for body copy.
   */
  terracotta_kiln: {
    id: 'terracotta_kiln',
    light: { ink: '#2A1A14', ground: '#F2E2D2', accent: '#B5532A' },
    dark: { ink: '#F2E2D2', ground: '#1F140F', accent: '#D9714A' },
  },
  /**
   * Bone obsidian — true black-and-white system for the Mono template.
   * Pure paper ground in light mode, near-black ink, charcoal accent.
   * Intentionally the most graphic / least warm palette in the set.
   */
  bone_obsidian: {
    id: 'bone_obsidian',
    light: { ink: '#000000', ground: '#FFFFFF', accent: '#1A1A1A' },
    dark: { ink: '#FFFFFF', ground: '#0A0A0A', accent: '#BFBFBF' },
  },
  /**
   * Coral play — warm peach ground with a coral accent and deep plum
   * ink. Picked for the Laeb (services / bookings) template — should
   * feel inviting and a touch playful without going pastel.
   */
  coral_play: {
    id: 'coral_play',
    light: { ink: '#321B26', ground: '#FFE9E1', accent: '#E2615C' },
    dark: { ink: '#FFE9E1', ground: '#1F1217', accent: '#FF8E80' },
  },
  /**
   * Pearl lagoon — pale aqua ground with a soft teal accent. Pulled
   * from the Zubara coast (north-west Qatar) for the editorial-fashion
   * template; cool counterweight to the warmer cream palettes.
   */
  pearl_lagoon: {
    id: 'pearl_lagoon',
    light: { ink: '#102733', ground: '#E8F0EC', accent: '#4A8B92' },
    dark: { ink: '#E8F0EC', ground: '#0B1A22', accent: '#79C5C9' },
  },
  /**
   * Sage inlet — mossy sage-on-cream system for the Khor template.
   * Reads as a mangrove lagoon: muted green accent, warm pale ground,
   * deep moss ink. Pairs well with maker / artisan content.
   */
  sage_inlet: {
    id: 'sage_inlet',
    light: { ink: '#1B2A20', ground: '#E5EFD9', accent: '#5C7A4A' },
    dark: { ink: '#E5EFD9', ground: '#131C16', accent: '#8AB070' },
  },
  /**
   * Dune blush — warm dune ground, rose-ochre accent, dark cocoa ink.
   * Inspired by the Zikreet mushroom-rock formation; sits between
   * sand_gold and maroon_bone on the warmth axis.
   */
  dune_blush: {
    id: 'dune_blush',
    light: { ink: '#2D1A1A', ground: '#F5DDC8', accent: '#C26A52' },
    dark: { ink: '#F5DDC8', ground: '#201311', accent: '#E08B6E' },
  },
};

/**
 * Pick the right triplet for the active theme. Always defaults to `light`
 * if a palette is missing a `dark` entry (graceful fallback).
 */
export function pickPaletteTriplet(p: Palette, theme: Theme): PaletteTriplet {
  return theme === 'dark' && p.dark ? p.dark : p.light;
}

/**
 * Convenience for the common case — accepts a Palette and returns the
 * CSS-vars for the active theme. The storefront wrapper uses this; templates
 * stay theme-agnostic and just consume `--sf-ink` etc.
 */
export function paletteCssVars(p: Palette, theme: Theme = 'light'): React.CSSProperties {
  const t = pickPaletteTriplet(p, theme);
  return {
    ['--sf-ink' as string]: t.ink,
    ['--sf-ground' as string]: t.ground,
    ['--sf-accent' as string]: t.accent,
  } as React.CSSProperties;
}
