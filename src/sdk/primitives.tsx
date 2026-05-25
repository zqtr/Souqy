import 'server-only';
import type { CSSProperties, ReactNode } from 'react';
import { useSouqyContext } from './runtime';

/**
 * Pure presentational primitives. They don't read storefront data — they
 * exist so Claude can compose layouts without falling back to raw `<div>`
 * with arbitrary inline styles. Constraining the surface keeps generated
 * code reviewable and consistent with Souqna's editorial language.
 */

const SECTION_PAD: Record<NonNullable<SectionProps['size']>, string> = {
  tight: 'clamp(20px, 3vw, 36px)',
  comfortable: 'clamp(36px, 5vw, 64px)',
  spacious: 'clamp(56px, 8vw, 112px)',
};

type Tone = 'default' | 'sand' | 'ink' | 'gold' | 'transparent';
const TONE_BG: Record<Tone, string> = {
  default: 'transparent',
  sand: 'var(--sf-ground)',
  ink: 'var(--sf-ink)',
  gold: 'var(--sf-accent)',
  transparent: 'transparent',
};

export type SectionProps = {
  /** Vertical breathing room. Defaults to `comfortable`. */
  size?: 'tight' | 'comfortable' | 'spacious';
  /** Background fill. `default` defers to the page palette ground. */
  tone?: Tone;
  /** Content alignment. Defaults to `start`. */
  align?: 'start' | 'center' | 'end';
  /** Optional max content width. Defaults to the storefront's max. */
  maxWidth?: number;
  id?: string;
  children?: ReactNode;
};

/**
 * Editorial section wrapper — vertical padding, optional tone fill,
 * centred max-width column. Ninety-five percent of generated layouts
 * should put their content inside one of these.
 */
export function Section({
  size = 'comfortable',
  tone = 'default',
  align = 'start',
  maxWidth,
  id,
  children,
}: SectionProps) {
  const padding = SECTION_PAD[size];
  return (
    <section
      id={id}
      style={{
        paddingBlock: padding,
        paddingInline: 'clamp(20px, 3vw, 40px)',
        background: TONE_BG[tone],
        color:
          tone === 'ink'
            ? 'var(--sf-ground)'
            : tone === 'gold'
              ? 'var(--sf-ink)'
              : 'var(--sf-ink)',
        textAlign: align === 'start' ? 'left' : align,
      }}
    >
      <div
        style={{
          maxWidth: maxWidth ?? 'min(1080px, 92vw)',
          marginInline: 'auto',
        }}
      >
        {children}
      </div>
    </section>
  );
}

export type StackProps = {
  gap?: number;
  align?: 'start' | 'center' | 'end' | 'stretch';
  direction?: 'column' | 'row';
  wrap?: boolean;
  justify?: 'start' | 'center' | 'end' | 'between';
  children?: ReactNode;
};

/** Vertical (or horizontal) stack with consistent gaps. */
export function Stack({
  gap = 16,
  align = 'stretch',
  direction = 'column',
  wrap = false,
  justify = 'start',
  children,
}: StackProps) {
  const justifyMap = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    between: 'space-between',
  } as const;
  const alignMap = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    stretch: 'stretch',
  } as const;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction,
        gap,
        alignItems: alignMap[align],
        justifyContent: justifyMap[justify],
        flexWrap: wrap ? 'wrap' : 'nowrap',
      }}
    >
      {children}
    </div>
  );
}

export type GridProps = {
  columns?: 1 | 2 | 3 | 4 | 6;
  gap?: number;
  /** Switch to a single column under this breakpoint (in px). */
  collapseAt?: number;
  children?: ReactNode;
};

/** Responsive equal-column grid. Collapses to one column on narrow viewports. */
export function Grid({ columns = 3, gap = 16, collapseAt = 720, children }: GridProps) {
  const css: CSSProperties = {
    display: 'grid',
    gap,
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
  };
  return (
    <>
      <div className={`souqy-grid-c${columns}`} style={css}>
        {children}
      </div>
      <style>{`
        @media (max-width: ${collapseAt}px) {
          .souqy-grid-c${columns} { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

export type QuoteProps = {
  /** The quoted text. */
  children?: ReactNode;
  /** Optional attribution line shown below in mono caps. */
  cite?: string;
};

/** Editorial pull-quote in serif italic. Centred, with rule lines. */
export function Quote({ children, cite }: QuoteProps) {
  return (
    <figure
      style={{
        margin: 0,
        textAlign: 'center',
        paddingBlock: 'clamp(24px, 4vw, 48px)',
        borderBlock: '1px solid color-mix(in oklab, var(--sf-ink) 15%, transparent)',
      }}
    >
      <blockquote
        style={{
          margin: 0,
          fontFamily: 'var(--font-serif), serif',
          fontStyle: 'italic',
          fontSize: 'clamp(20px, 2.4vw, 32px)',
          lineHeight: 1.35,
          color: 'var(--sf-ink)',
        }}
      >
        {children}
      </blockquote>
      {cite ? (
        <figcaption
          style={{
            marginTop: 14,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--sf-accent)',
          }}
        >
          — {cite}
        </figcaption>
      ) : null}
    </figure>
  );
}

export type MarqueeProps = {
  /** Items to scroll across. Strings get rendered with mono separators. */
  items: string[];
  speed?: 'slow' | 'medium' | 'fast';
};

/** A single-row marquee — the editorial "framing rail" at section seams. */
export function Marquee({ items, speed = 'medium' }: MarqueeProps) {
  const duration = speed === 'slow' ? 60 : speed === 'fast' ? 20 : 36;
  const isRtl = useSouqyContext().isRtl;
  // Doubled track so the loop never reveals a seam.
  const track = [...items, ...items];
  return (
    <div
      style={{
        overflow: 'hidden',
        borderBlock: '1px solid color-mix(in oklab, var(--sf-ink) 12%, transparent)',
        paddingBlock: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 32,
          width: 'max-content',
          animation: `souqy-marquee ${duration}s linear infinite ${isRtl ? 'reverse' : 'normal'}`,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--sf-accent)',
        }}
      >
        {track.map((item, i) => (
          <span key={`${item}-${i}`} style={{ display: 'inline-flex', gap: 32 }}>
            {item}
            <span aria-hidden style={{ opacity: 0.4 }}>
              ◈
            </span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes souqy-marquee {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(-50%, 0, 0); }
        }
      `}</style>
    </div>
  );
}
