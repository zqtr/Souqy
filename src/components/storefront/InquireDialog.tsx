'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Storefront-facing inquiry form. Renders an inline button; clicking
 * opens a modal with name + contact + message fields. Posts to
 * `/api/inquire`, which writes both the customer record and the
 * inquiry log entry server-side.
 *
 * The component is framework-agnostic — it only relies on global CSS
 * tokens that the storefront wrapper already injects, so it works
 * inside every template (Menu, CatalogGrid, Lookbook, etc).
 */
type Props = {
  storefrontSlug: string;
  productId?: string | null;
  productTitle?: string | null;
  /** Override the trigger button label. Defaults to "Inquire". */
  triggerLabel?: string;
  /** When true, render the trigger as a full-width pill button. */
  fullWidth?: boolean;
};

export function InquireDialog({
  storefrontSlug,
  productId = null,
  productTitle = null,
  triggerLabel = 'Inquire',
  fullWidth = false,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: fullWidth ? '12px 18px' : '9px 16px',
          borderRadius: 999,
          background: 'var(--storefront-ink, #1f1b16)',
          color: 'var(--storefront-ground, #f1e9d7)',
          border: 'none',
          fontFamily: 'inherit',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          width: fullWidth ? '100%' : 'auto',
          transition: 'transform 140ms ease, box-shadow 140ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 8px 18px -10px rgba(0,0,0,0.35)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {triggerLabel}
      </button>
      {open ? (
        <InquireModal
          storefrontSlug={storefrontSlug}
          productId={productId}
          productTitle={productTitle}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function InquireModal({
  storefrontSlug,
  productId,
  productTitle,
  onClose,
}: {
  storefrontSlug: string;
  productId: string | null;
  productTitle: string | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState(
    productTitle ? `Hi! I'd like to inquire about ${productTitle}.` : '',
  );
  const [channel, setChannel] = useState<'whatsapp' | 'email' | 'phone' | 'any'>(
    'whatsapp',
  );
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email && !phone) {
      setError('Add an email or phone so we can reach you.');
      return;
    }
    if (message.trim().length < 1) {
      setError('Add a short message.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/inquire', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          storefrontSlug,
          productId,
          productTitle,
          message,
          visitorName: name || null,
          visitorEmail: email || null,
          visitorPhone: phone || null,
          preferredChannel: channel,
          marketingConsent: consent,
          sourceUrl:
            typeof window !== 'undefined' ? window.location.href : null,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'We couldn’t deliver your inquiry. Try again.');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Portal to <body>. The floating-CTA wrapper that mounts this dialog
  // uses `transform` for its fade-in animation — and any non-none
  // transform on an ancestor reroutes `position: fixed` so it resolves
  // against THAT ancestor instead of the viewport. Without the portal
  // the modal collapses to the width of the trigger pill (~30px) and
  // every form field wraps to one character per line.
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,17,14,0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--storefront-ground, #f1e9d7)',
          color: 'var(--storefront-ink, #1f1b16)',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 30px 60px -20px rgba(0,0,0,0.4)',
        }}
      >
        {submitted ? (
          <>
            <h2
              id={titleId}
              style={{
                margin: 0,
                fontFamily: 'inherit',
                fontWeight: 400,
                fontSize: 22,
              }}
            >
              Thank you.
            </h2>
            <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55 }}>
              Your note is in. We&rsquo;ll reply on{' '}
              <strong>{channelLabel(channel)}</strong> shortly.
            </p>
            <button
              type="button"
              onClick={onClose}
              style={primaryButton}
              autoFocus
            >
              Close
            </button>
          </>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <header>
              <h2
                id={titleId}
                style={{
                  margin: 0,
                  fontFamily: 'inherit',
                  fontWeight: 400,
                  fontSize: 22,
                }}
              >
                Inquire
              </h2>
              {productTitle ? (
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: 13,
                    opacity: 0.65,
                  }}
                >
                  About <em>{productTitle}</em>
                </p>
              ) : null}
            </header>

            <Field label="Your name (optional)">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
                placeholder="Aisha Al-Thani"
                autoComplete="name"
              />
            </Field>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={inputStyle}
                  placeholder="+974 5555 1234"
                  autoComplete="tel"
                />
              </Field>
            </div>
            <Field label="Message">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                required
                style={{ ...inputStyle, resize: 'vertical', minHeight: 96 }}
              />
            </Field>
            <Field label="Preferred reply channel">
              <select
                value={channel}
                onChange={(e) =>
                  setChannel(e.target.value as typeof channel)
                }
                style={inputStyle}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="phone">Phone call</option>
                <option value="any">Whatever works</option>
              </select>
            </Field>

            <label
              style={{
                display: 'flex',
                gap: 8,
                fontSize: 12.5,
                opacity: 0.85,
                lineHeight: 1.45,
              }}
            >
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>
                Keep me posted on new products and offers from this store.
                Unsubscribe anytime.
              </span>
            </label>

            {error ? (
              <div
                role="alert"
                style={{
                  fontSize: 12.5,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(139,58,58,0.12)',
                  color: '#7a2828',
                }}
              >
                {error}
              </div>
            ) : null}

            <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={onClose} style={secondaryButton}>
                Cancel
              </button>
              <button type="submit" disabled={submitting} style={primaryButton}>
                {submitting ? 'Sending…' : 'Send inquiry'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
      <span style={{ fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  );
}

function channelLabel(c: 'whatsapp' | 'email' | 'phone' | 'any'): string {
  return c === 'whatsapp'
    ? 'WhatsApp'
    : c === 'email'
      ? 'email'
      : c === 'phone'
        ? 'phone'
        : 'whatever channel works for you';
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid rgba(31,27,22,0.18)',
  background: 'rgba(255,255,255,0.6)',
  color: 'inherit',
  fontFamily: 'inherit',
  fontSize: 13.5,
  outline: 'none',
  width: '100%',
};

const primaryButton: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: 999,
  background: 'var(--storefront-ink, #1f1b16)',
  color: 'var(--storefront-ground, #f1e9d7)',
  border: 'none',
  fontFamily: 'inherit',
  fontSize: 13.5,
  fontWeight: 500,
  cursor: 'pointer',
  marginTop: 12,
};

const secondaryButton: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: 999,
  background: 'transparent',
  color: 'var(--storefront-ink, #1f1b16)',
  border: '1px solid rgba(31,27,22,0.25)',
  fontFamily: 'inherit',
  fontSize: 13.5,
  fontWeight: 500,
  cursor: 'pointer',
};
