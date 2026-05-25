import { ArchMark } from './ArchMark';
import { palette } from '@/lib/tokens';

type Props = {
  size?: number;
  color?: string;
  divider?: string;
  showMark?: boolean;
  ariaLabel?: string;
};

/**
 * Souqna | سوقنا — bilingual wordmark, equal weight.
 * Order is fixed (Latin + divider + Arabic) regardless of document direction
 * — the lockup itself is a logo, not flowing text.
 *
 * `color` defaults to the semantic ink token so the wordmark flips with
 * the active theme. Pass an explicit color when rendering on a fixed
 * surface (e.g. brand-book swatches, dark splash screens).
 */
export function Wordmark({
  size = 28,
  color = 'var(--ink-strong)',
  divider = palette.gold,
  showMark = true,
  ariaLabel = 'Souqna',
}: Props) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: size * 0.55,
        direction: 'ltr',
      }}
    >
      {showMark && <ArchMark size={size * 1.15} stroke={divider} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.55 }}>
        <span
          aria-hidden
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            fontSize: size,
            letterSpacing: '-0.025em',
            color,
            lineHeight: 1,
          }}
        >
          Souqna
        </span>
        <span
          aria-hidden
          style={{
            width: 1,
            height: size * 0.95,
            background: divider,
            opacity: 0.55,
          }}
        />
        <span
          aria-hidden
          dir="rtl"
          style={{
            fontFamily: 'var(--font-arabic)',
            fontWeight: 500,
            fontSize: size * 0.95,
            color,
            lineHeight: 1,
          }}
        >
          سوقنا
        </span>
      </div>
    </div>
  );
}
