'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteStorefrontAction } from '@/app/actions/builder';

type Props = {
  slug: string;
  businessName: string;
  /** Root domain for live storefront URLs (`slug.{briefRootDomain}`). */
  briefRootDomain: string;
};

/**
 * Two-step delete affordance for an entire storefront. Clicking
 * "Delete project" opens an inline confirmation panel inside the same
 * card; the founder must retype the slug exactly to enable the final
 * destructive button. Both the client gate and the server action enforce
 * the slug-equality check, so the UI is just for clarity — the action
 * itself rejects mismatched payloads.
 *
 * Uses an absolutely-positioned panel anchored to the bottom-right of
 * the card so the surrounding layout doesn't shift when the founder
 * opens / cancels the confirmation.
 */
export function DeleteStorefrontButton({ slug, businessName, briefRootDomain }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canDelete = confirm.trim() === slug && !pending;

  function close() {
    if (pending) return;
    setOpen(false);
    setConfirm('');
    setError(null);
  }

  function onSubmit() {
    if (!canDelete) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteStorefrontAction({ slug, confirm });
      if (result.status === 'success') {
        // Force a full nav back to /account so the deleted row never
        // briefly re-appears from cached server data.
        router.replace('/account');
        router.refresh();
      } else if (result.status === 'error') {
        setError(result.message);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '6px 10px',
          borderRadius: 999,
          border: '1px solid color-mix(in srgb, #b85c5c 35%, transparent)',
          background: 'transparent',
          color: '#b85c5c',
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        Delete
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-${slug}-title`}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,12,9,0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: 20,
          }}
          onClick={close}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 460,
              width: '100%',
              background: 'var(--surface-elevated)',
              border: '1px solid var(--surface-rule-strong)',
              borderRadius: 12,
              padding: '24px 24px 20px',
              boxShadow: '0 24px 48px -12px rgba(0,0,0,0.5)',
              fontFamily: 'var(--font-sans)',
              color: 'var(--ink-strong)',
            }}
          >
            <div
              id={`delete-${slug}-title`}
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 22,
                lineHeight: 1.15,
                marginBottom: 8,
              }}
            >
              Delete {businessName}?
            </div>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                color: 'var(--ink-muted)',
                margin: '0 0 18px',
              }}
            >
              This permanently removes the storefront, every product attached to
              it, and the live URL at{' '}
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--ink-strong)',
                }}
              >
                {slug}.{briefRootDomain}
              </span>
              . This cannot be undone.
            </p>
            <label
              style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--ink-faint)',
                marginBottom: 6,
              }}
            >
              Type{' '}
              <span style={{ color: 'var(--ink-strong)' }}>{slug}</span>{' '}
              to confirm
            </label>
            <input
              type="text"
              autoFocus
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canDelete) {
                  e.preventDefault();
                  onSubmit();
                }
                if (e.key === 'Escape') close();
              }}
              placeholder={slug}
              spellCheck={false}
              autoComplete="off"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 14,
                fontFamily: 'var(--font-mono)',
                background: 'var(--surface-bg)',
                color: 'var(--ink-strong)',
                border: '1px solid var(--surface-rule-strong)',
                borderRadius: 6,
                outline: 'none',
                marginBottom: 14,
              }}
            />
            {error ? (
              <div
                style={{
                  fontSize: 12,
                  color: '#c45656',
                  marginBottom: 12,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {error}
              </div>
            ) : null}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={close}
                disabled={pending}
                style={{
                  fontSize: 13,
                  padding: '8px 16px',
                  borderRadius: 999,
                  border: '1px solid var(--surface-rule-strong)',
                  background: 'transparent',
                  color: 'var(--ink-strong)',
                  cursor: pending ? 'default' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={!canDelete}
                style={{
                  fontSize: 13,
                  padding: '8px 16px',
                  borderRadius: 999,
                  border: '1px solid #8b3a3a',
                  background: canDelete ? '#8b3a3a' : 'rgba(139,58,58,0.35)',
                  color: '#fff',
                  cursor: canDelete ? 'pointer' : 'not-allowed',
                  fontFamily: 'var(--font-sans)',
                  letterSpacing: '0.01em',
                }}
              >
                {pending ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
