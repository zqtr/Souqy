'use client';

import { useTheme } from './ThemeProvider';

type Props = {
  /** When true, render a tiny icon-only button. Default: icon + label. */
  compact?: boolean;
  /** Optional label override; defaults to active-theme aware copy. */
  label?: string;
  /** Additional className; the component already applies a base style. */
  className?: string;
};

/**
 * Sun / moon icon button that flips the active theme. Persists via the
 * cookie so a hard refresh paints the chosen theme immediately.
 *
 * The button always shows the *target* theme's glyph (i.e. moon when
 * we're in light mode, sun when we're in dark mode) so the icon reads
 * as "click to go to that mode".
 */
export function ThemeToggle({ compact = false, label, className }: Props) {
  const { theme, toggle } = useTheme();
  const targetIsDark = theme === 'light';
  const targetLabel = label ?? (targetIsDark ? 'Dark mode' : 'Light mode');

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${targetIsDark ? 'dark' : 'light'} mode`}
      title={targetLabel}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 0 : 8,
        padding: compact ? 6 : '6px 12px',
        height: compact ? 36 : 34,
        minWidth: compact ? 36 : undefined,
        background: 'color-mix(in srgb, var(--surface-overlay) 82%, transparent)',
        color: 'var(--ink-strong)',
        border: '1px solid var(--surface-rule-strong)',
        borderRadius: compact ? 999 : 8,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        boxShadow: '0 14px 32px rgba(0,0,0,0.12)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        transition:
          'color 160ms ease, border-color 160ms ease, background 160ms ease, transform 160ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--ink-strong)';
        e.currentTarget.style.borderColor = 'var(--surface-rule-strong)';
        e.currentTarget.style.background = 'var(--surface-bg)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--ink-strong)';
        e.currentTarget.style.borderColor = 'var(--surface-rule-strong)';
        e.currentTarget.style.background =
          'color-mix(in srgb, var(--surface-overlay) 82%, transparent)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <ThemeGlyph theme={targetIsDark ? 'dark' : 'light'} />
      {compact ? null : <span>{targetLabel}</span>}
    </button>
  );
}

function ThemeGlyph({ theme }: { theme: 'light' | 'dark' }) {
  if (theme === 'dark') {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
      </svg>
    );
  }
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}
