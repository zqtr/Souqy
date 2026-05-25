'use client';

import { useEffect, useState } from 'react';
import { useBuilderCopy } from './BuilderCopyContext';

const STORAGE_KEY = 'souqna:builder:orientation-dismissed';

/**
 * Soft prompt asking mobile-portrait visitors to rotate their phone for
 * the full builder experience. Visual editing is a desktop-class task —
 * the cramped 420px portrait drawer collapses two-column controls and
 * makes hit targets dicey. Landscape on a phone is ~800px which fits
 * the 2-pane layout comfortably and trips the existing desktop CSS.
 *
 * Not a hard lock: the dismiss link lets the founder continue in
 * portrait for quick edits (toggle a block visibility, fix a typo).
 * Persists dismissal in localStorage so power users see it once per
 * device. Re-appears if they orient back to landscape and then to
 * portrait — that's intentional, the answer to "is this still cramped?"
 * shouldn't change just because they answered "yes" earlier.
 *
 * Visibility is gated by CSS: a portrait + ≤767px media query controls
 * `display`, so the component returns markup unconditionally and the
 * server-rendered HTML matches the hydrated client (no theme flicker).
 */
export function BuilderOrientationHint() {
  const [dismissed, setDismissed] = useState(false);
  const { builder: copy } = useBuilderCopy();

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === '1') {
        setDismissed(true);
      }
    } catch {
      // Private mode / disabled storage — fall through, the banner
      // shows but they can dismiss it again every visit. Non-fatal.
    }
  }, []);

  if (dismissed) return null;

  return (
    <div
      className="souqna-builder-orientation-hint"
      role="status"
      aria-live="polite"
      style={{
        // Hidden by default; the matching @media block in BuilderShell's
        // scoped style sheet flips it to flex on mobile portrait only.
        display: 'none',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        background: 'var(--bld-accent)',
        color: 'var(--bld-accent-ink)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.06em',
        lineHeight: 1.45,
      }}
    >
      <span aria-hidden style={{ display: 'inline-flex', flexShrink: 0 }}>
        <RotateGlyph />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>{copy.orientation.message}</span>
      <button
        type="button"
        onClick={() => {
          try {
            window.localStorage.setItem(STORAGE_KEY, '1');
          } catch {
            // ignore storage errors
          }
          setDismissed(true);
        }}
        style={{
          background: 'transparent',
          border: '1px solid color-mix(in srgb, var(--bld-accent-ink) 40%, transparent)',
          color: 'var(--bld-accent-ink)',
          padding: '5px 10px',
          borderRadius: 999,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {copy.orientation.dismiss}
      </button>
    </div>
  );
}

function RotateGlyph() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x={4} y={2.5} width={11} height={19} rx={2} />
      <path d="M21 13a8 8 0 0 1-7.5 7.5" />
      <path d="M18 16l3-3-3-3" />
    </svg>
  );
}
