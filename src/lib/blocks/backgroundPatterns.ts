// Inspired by uiverse.io/patterns (MIT) — re-implemented from scratch
// using common, well-known CSS techniques (repeating gradients, radial
// gradients, conic gradients, tiny SVG turbulence). Nothing here is
// copy-pasted; each entry is hand-authored to read against any
// storefront palette via `--sf-ground` / `--sf-ink` / `--sf-accent`.
//
// Why not raster sprites? Founders pick patterns at edit-time and we
// re-serialize the chosen `css` string straight onto `pageBg` (and
// `HeroProps.backgroundCss`). Anything that survives a JSONB round-trip
// must be free of binary/external-asset dependencies — gradients and
// inline SVG data-URIs are the only safe options.
//
// The 7 categories below mirror the inspector picker tabs.

export type BgPatternCategory =
  | 'dots'
  | 'grid'
  | 'gradient'
  | 'stripes'
  | 'noise'
  | 'mesh'
  | 'geometric';

export type BgPattern = {
  /** Stable slug. Persisted on the page bg / hero blob — never rename. */
  id: string;
  /** Inspector label. English-only today; the inspector copy is too. */
  name: string;
  category: BgPatternCategory;
  /**
   * Full CSS `background` shorthand string. May reference the
   * storefront palette tokens `--sf-ground` / `--sf-ink` /
   * `--sf-accent` (set by `paletteCssVars` on the storefront wrapper).
   * Fallbacks are inlined so the inspector preview tile — which
   * doesn't always have `--sf-*` defined — still renders something
   * sensible.
   */
  css: string;
  /**
   * Optional matching `background-size`. Most patterns embed the size
   * inline via shorthand (`<image> <pos>/<size>`); supply this only
   * when the size needs to be applied as a separate CSS property
   * (rare).
   */
  size?: string;
  /**
   * Optional dark-mode override. When present, the storefront
   * renderer applies it whenever the active theme is dark; otherwise
   * `css` is used in both themes. Use sparingly — most palette-aware
   * patterns auto-adapt via `--sf-*`.
   */
  cssDark?: string;
};

// ── Palette-aware helpers ────────────────────────────────────────────
//
// Every pattern below mixes the storefront ink/accent against the
// ground at low alpha so the marks read as a soft texture instead of a
// loud overlay. `color-mix(in srgb, X N%, transparent)` is the cleanest
// way to do that without requiring per-palette tweaks. We also inline
// `var(--sf-ground, …)` fallbacks so the inspector's 64×40 preview
// tiles render even before a palette is injected.

const ground = 'var(--sf-ground, #e8dcc4)';
const ink = (alpha: number) =>
  `color-mix(in srgb, var(--sf-ink, #1f1b16) ${alpha}%, transparent)`;
const accent = (alpha: number) =>
  `color-mix(in srgb, var(--sf-accent, #c9a961) ${alpha}%, transparent)`;

