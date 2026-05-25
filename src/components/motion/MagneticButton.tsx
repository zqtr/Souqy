'use client';

import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { palette } from '@/lib/tokens';

type Variant = 'gold' | 'ghost' | 'ink';

type Props = {
  children: ReactNode;
  href?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
  variant?: Variant;
  ariaLabel?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
};

/**
 * Magnetic button with a soft pull toward the cursor. Reduced-motion users
 * get a static button. Used as both anchor and submit.
 *
 * The `gold` variant is the brand's primary CTA — styled like an atelier
 * seal: subtle gradient fill, inset hairline ring (the "stamp" rule),
 * a small italic-serif numeral flourish before the label, and a refined
 * arrow capsule that pulses on hover. `ghost` and `ink` keep their
 * original quieter shapes for nav and inline actions.
 */
export function MagneticButton({
  children,
  href,
  onClick,
  variant = 'gold',
  ariaLabel,
  type = 'button',
  disabled,
  className = '',
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 300, damping: 22, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 300, damping: 22, mass: 0.4 });

  function onMove(e: MouseEvent<HTMLElement>) {
    if (reduced) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) * 0.18);
    y.set((e.clientY - cy) * 0.35);
  }
  function onLeave() {
    x.set(0);
    y.set(0);
    setHovered(false);
  }

  const inner =
    variant === 'gold' ? (
      <GoldSeal
        innerRef={ref}
        sx={sx}
        sy={sy}
        hovered={hovered}
        disabled={disabled}
      >
        {children}
      </GoldSeal>
    ) : (
      <PlainPill
        innerRef={ref}
        sx={sx}
        sy={sy}
        variant={variant}
        disabled={disabled}
      >
        {children}
      </PlainPill>
    );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel}
        onMouseMove={onMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={onLeave}
        onClick={onClick}
        className={`inline-block no-underline ${className}`}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      onMouseMove={onMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={onLeave}
      onClick={onClick}
      disabled={disabled}
      className={`appearance-none border-0 bg-transparent p-0 ${className}`}
    >
      {inner}
    </button>
  );
}

/* ----------------------------- gold variant ----------------------------- */

type SealProps = {
  innerRef: React.RefObject<HTMLDivElement>;
  sx: ReturnType<typeof useSpring>;
  sy: ReturnType<typeof useSpring>;
  hovered: boolean;
  disabled?: boolean;
  children: ReactNode;
};

function GoldSeal({ innerRef, sx, sy, hovered, disabled, children }: SealProps) {
  return (
    <motion.div
      ref={innerRef}
      style={{
        x: sx,
        y: sy,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 14,
        padding: '15px 22px 15px 18px',
        borderRadius: 999,
        background: `linear-gradient(180deg, ${palette.gold} 0%, ${palette.goldDeep} 100%)`,
        color: 'var(--ink-on-gold)',
        fontFamily: 'var(--font-sans)',
        fontWeight: 500,
        fontSize: 14,
        letterSpacing: '-0.01em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        boxShadow: hovered
          ? `inset 0 0 0 1px rgba(31,27,22,0.22), 0 0 0 4px rgba(201,169,97,0.18), 0 14px 28px rgba(31,27,22,0.18), 0 1px 0 rgba(255,255,255,0.35) inset`
          : `inset 0 0 0 1px rgba(31,27,22,0.22), 0 1px 0 rgba(255,255,255,0.32) inset, 0 6px 14px rgba(31,27,22,0.10)`,
        transition: 'box-shadow 280ms ease',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 4,
          borderRadius: 999,
          border: '1px solid rgba(31,27,22,0.18)',
          pointerEvents: 'none',
        }}
      />

      <span
        aria-hidden
        style={{
          fontFamily: 'var(--font-serif), serif',
          fontStyle: 'italic',
          fontSize: 15,
          fontWeight: 400,
          color: 'var(--ink-on-gold)',
          opacity: 0.85,
          marginInlineStart: 4,
          letterSpacing: 0,
          lineHeight: 1,
          transform: 'translateY(-1px)',
        }}
      >
        I
      </span>

      <span
        aria-hidden
        style={{
          width: 1,
          height: 14,
          background: 'rgba(31,27,22,0.22)',
          alignSelf: 'center',
        }}
      />

      <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>

      <span
        aria-hidden
        className="rtl-flip-arrow"
        style={{
          position: 'relative',
          width: 26,
          height: 26,
          borderRadius: 999,
          background: hovered ? 'var(--ink-on-gold)' : 'rgba(31,27,22,0.12)',
          color: hovered ? 'var(--color-gold)' : 'var(--ink-on-gold)',
          border: '1px solid rgba(31,27,22,0.35)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          lineHeight: 1,
          marginInlineStart: 2,
          transition:
            'background 240ms ease, color 240ms ease, transform 320ms cubic-bezier(0.2,0.7,0.15,1)',
          transform: hovered ? 'translateX(2px)' : 'translateX(0)',
        }}
      >
        →
      </span>
    </motion.div>
  );
}

/* --------------------------- ghost / ink variants --------------------------- */

type PlainProps = {
  innerRef: React.RefObject<HTMLDivElement>;
  sx: ReturnType<typeof useSpring>;
  sy: ReturnType<typeof useSpring>;
  variant: Exclude<Variant, 'gold'>;
  disabled?: boolean;
  children: ReactNode;
};

const plainStyle: Record<Exclude<Variant, 'gold'>, CSSProperties> = {
  ink: {
    background: 'var(--surface-contrast)',
    color: 'var(--ink-on-contrast)',
    borderColor: 'var(--surface-contrast)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--ink-strong)',
    borderColor: 'var(--surface-rule-strong)',
  },
};

function PlainPill({ innerRef, sx, sy, variant, disabled, children }: PlainProps) {
  return (
    <motion.div
      ref={innerRef}
      style={{
        ...plainStyle[variant],
        x: sx,
        y: sy,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 20px 14px 22px',
        border: '1px solid',
        borderRadius: 999,
        fontFamily: 'var(--font-sans)',
        fontWeight: 500,
        fontSize: 13.5,
        letterSpacing: '-0.005em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span>{children}</span>
      <span
        aria-hidden
        className="rtl-flip-arrow"
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: 'transparent',
          color: 'currentColor',
          border: '1px solid currentColor',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          lineHeight: 1,
        }}
      >
        →
      </span>
    </motion.div>
  );
}
