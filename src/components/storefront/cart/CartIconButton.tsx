'use client';

import { useCart } from './CartContext';

/**
 * Header cart trigger. Hidden entirely when checkout isn't enabled —
 * letting the storefront fall back to the inquiry-first flow without
 * a dangling icon.
 *
 * Floating, fixed-position. Uses logical inset (`insetInlineEnd`) so
 * it lands on the right in en and the left in ar.
 */
export function CartIconButton({
  label = 'Cart',
  ariaLabel,
}: {
  label?: string;
  ariaLabel?: string;
} = {}) {
  const cart = useCart();
  if (!cart.enabled) return null;

  const count = cart.count;

  return (
    <button
      type="button"
      onClick={cart.open}
      aria-label={
        ariaLabel ??
        (count > 0 ? `${label} — ${count} item${count === 1 ? '' : 's'}` : label)
      }
      style={{
        position: 'fixed',
        top: 'max(20px, env(safe-area-inset-top))',
        insetInlineEnd: 20,
        zIndex: 60,
        width: 44,
        height: 44,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--sf-ground, var(--surface-bg))',
        color: 'var(--sf-ink, var(--ink-strong))',
        border:
          '1px solid color-mix(in srgb, var(--sf-ink, var(--ink-strong)) 14%, transparent)',
        borderRadius: 999,
        boxShadow: '0 6px 20px -10px rgba(0,0,0,0.25)',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <span aria-hidden style={{ display: 'inline-flex' }}>
        <ShoppingBagSvg />
      </span>
      {count > 0 ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -4,
            insetInlineEnd: -4,
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 999,
            background: 'var(--sf-accent, var(--color-gold-deep))',
            color: '#fff',
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            border: '2px solid var(--sf-ground, var(--surface-bg))',
            boxSizing: 'content-box',
          }}
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </button>
  );
}

function ShoppingBagSvg() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}
