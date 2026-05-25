'use client';

import { useEffect } from 'react';
import { fontVariables } from '@/lib/fonts';

/**
 * Outer account-tree error boundary. Catches anything the chrome
 * layout itself throws (DB, Clerk, theme cookie, etc) — those errors
 * bypass the inner `(chrome)/error.tsx` because that boundary is
 * mounted INSIDE the layout that's failing.
 *
 * This boundary renders its own minimal document chrome so the founder
 * always sees a recognisable Souqna page rather than the bare Next.js
 * digest screen.
 */
export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin/account] tree error', error);
  }, [error]);

  return (
    <html lang="en" className={fontVariables}>
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          background: '#f1ead7',
          color: '#1a1814',
          fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 560, width: '100%' }}>
          <div
            style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#8b6f1c',
              marginBottom: 10,
            }}
          >
            ◈ Souqna · admin
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily:
                'var(--font-serif), ui-serif, Georgia, serif',
              fontWeight: 400,
              fontSize: 30,
              lineHeight: 1.15,
            }}
          >
            We couldn&rsquo;t load your dashboard.
          </h1>
          <p
            style={{
              margin: '12px 0 18px',
              fontSize: 14.5,
              lineHeight: 1.6,
              color: '#56524a',
            }}
          >
            The page hit an unexpected error before it could render.
            Try reloading — if it keeps happening, sign out and back
            in, or share the digest below with support.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '10px 18px',
                borderRadius: 8,
                background: '#1a1814',
                color: '#f1ead7',
                fontSize: 13.5,
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '10px 18px',
                borderRadius: 8,
                background: 'transparent',
                border: '1px solid rgba(26,24,20,0.18)',
                color: '#1a1814',
                fontSize: 13.5,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Souqna home
            </a>
            <a
              href="/sign-in?redirect_url=/account"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '10px 18px',
                borderRadius: 8,
                background: 'transparent',
                border: '1px solid rgba(26,24,20,0.18)',
                color: '#1a1814',
                fontSize: 13.5,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Sign in again
            </a>
          </div>

          <pre
            style={{
              marginTop: 22,
              padding: 14,
              borderRadius: 10,
              background: 'rgba(26,24,20,0.05)',
              border: '1px solid rgba(26,24,20,0.10)',
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 12,
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              overflowX: 'auto',
            }}
          >
            {`digest:  ${error.digest ?? 'n/a'}
name:    ${error.name}
message: ${error.message || '(none)'}`}
          </pre>
        </div>
      </body>
    </html>
  );
}
