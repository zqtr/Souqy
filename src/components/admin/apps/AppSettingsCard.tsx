'use client';

import { type ReactNode, useState, useTransition } from 'react';
import { Surface } from '../primitives';

/**
 * Shared chrome for every per-app Settings card on the configure page.
 *
 * Owns: card header (eyebrow + title), the Save button, the "Saved"
 * pill, and the error banner. Each plugin's actual fields live in
 * `children`; the parent passes a `save` callback that returns a
 * `{ status: 'success' | 'error'; message?: string }` shape.
 *
 * Mirrors the visual language of `CurrencyConverterSettingsForm` so
 * the marketplace looks coherent end-to-end.
 */
/**
 * Mirrors `AppActionState` from `@/app/actions/apps` plus a few result
 * shapes that some actions return. We accept the wider union here so
 * every plugin's settings card can hand its server action straight in
 * without having to map the response.
 *
 * The `idle` case is never produced by an action that has actually
 * been invoked, but it's part of the union for `useFormState` callers.
 * We treat it as a silent no-op.
 */
type SaveResult =
  | { status: 'idle' }
  | { status: 'success'; appId?: string; [key: string]: unknown }
  | { status: 'error'; message: string };

export function AppSettingsCard({
  eyebrow,
  title,
  description,
  saveLabel = 'Save changes',
  onSave,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  saveLabel?: string;
  onSave: () => Promise<SaveResult>;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    start(async () => {
      const result = await onSave();
      if (result.status === 'success' || result.status === 'idle') {
        setSavedAt(Date.now());
        setTimeout(() => setSavedAt((v) => (v && Date.now() - v >= 1500 ? null : v)), 1700);
      } else {
        setError(result.message ?? 'Could not save. Try again?');
      }
    });
  }

  return (
    <Surface padding={20}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--admin-accent)',
            }}
          >
            ◈ {eyebrow}
          </div>
          <h3
            style={{
              margin: '4px 0 0',
              fontFamily: 'var(--font-serif, var(--font-sans))',
              fontWeight: 400,
              fontSize: 17,
              color: 'var(--ink-strong)',
            }}
          >
            {title}
          </h3>
        </div>
        {savedAt ? (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.06em',
              color: 'var(--admin-accent)',
              padding: '4px 10px',
              borderRadius: 999,
              background: 'color-mix(in srgb, var(--admin-accent) 15%, transparent)',
            }}
          >
            ✓ Saved
          </span>
        ) : null}
      </header>
      {description ? (
        <p
          style={{
            margin: '0 0 16px',
            fontSize: 13.5,
            color: 'var(--ink-muted)',
            lineHeight: 1.55,
          }}
        >
          {description}
        </p>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
      {error ? (
        <p
          role="alert"
          style={{
            margin: '14px 0 0',
            color: 'var(--color-maroon, #8b3a3a)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            background:
              'color-mix(in srgb, var(--color-maroon, #8b3a3a) 10%, transparent)',
            border:
              '1px solid color-mix(in srgb, var(--color-maroon, #8b3a3a) 35%, transparent)',
            padding: '8px 10px',
            borderRadius: 8,
          }}
        >
          {error}
        </p>
      ) : null}
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            background: pending
              ? 'color-mix(in srgb, var(--admin-accent) 35%, transparent)'
              : 'var(--admin-accent)',
            color: 'var(--ink-on-gold)',
            border: 'none',
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            fontWeight: 500,
            cursor: pending ? 'default' : 'pointer',
          }}
        >
          {pending ? 'Saving…' : saveLabel}
        </button>
        {footer}
      </div>
    </Surface>
  );
}

export function AppField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        {label}
      </span>
      {children}
      {hint ? (
        <span style={{ fontSize: 11.5, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export const appInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--surface-rule-strong)',
  background: 'var(--surface-bg)',
  color: 'var(--ink-strong)',
  fontFamily: 'var(--font-sans)',
  fontSize: 14,
  outline: 'none',
};

export const appCodeInputStyle: React.CSSProperties = {
  ...appInputStyle,
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
};

export function AppToggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '8px 0',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'relative',
          width: 40,
          height: 22,
          borderRadius: 999,
          flexShrink: 0,
          marginTop: 2,
          background: value
            ? 'var(--admin-accent)'
            : 'color-mix(in srgb, var(--ink-strong) 18%, transparent)',
          transition: 'background 180ms',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: value ? 20 : 2,
            width: 18,
            height: 18,
            borderRadius: 999,
            background: '#fff',
            transition: 'left 180ms',
          }}
        />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 13.5, color: 'var(--ink-strong)' }}>{label}</span>
        {hint ? (
          <span style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>{hint}</span>
        ) : null}
      </span>
    </button>
  );
}
