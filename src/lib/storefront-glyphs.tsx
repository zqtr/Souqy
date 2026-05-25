import type { CSSProperties } from 'react';
import type { BusinessType } from './brief';

/**
 * Type glyphs — one editorial mark per business type, drawn in the same
 * grammar as the arch (single stroke, currentColor, square caps, 64×64
 * viewBox). They sit alongside the business name to give each storefront
 * a quiet visual signature without resorting to literal app icons.
 *
 * Always render with `color: var(--sf-accent)` (or any palette colour) on
 * a wrapping element — every path uses `stroke="currentColor"`.
 */

type GlyphProps = {
  type: BusinessType;
  size?: number;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
};

export function StorefrontGlyph({
  type,
  size = 40,
  className,
  style,
  ariaLabel,
}: GlyphProps) {
  const Glyph = GLYPHS[type] ?? GLYPHS.something_else;
  const sw = Math.max(1, (size / 40) * 1.3);
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
      style={{ display: 'block', color: 'currentColor', ...style }}
    >
      <Glyph sw={sw} />
    </svg>
  );
}

type PathProps = { sw: number };
type GlyphComponent = (p: PathProps) => React.JSX.Element;

const stroke = (sw: number, opacity?: number) => ({
  stroke: 'currentColor',
  strokeWidth: sw,
  strokeLinecap: 'square' as const,
  strokeLinejoin: 'miter' as const,
  fill: 'none' as const,
  opacity,
});

