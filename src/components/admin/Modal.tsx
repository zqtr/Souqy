'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Centered modal dialog used by the admin product/category editors.
 *
 * Tokenised against the surface palette so it works in both light and
 * dark themes. Renders into a portal so the dialog is never trapped
 * inside an overflow-hidden ancestor (the products page wrapper clips
 * scrolls otherwise). Closes on ESC, click-outside, or by clicking the
 * dedicated close affordance.
 */

type Size = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAX_WIDTH: Record<Size, number> = {
  sm: 420,
  md: 560,
  lg: 720,
  xl: 960,
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /**
   * Optional eyebrow shown above the title (small uppercase mono).
   * Useful for indicating the parent storefront, e.g. "souqy".
   */
  eyebrow?: string;
  size?: Size;
  /**
   * Content rendered inside the scrollable card body.
   */
  children: React.ReactNode;
  /**
   * Optional sticky footer slot (typically Cancel/Save buttons).
   */
  footer?: React.ReactNode;
  /**
   * If true (default), clicking the dimmed backdrop dismisses the
   * dialog. Set false for destructive flows that should require an
   * explicit cancel.
   */
  dismissOnBackdrop?: boolean;
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  eyebrow,
  size = 'md',
  children,
  footer,
  dismissOnBackdrop = true,
}: Props) {
  const titleId = useId();
  const subtitleId = useId();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // ESC to close + lock background scroll while open. Mirrors the
  // accessibility behaviour the InquireDialog ships on the storefront.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Defer focus to next paint so the portal contents have rendered.
    const t = window.setTimeout(() => {
      const target = bodyRef.current?.querySelector<HTMLElement>(
        'input,textarea,select,button,[tabindex]:not([tabindex="-1"])',
      );
      target?.focus();
    }, 16);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={subtitle ? subtitleId : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,17,14,0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'souqna-modal-fade 140ms ease-out',
      }}
      onClick={(e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={bodyRef}
        style={{
          width: '100%',
          maxWidth: SIZE_MAX_WIDTH[size],
          maxHeight: 'calc(100vh - 40px)',
          background: 'var(--surface-elevated)',
          color: 'var(--ink-strong)',
          border: '1px solid var(--surface-rule)',
          borderRadius: 14,
          boxShadow: '0 40px 80px -30px rgba(0,0,0,0.55)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <header
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--surface-rule)',
            position: 'relative',
          }}
        >
          {eyebrow ? (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--admin-accent)',
                marginBottom: 6,
              }}
            >
              {eyebrow}
            </div>
          ) : null}
          <h2
            id={titleId}
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif)',
              fontWeight: 400,
              fontSize: 22,
              letterSpacing: '-0.01em',
              color: 'var(--ink-strong)',
            }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p
              id={subtitleId}
              style={{
                margin: '6px 0 0',
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--ink-muted)',
              }}
            >
              {subtitle}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              width: 32,
              height: 32,
              borderRadius: 999,
              border: '1px solid var(--surface-rule)',
              background: 'var(--surface-bg)',
              color: 'var(--ink-muted)',
              fontSize: 16,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </header>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '20px 24px',
          }}
        >
          {children}
        </div>

        {footer ? (
          <footer
            style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--surface-rule)',
              background: 'var(--surface-bg)',
              display: 'flex',
              gap: 10,
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            {footer}
          </footer>
        ) : null}
      </div>

      <style>{`
        @keyframes souqna-modal-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