// SVG noise tile — feTurbulence with a 50%-gray, low-alpha fill. The
// neutral grain reads on both light and dark grounds (dark dots are
// visible on cream, light dots on charcoal — both register as a soft
// texture rather than a directional overlay). Encoded with `%23` for
// `#`; spaces stay literal because UTF-8 data URIs accept them.
const NOISE_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.22 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export const BACKGROUND_PATTERNS: readonly BgPattern[] = [
  // ── DOTS ──────────────────────────────────────────────────────────
  {
    id: 'dots-soft',
    name: 'Soft dots',
    category: 'dots',
    css: `radial-gradient(circle at 1px 1px, ${ink(20)} 1px, transparent 1.5px) 0 0/16px 16px, ${ground}`,
  },
  {
    id: 'dots-bold',
    name: 'Bold dots',
    category: 'dots',
    css: `radial-gradient(circle at 2px 2px, ${ink(34)} 2px, transparent 2.5px) 0 0/22px 22px, ${ground}`,
  },

  // ── GRID ──────────────────────────────────────────────────────────
  {
    id: 'grid-fine',
    name: 'Fine grid',
    category: 'grid',
    css: `linear-gradient(${ink(10)} 1px, transparent 1px) 0 0/24px 24px, linear-gradient(90deg, ${ink(10)} 1px, transparent 1px) 0 0/24px 24px, ${ground}`,
  },
  {
    id: 'grid-graph',
    name: 'Graph paper',
    category: 'grid',
    // Two scales overlaid: 8px hairlines + 80px emphasized rules.
    css: `linear-gradient(${ink(20)} 1px, transparent 1px) 0 0/80px 80px, linear-gradient(90deg, ${ink(20)} 1px, transparent 1px) 0 0/80px 80px, linear-gradient(${ink(7)} 1px, transparent 1px) 0 0/16px 16px, linear-gradient(90deg, ${ink(7)} 1px, transparent 1px) 0 0/16px 16px, ${ground}`,
  },

  // ── STRIPES ───────────────────────────────────────────────────────
  {
    id: 'stripes-diag',
    name: 'Diagonal stripes',
    category: 'stripes',
    css: `repeating-linear-gradient(45deg, ${ink(8)} 0 1px, transparent 1px 12px), ${ground}`,
  },
  {
    id: 'stripes-pinstripe',
    name: 'Pinstripe',
    category: 'stripes',
    css: `repeating-linear-gradient(0deg, ${ink(7)} 0 1px, transparent 1px 6px), ${ground}`,
  },

  // ── GEOMETRIC ─────────────────────────────────────────────────────
  {
    id: 'checker',
    name: 'Checker',
    category: 'geometric',
    // Classic four-layer checker. Two 45° gradients + two -45° offset
    // gradients land alternating squares without any image asset.
    css: `linear-gradient(45deg, ${ink(7)} 25%, transparent 25%) 0 0/24px 24px, linear-gradient(-45deg, ${ink(7)} 25%, transparent 25%) 0 0/24px 24px, linear-gradient(45deg, transparent 75%, ${ink(7)} 75%) 12px 12px/24px 24px, linear-gradient(-45deg, transparent 75%, ${ink(7)} 75%) 12px 12px/24px 24px, ${ground}`,
  },
  {
    id: 'isometric',
    name: 'Isometric',
    category: 'geometric',
    // 30° + 150° + 90° hairlines lay out an isometric cube grid; the
    // accent on the 90° line gives the grid a faint warm cast.
    css: `repeating-linear-gradient(30deg, ${ink(9)} 0 1px, transparent 1px 24px), repeating-linear-gradient(150deg, ${ink(9)} 0 1px, transparent 1px 24px), repeating-linear-gradient(90deg, ${accent(8)} 0 1px, transparent 1px 24px), ${ground}`,
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    category: 'geometric',
    // Theme-locked. Blueprint only reads as itself on a deep-navy
    // ground, so we ignore `--sf-*` and supply both colours
    // explicitly. The pattern looks the same in light and dark — that
    // is the founder's contract when they pick "Blueprint".
    css:
      'linear-gradient(rgba(170,210,255,0.18) 1px, transparent 1px) 0 0/40px 40px, linear-gradient(90deg, rgba(170,210,255,0.18) 1px, transparent 1px) 0 0/40px 40px, linear-gradient(rgba(170,210,255,0.07) 1px, transparent 1px) 0 0/8px 8px, linear-gradient(90deg, rgba(170,210,255,0.07) 1px, transparent 1px) 0 0/8px 8px, #0c2a4a',
  },

  // ── NOISE ─────────────────────────────────────────────────────────
  {
    id: 'paper',
    name: 'Paper fiber',
    category: 'noise',
    // Layered radials at low alpha simulate the look of long fibers in
    // a textured paper stock. Pure CSS — no SVG cost.
    css: `radial-gradient(ellipse 1.5px 18px at 25% 30%, ${ink(8)}, transparent 70%), radial-gradient(ellipse 22px 1.5px at 65% 55%, ${ink(7)}, transparent 70%), radial-gradient(ellipse 1.5px 26px at 80% 80%, ${ink(8)}, transparent 70%), radial-gradient(ellipse 30px 1.5px at 12% 70%, ${ink(7)}, transparent 70%), ${ground}`,
    size: '160px 160px',
  },
  {
    id: 'noise-subtle',
    name: 'Subtle noise',
    category: 'noise',
    // SVG turbulence overlay on the storefront ground. The grain
    // tiles seamlessly via `stitchTiles='stitch'`.
    css: `${NOISE_SVG} 0 0/160px 160px, ${ground}`,
  },

  // ── MESH ──────────────────────────────────────────────────────────
  {
    id: 'mesh-warm',
    name: 'Warm mesh',
    category: 'mesh',
    css: `radial-gradient(at 18% 24%, ${accent(36)} 0, transparent 55%), radial-gradient(at 82% 18%, ${ink(20)} 0, transparent 55%), radial-gradient(at 70% 82%, ${accent(28)} 0, transparent 55%), radial-gradient(at 22% 78%, ${ink(14)} 0, transparent 55%), ${ground}`,
  },
  {
    id: 'mesh-cool',
    name: 'Cool mesh',
    category: 'mesh',
    css: `radial-gradient(at 12% 30%, ${ink(28)} 0, transparent 55%), radial-gradient(at 88% 28%, ${accent(20)} 0, transparent 55%), radial-gradient(at 60% 90%, ${ink(20)} 0, transparent 55%), ${ground}`,
  },
  {
    id: 'conic-burst',
    name: 'Conic burst',
    category: 'mesh',
    // 24-spoke pinwheel; the alpha keeps it subtle enough to sit
    // behind text without competing with foreground content.
    css: `repeating-conic-gradient(from 0deg at 50% 50%, ${ink(10)} 0 7.5deg, transparent 7.5deg 15deg), ${ground}`,
  },

  // ── GRADIENT ──────────────────────────────────────────────────────
  {
    id: 'gradient-aurora',
    name: 'Aurora',
    category: 'gradient',
    css: `linear-gradient(135deg, ${accent(40)} 0%, transparent 45%), linear-gradient(225deg, ${ink(28)} 0%, transparent 55%), ${ground}`,
  },
  {
    id: 'gradient-sunset',
    name: 'Sunset',
    category: 'gradient',
    css: `linear-gradient(180deg, transparent 0%, ${accent(34)} 60%, ${ink(22)} 100%), ${ground}`,
  },
  {
    id: 'gradient-ink',
    name: 'Ink wash',
    category: 'gradient',
    // Diagonal ink wash from corner to corner. Reads as a
    // sophisticated charcoal vignette rather than a loud overlay.
    css: `linear-gradient(135deg, ${ink(24)} 0%, transparent 60%), ${ground}`,
  },
];

/**
 * Lookup helper — used by the inspector to highlight the currently
 * selected pattern when the founder reopens a Site/Hero with a saved
 * `pageBg` / `backgroundCss` string.
 */
export function findPatternByCss(css: string | undefined): BgPattern | undefined {
  if (!css) return undefined;
  return BACKGROUND_PATTERNS.find((p) => p.css === css || p.cssDark === css);
}

/** Stable order for the picker — matches the category list above. */
export const BACKGROUND_PATTERN_CATEGORIES: readonly BgPatternCategory[] = [
  'dots',
  'grid',
  'stripes',
  'geometric',
  'mesh',
  'gradient',
  'noise',
];
