'use client';

import { useFormStatus } from 'react-dom';
import { useState, useTransition } from 'react';
import { useLocale } from 'next-intl';
import {
  saveStorefrontSettings,
  type SettingsActionState,
} from '@/app/actions/storefrontSettings';
import { adminPhrase } from './adminLocale';

type Section =
  | 'general'
  | 'brand'
  | 'contact'
  | 'languages'
  | 'policies'
  | 'notifications'
  | 'customer-accounts';

/**
 * Lightweight wrapper used by every settings panel. Holds the slug +
 * section, a "dirty" flag (computed from form interaction), and a
 * footer with Cancel + Save Changes buttons. Children are a controlled
 * field tree — they emit values via standard React state and we
 * collect them on submit.
 *
 * The save action runs via React 18 transitions so the button keeps
 * showing "Saving…" without blocking the rest of the page.
 */
export function SettingsForm({
  slug,
  section,
  patch,
  children,
  description,
  saveLabel = 'Save changes',
}: {
  slug: string;
  section: Section;
  /**
   * The current value tree for this section. Children render inputs
   * bound to this object via local React state; on submit we send the
   * full object as the patch.
   */
  patch: Record<string, unknown>;
  description?: string;
  saveLabel?: string;
  children: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<SettingsActionState>({ status: 'idle' });
  const locale = useLocale();
  const t = (text: string) => adminPhrase(locale, text);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setState({ status: 'idle' });
        startTransition(async () => {
          const result = await saveStorefrontSettings({
            slug,
            section,
            patch,
          });
          setState(result);
        });
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {description ? (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: 'var(--ink-muted)',
            lineHeight: 1.55,
            maxWidth: 720,
          }}
        >
          {t(description)}
        </p>
      ) : null}
      {children}
      <SaveBar pending={pending} state={state} label={t(saveLabel)} />
    </form>
  );
}

function SaveBar({
  pending,
  state,
  label,
}: {
  pending: boolean;
  state: SettingsActionState;
  label: string;
}) {
  const { pending: formPending } = useFormStatus();
  const isPending = pending || formPending;
  const locale = useLocale();
  const t = (text: string) => adminPhrase(locale, text);
  return (
    <footer
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 8,
      }}
    >
      {state.status === 'error' ? (
        <span
          role="alert"
          style={{
            fontSize: 12.5,
            color: 'var(--color-maroon, #8b3a3a)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {state.message}
        </span>
      ) : state.status === 'success' ? (
        <span
          role="status"
          style={{
            fontSize: 12.5,
            color: 'var(--admin-accent)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {t('Saved')} {new Date(state.updatedAt).toLocaleTimeString(locale === 'ar' ? 'ar-QA' : 'en-GB')}
        </span>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        style={{
          padding: '9px 18px',
          borderRadius: 8,
          background: isPending
            ? 'color-mix(in srgb, var(--ink-strong) 50%, transparent)'
            : 'var(--ink-strong)',
          color: 'var(--surface-bg)',
          border: 'none',
          fontSize: 13.5,
          fontWeight: 500,
          cursor: isPending ? 'progress' : 'pointer',
        }}
      >
        {isPending ? t('Saving…') : label}
      </button>
    </footer>
  );
}

/**
 * Reusable field row that pairs a label, optional helper text, and an
 * input slot. Used heavily in every settings screen.
 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const locale = useLocale();
  const t = (text: string) => adminPhrase(locale, text);
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontSize: 13.5,
        color: 'var(--ink-strong)',
      }}
    >
      <span style={{ fontWeight: 500 }}>{t(label)}</span>
      {children}
      {hint ? (
        <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{t(hint)}</span>
      ) : null}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid color-mix(in srgb, var(--ink-strong) 14%, transparent)',
  background: 'var(--surface-bg)',
  color: 'var(--ink-strong)',
  fontFamily: 'var(--font-sans)',
  fontSize: 13.5,
  outline: 'none',
  width: '100%',
};

export const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 96,
  resize: 'vertical',
  fontFamily: 'var(--font-sans)',
};
