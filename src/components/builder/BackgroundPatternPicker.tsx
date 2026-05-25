'use client';

import { useMemo, useState } from 'react';
import {
  BACKGROUND_PATTERNS,
  BACKGROUND_PATTERN_CATEGORIES,
  type BgPattern,
  type BgPatternCategory,
} from '@/lib/blocks/backgroundPatterns';
import { palettes, type PaletteId } from '@/lib/palettes';

type Props = {
  /** Currently-applied CSS shorthand. Highlights the matching tile. */
  value?: string;
  onPick: (pattern: BgPattern) => void;
  onClear: () => void;
  /**
   * Storefront palette so the preview tiles render the pattern with
   * the founder's actual ink/ground/accent colours instead of the
   * hard-coded fallbacks. Falls back to `sand_gold` if undefined.
   */
  palette?: PaletteId;
  /**
   * Compact = 4-column grid suited to the 280-px right rail. The Hero
   * inspector uses this; the Site inspector uses the same layout but
   * passes `compact = true` explicitly for clarity.
   */
  compact?: boolean;
};

/**
 * Pattern-library picker. Surfaces every entry from
 * `backgroundPatterns.ts` as a 64×40 swatch, gridded 4-up so a founder
 * can scan all categories without scrolling. A category filter row
 * sits above the grid for fast narrowing — "All" is the default.
 *
 * The picker is purely presentational: it never persists state of its
 * own, just calls `onPick` with the chosen pattern. Mutual exclusion
 * with an uploaded image lives in the parent — `onClear` lets a parent
 * surface a "Remove pattern" affordance from the same component.
 */
export function BackgroundPatternPicker({
  value,
  onPick,
  onClear,
  palette = 'sand_gold',
}: Props) {
  const [category, setCategory] = useState<'all' | BgPatternCategory>('all');

  // Inject the storefront's palette into the preview tiles via inline
  // CSS vars. Without this the tiles fall back to the sand_gold
  // hardcoded defaults baked into `backgroundPatterns.ts` and a founder
  // on a coral or midnight palette would see a stranger's swatches.
  const tileVars = useMemo(() => {
    const triplet = palettes[palette]?.light ?? palettes.sand_gold.light;
    return {
      ['--sf-ground' as string]: triplet.ground,
      ['--sf-ink' as string]: triplet.ink,
      ['--sf-accent' as string]: triplet.accent,
    } as React.CSSProperties;
  }, [palette]);

  const visible = useMemo(
    () =>
      category === 'all'
        ? BACKGROUND_PATTERNS
        : BACKGROUND_PATTERNS.filter((p) => p.category === category),
    [category],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        role="radiogroup"
        aria-label="Pattern category"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
        }}
      >
        <CategoryChip
          label="All"
          active={category === 'all'}
          onClick={() => setCategory('all')}
        />
        {BACKGROUND_PATTERN_CATEGORIES.map((c) => (
          <CategoryChip
            key={c}
            label={c.charAt(0).toUpperCase() + c.slice(1)}
            active={category === c}
            onClick={() => setCategory(c)}
          />
        ))}
      </div>

      <div
        role="listbox"
        aria-label="Background patterns"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 6,
          ...tileVars,
        }}
      >
        {visible.map((p) => {
          const selected = value === p.css;
          return (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={selected}
              title={p.name}
              onClick={() => onPick(p)}
              style={{
                position: 'relative',
                width: '100%',
                height: 40,
                padding: 0,
                borderRadius: 4,
                border: selected
                  ? '1px solid var(--bld-text-muted)'
                  : '1px solid var(--bld-divider)',
                background: p.css,
                ...(p.size ? { backgroundSize: p.size } : {}),
                cursor: 'pointer',
                outline: selected
                  ? '2px solid var(--bld-text-muted)'
                  : 'none',
                outlineOffset: -2,
              }}
            />
          );
        })}
      </div>

      {value ? (
        <button
          type="button"
          onClick={onClear}
          style={{
            alignSelf: 'flex-start',
            background: 'transparent',
            border: 'none',
            padding: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--bld-text-muted)',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Clear pattern
        </button>
      ) : null}
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      style={{
        padding: '4px 8px',
        borderRadius: 3,
        border: '1px solid var(--bld-divider)',
        background: active ? 'var(--bld-input-bg)' : 'transparent',
        color: active ? 'var(--bld-input-text)' : 'var(--bld-text-muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
