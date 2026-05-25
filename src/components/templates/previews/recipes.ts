import type { TemplateId } from '@/lib/brief';

/**
 * Layout recipe for a single template's preview. The parametric SVG in
 * `TemplatePreview` knows how to render each hero/accent/density combo;
 * adding a new template means one entry below — no new SVG markup.
 *
 * Field meanings:
 *  - `hero`: the headline composition. `cinematic` puts a full-bleed
 *    band across the top; `split` is half-image, half-text; `dense` is
 *    a tight category-rail layout; `menu` stacks short lines with a
 *    price column; `gallery` is a 3-up image grid; `editorial` is a
 *    centred title over a wide band.
 *  - `gridCols`: number of product tiles in the secondary row.
 *  - `accentShape`: how the palette's accent token surfaces — a single
 *    dot, a horizontal bar, or a thin rectangular frame around the hero.
 *  - `density`: spacing between rows; affects only the vertical rhythm.
 *  - `themeBehaviour`: optional `'dark'` to flip ground ↔ ink (mirrors
 *    the storefront's per-template default).
 */
export type PreviewRecipe = {
  hero: 'cinematic' | 'split' | 'dense' | 'menu' | 'gallery' | 'editorial';
  gridCols: 2 | 3 | 4;
  accentShape: 'dot' | 'bar' | 'frame';
  density: 'tight' | 'comfortable' | 'spacious';
  themeBehaviour?: 'dark';
};

export const PREVIEW_RECIPES: Record<TemplateId, PreviewRecipe> = {
  atrium: { hero: 'editorial', gridCols: 3, accentShape: 'bar', density: 'spacious' },
  souqline: { hero: 'dense', gridCols: 4, accentShape: 'dot', density: 'tight' },
  kiosk: { hero: 'cinematic', gridCols: 3, accentShape: 'frame', density: 'comfortable' },
  lounge: { hero: 'menu', gridCols: 2, accentShape: 'bar', density: 'comfortable' },
  studio: { hero: 'split', gridCols: 2, accentShape: 'dot', density: 'comfortable' },
  bazaar: { hero: 'cinematic', gridCols: 3, accentShape: 'bar', density: 'tight' },
  vitrine: { hero: 'split', gridCols: 3, accentShape: 'frame', density: 'spacious' },
  monoline: { hero: 'menu', gridCols: 2, accentShape: 'bar', density: 'spacious' },
  harvest: { hero: 'gallery', gridCols: 3, accentShape: 'dot', density: 'comfortable' },
  launchpad: { hero: 'split', gridCols: 3, accentShape: 'frame', density: 'comfortable' },
  frame: { hero: 'gallery', gridCols: 3, accentShape: 'frame', density: 'spacious', themeBehaviour: 'dark' },
};
