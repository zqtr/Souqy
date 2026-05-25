'use client';

import { useState, useTransition } from 'react';

/**
 * "Notify me" CTA on a sold-out drop. Submits to the standard
 * `/api/inquire` endpoint with `meta.kind = 'waitlist:<dropId>'` so
 * the founder sees waitlist sign-ups in the existing Inquiries inbox
 * — no new schema, no separate review surface.
 */
export function DropWaitlistButton({
  storefrontSlug,
  dropId,
  label,
}: {
  storefrontSlug: string;
  dropId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    start(async () => {
      try {
        const res = await fetch('/api/inquire', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            storefrontSlug,
            visitorEmail: email.trim(),
            preferredChannel: 'email',
            message: 'Waitlist sign-up',
            meta: { kind: `waitlist:${dropId}` },
            sourceUrl: typeof window !== 'undefined' ? window.location.href : null,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? 'Could not save your email. Try again?');
          return;
        }
        setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');
      }
    });
  }

  if (done) {
    return (
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--sf-accent)',
          padding: '12px 16px',
          border: '1px dashed color-mix(in srgb, var(--sf-accent) 50%, transparent)',
          borderRadius: 12,
          alignSelf: 'flex-start',
        }}
      >
        ✓ You’re on the list. We’ll email when this drop returns.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          alignSelf: 'flex-start',
          padding: '12px 22px',
          borderRadius: 999,
          background: 'var(--sf-ink)',
          color: 'var(--sf-ground)',
          border: 'none',
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      style={{
        display: 'flex',
        gap: 8,
        alignSelf: 'flex-start',
        flexWrap: 'wrap',
      }}
    >
      <input
        type="email"
        required
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        style={{
          padding: '12px 14px',
          borderRadius: 999,
          background: 'color-mix(in srgb, var(--sf-ink) 5%, transparent)',
          border: '1px solid color-mix(in srgb, var(--sf-ink) 18%, transparent)',
          color: 'var(--sf-ink)',
          fontSize: 14,
          minWidth: 240,
        }}
      />
      <button
        type="submit"
        disabled={pending}
        style={{
          padding: '12px 22px',
          borderRadius: 999,
          background: 'var(--sf-accent)',
          color: 'var(--sf-ground)',
          border: 'none',
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
          fontWeight: 500,
          cursor: pending ? 'progress' : 'pointer',
        }}
      >
        {pending ? '…' : 'Notify me'}
      </button>
      {error ? (
        <span style={{ fontSize: 12, color: 'var(--sf-accent)', flexBasis: '100%' }}>
          {error}
        </span>
      ) : null}
    </form>
  );
}
