'use client';

import { useEffect } from 'react';

/**
 * Per-segment error boundary for the admin chrome. Catches anything a
 * server component throws inside `/account/*` (data-layer failures,
 * Clerk hiccups, etc) and gives the founder a usable recovery path
 * instead of a bare "Application error" digest screen.
 *
 * Next renders this with the document chrome from the parent layout
 * still mounted, so the sidebar + topbar remain intact while the user
 * decides what to do.
 */
export default function ChromeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaces the full stack to the Vercel runtime log even when the
    // client only sees the opaque digest.
    console.error('[admin/chrome] segment error', error);
  }, [error]);

  return (
    <section
      style={{
        padding: '32px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--admin-accent)',
        }}
      >
        ◈ Something went sideways
      </div>
      <h1
        style={{
          margin: 0,
          fontFamily: 'var(--font-serif, var(--font-sans))',
          fontWeight: 400,
          fontSize: 26,
          color: 'var(--ink-strong)',
        }}
      >
        We hit an error rendering this page.
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.6,
          color: 'var(--ink-muted)',
          maxWidth: 560,
        }}
      >
        The rest of your dashboard is still working. Try reloading the
        page, or jump back to the home tab. If this keeps happening,
        share the diagnostic block below with support.
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '9px 16px',
            borderRadius: 8,
            background: 'var(--ink-strong)',
            color: 'var(--surface-bg)',
            fontSize: 13.5,
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        <a
          href="/account"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '9px 16px',
            borderRadius: 8,
            background: 'transparent',
            border:
              '1px solid color-mix(in srgb, var(--ink-strong) 14%, transparent)',
            color: 'var(--ink-strong)',
            fontSize: 13.5,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Go home
        </a>
      </div>

      <pre
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 10,
          background: 'color-mix(in srgb, var(--ink-strong) 5%, transparent)',
          border:
            '1px solid color-mix(in srgb, var(--ink-strong) 10%, transparent)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: 1.5,
          color: 'var(--ink-strong)',
          whiteSpace: 'pre-wrap',
          overflowX: 'auto',
          maxWidth: 720,
        }}
      >
        {`digest: ${error.digest ?? 'n/a'}
name:   ${error.name}
message: ${error.message || '(none)'}`}
      </pre>
    </section>
  );
}
