'use client';

import { useEffect } from 'react';
import { ArchMark } from '@/components/primitives/ArchMark';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function LocaleError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[locale] route error', error);
  }, [error]);

  return (
    <section
      className="bg-[color:var(--surface-bg)] text-[color:var(--ink-strong)]"
      style={{
        minHeight: '80vh',
        padding: '160px clamp(24px, 4vw, 48px) 96px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <div className="mx-auto" style={{ maxWidth: 720 }}>
        <ArchMark size={56} />
        <div
          className="font-mono text-[11px] mt-8"
          style={{
            color: 'var(--color-maroon)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          A SHOP STALL FELL OVER
        </div>
        <h1
          className="m-0 mt-4 text-balance"
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 300,
            fontSize: 'clamp(40px, 5vw, 76px)',
            lineHeight: 0.95,
            letterSpacing: '-0.04em',
          }}
        >
          Something broke on this page.
        </h1>
        <p
          className="mt-4 max-w-[60ch]"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 16,
            color: 'var(--ink-muted)',
            lineHeight: 1.55,
          }}
        >
          The atelier has been notified. Try again, or send us a note about what
          you were doing — we'd like to fix it.
        </p>
        {error.digest && (
          <p
            className="mt-3 font-mono text-[11px]"
            style={{ color: 'var(--ink-faint)', letterSpacing: '0.04em' }}
          >
            ref · {error.digest}
          </p>
        )}
        <div className="mt-10 flex flex-wrap gap-4 items-center">
          <button
            type="button"
            onClick={reset}
            className="font-mono text-[12px] cursor-pointer pb-1"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--ink-strong)',
              borderBottom: '1px solid var(--color-gold)',
              padding: '0 0 4px',
            }}
          >
            Try again
          </button>
        </div>
      </div>
    </section>
  );
}
