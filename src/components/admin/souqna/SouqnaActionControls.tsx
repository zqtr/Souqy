'use client';

import { useFormStatus } from 'react-dom';

type ActionTone = 'neutral' | 'primary' | 'danger';

const toneStyles: Record<ActionTone, React.CSSProperties> = {
  neutral: {
    background: 'transparent',
    color: 'var(--ink-strong)',
    border: '1px solid color-mix(in srgb, var(--ink-strong) 16%, transparent)',
  },
  primary: {
    background: 'var(--ink-strong)',
    color: 'var(--surface-bg)',
    border: '1px solid var(--ink-strong)',
  },
  danger: {
    background: 'color-mix(in srgb, var(--color-maroon, #8b3a3a) 12%, transparent)',
    color: 'var(--color-maroon, #8b3a3a)',
    border: '1px solid color-mix(in srgb, var(--color-maroon, #8b3a3a) 34%, transparent)',
  },
};

export function SouqnaActionButton({
  children,
  pendingLabel,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  pendingLabel: string;
  tone?: ActionTone;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      style={{
        minHeight: 34,
        borderRadius: 8,
        padding: '0 12px',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: pending ? 'progress' : 'pointer',
        opacity: pending ? 0.72 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        transition: 'opacity 160ms ease, transform 160ms ease',
        ...toneStyles[tone],
      }}
    >
      {pending ? <SouqnaSpinner /> : null}
      {pending ? pendingLabel : children}
    </button>
  );
}

export function SouqnaReasonInput({ placeholder }: { placeholder: string }) {
  const { pending } = useFormStatus();

  return (
    <input
      name="reason"
      placeholder={placeholder}
      disabled={pending}
      style={{
        minHeight: 34,
        minWidth: 220,
        borderRadius: 8,
        border: '1px solid color-mix(in srgb, var(--ink-strong) 12%, transparent)',
        background: 'var(--surface-bg)',
        color: 'var(--ink-strong)',
        padding: '0 10px',
        fontSize: 12.5,
        opacity: pending ? 0.64 : 1,
      }}
    />
  );
}

function SouqnaSpinner() {
  return (
    <>
      <span
        aria-hidden="true"
        style={{
          width: 12,
          height: 12,
          borderRadius: 999,
          border: '2px solid currentColor',
          borderBlockStartColor: 'transparent',
          display: 'inline-block',
          animation: 'souqna-action-spin 720ms linear infinite',
        }}
      />
      <style>
        {`
          @keyframes souqna-action-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </>
  );
}