const GLYPHS: Record<BusinessType, GlyphComponent> = {
  // Two stacked frames, like layered artboards.
  graphic_design: ({ sw }) => (
    <g {...stroke(sw)}>
      <rect x="12" y="12" width="30" height="30" />
      <rect x="22" y="22" width="30" height="30" {...stroke(sw, 0.55)} />
    </g>
  ),

  // Coat hanger silhouette: hook + apex + bar.
  clothing_store: ({ sw }) => (
    <g {...stroke(sw)}>
      <circle cx="32" cy="14" r="3" />
      <path d="M 32 17 L 32 24" />
      <path d="M 14 44 L 32 24 L 50 44" />
      <path d="M 12 44 L 52 44" />
    </g>
  ),

  // A lidded pot with three rising wisps of steam.
  home_kitchen: ({ sw }) => (
    <g {...stroke(sw)}>
      <path d="M 12 32 L 52 32" />
      <path d="M 16 32 L 16 50 L 48 50 L 48 32" />
      <path d="M 22 24 q 4 -4 0 -10" {...stroke(sw, 0.6)} />
      <path d="M 32 24 q 4 -4 0 -10" {...stroke(sw, 0.6)} />
      <path d="M 42 24 q 4 -4 0 -10" {...stroke(sw, 0.6)} />
    </g>
  ),

  // Open scissors: two finger loops + crossing blades.
  salon: ({ sw }) => (
    <g {...stroke(sw)}>
      <circle cx="20" cy="46" r="6" />
      <circle cx="44" cy="46" r="6" />
      <path d="M 24 42 L 50 14" />
      <path d="M 40 42 L 14 14" />
    </g>
  ),

  // Coffee cup with handle + saucer + steam.
  cafe: ({ sw }) => (
    <g {...stroke(sw)}>
      <path d="M 18 28 L 18 44 Q 18 50 24 50 L 36 50 Q 42 50 42 44 L 42 28 Z" />
      <path d="M 42 32 Q 50 32 50 38 Q 50 44 42 44" />
      <path d="M 12 54 L 48 54" />
      <path d="M 24 22 q 4 -4 0 -10" {...stroke(sw, 0.6)} />
      <path d="M 36 22 q 4 -4 0 -10" {...stroke(sw, 0.6)} />
    </g>
  ),

  // Tied parcel: rectangle + cross strap.
  ecommerce: ({ sw }) => (
    <g {...stroke(sw)}>
      <rect x="12" y="20" width="40" height="32" />
      <path d="M 12 30 L 52 30" />
      <path d="M 32 20 L 32 52" />
    </g>
  ),

  // House with door — pitched roof + walls + offset opening.
  real_estate: ({ sw }) => (
    <g {...stroke(sw)}>
      <path d="M 14 32 L 32 16 L 50 32" />
      <path d="M 18 32 L 18 52 L 46 52 L 46 32" />
      <rect x="28" y="38" width="8" height="14" {...stroke(sw, 0.6)} />
    </g>
  ),

  // Aperture — hexagonal iris with central pupil.
  photography: ({ sw }) => (
    <g {...stroke(sw)}>
      <polygon points="32,12 50,22 50,42 32,52 14,42 14,22" />
      <circle cx="32" cy="32" r="7" {...stroke(sw, 0.6)} />
    </g>
  ),

  // Open codex with center spine.
  tutoring: ({ sw }) => (
    <g {...stroke(sw)}>
      <path d="M 12 22 L 32 28 L 52 22 L 52 48 L 32 54 L 12 48 Z" />
      <path d="M 32 28 L 32 54" />
    </g>
  ),

  // Barbell: two plates joined by a bar.
  fitness: ({ sw }) => (
    <g {...stroke(sw)}>
      <rect x="10" y="22" width="8" height="20" />
      <rect x="46" y="22" width="8" height="20" />
      <path d="M 18 32 L 46 32" />
    </g>
  ),

  // Faceted attar flask: shouldered bottle, stopper, single rising wisp.
  perfume_oud: ({ sw }) => (
    <g {...stroke(sw)}>
      <path d="M 28 22 L 36 22 L 36 28 L 44 32 L 44 52 L 20 52 L 20 32 L 28 28 Z" />
      <path d="M 30 14 L 34 14 L 34 22 L 30 22 Z" />
      <path d="M 32 8 q 4 -3 0 -6" {...stroke(sw, 0.55)} />
    </g>
  ),

  // Side-profile sedan with a polish sparkle above the roof.
  auto_detailing: ({ sw }) => (
    <g {...stroke(sw)}>
      <path d="M 8 42 L 16 30 L 32 28 L 44 28 L 54 36 L 56 42" />
      <path d="M 6 42 L 58 42 L 58 48 L 6 48 Z" />
      <circle cx="18" cy="48" r="4" />
      <circle cx="46" cy="48" r="4" />
      <path d="M 46 16 L 46 22 M 43 19 L 49 19" {...stroke(sw, 0.55)} />
    </g>
  ),

  // Arched canopy on two columns — a wedding majlis.
  events_weddings: ({ sw }) => (
    <g {...stroke(sw)}>
      <path d="M 12 24 Q 32 4 52 24" />
      <path d="M 12 24 L 12 52" />
      <path d="M 52 24 L 52 52" />
      <path d="M 8 52 L 56 52" />
      <path d="M 22 52 L 22 36 Q 32 28 42 36 L 42 52" {...stroke(sw, 0.6)} />
    </g>
  ),

  // Wheat sprig: central stem with paired grains.
  agriculture: ({ sw }) => (
    <g {...stroke(sw)}>
      <path d="M 32 16 L 32 52" />
      <path d="M 32 24 L 24 18 M 32 24 L 40 18" />
      <path d="M 32 32 L 22 26 M 32 32 L 42 26" />
      <path d="M 32 40 L 22 34 M 32 40 L 42 34" />
      <path d="M 32 48 L 24 42 M 32 48 L 40 42" />
    </g>
  ),

  // Tied parcel with a trailing motion line — a courier on the move.
  courier_delivery: ({ sw }) => (
    <g {...stroke(sw)}>
      <rect x="20" y="22" width="32" height="26" />
      <path d="M 20 30 L 52 30" />
      <path d="M 36 22 L 36 48" />
      <path d="M 6 30 L 14 30" {...stroke(sw, 0.55)} />
      <path d="M 4 38 L 16 38" {...stroke(sw, 0.55)} />
      <path d="M 6 46 L 14 46" {...stroke(sw, 0.55)} />
    </g>
  ),

  // L-shaped builder's square.
  contracting: ({ sw }) => (
    <g {...stroke(sw)}>
      <path d="M 14 14 L 50 14 L 50 22 L 22 22 L 22 50 L 14 50 Z" />
      <path d="M 30 14 L 30 18" {...stroke(sw, 0.55)} />
      <path d="M 38 14 L 38 18" {...stroke(sw, 0.55)} />
      <path d="M 22 30 L 18 30" {...stroke(sw, 0.55)} />
      <path d="M 22 38 L 18 38" {...stroke(sw, 0.55)} />
    </g>
  ),

  // Picture frame within a frame.
  art_gallery: ({ sw }) => (
    <g {...stroke(sw)}>
      <rect x="12" y="12" width="40" height="40" />
      <rect x="20" y="20" width="24" height="24" {...stroke(sw, 0.55)} />
    </g>
  ),

  // Needle drawing thread through a curling loop.
  tailoring_abaya: ({ sw }) => (
    <g {...stroke(sw)}>
      <circle cx="20" cy="16" r="4" />
      <path d="M 23 19 L 50 46" />
      <path d="M 50 46 L 50 52 L 44 52" />
      <path d="M 14 46 q -4 -8 4 -12 q 12 -6 14 6" {...stroke(sw, 0.55)} />
    </g>
  ),

  // Bottle silhouette: shoulders + body + label band.
  fnb_brand: ({ sw }) => (
    <g {...stroke(sw)}>
      <path d="M 28 12 L 36 12 L 36 22 L 42 28 L 42 52 L 22 52 L 22 28 L 28 22 Z" />
      <path d="M 22 36 L 42 36" {...stroke(sw, 0.55)} />
      <path d="M 22 44 L 42 44" {...stroke(sw, 0.55)} />
    </g>
  ),

  // Diamond inscribed in a square — a placeholder for "everything else".
  something_else: ({ sw }) => (
    <g {...stroke(sw)}>
      <rect x="12" y="12" width="40" height="40" />
      <path d="M 32 12 L 52 32 L 32 52 L 12 32 Z" {...stroke(sw, 0.55)} />
    </g>
  ),
};
