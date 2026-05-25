'use client';
import { useEffect, useState } from 'react';
import { getSupplierForBrowse } from '@/app/actions/souqnasource';
import type { Supplier } from '@/lib/apps/souqnasource/types';

export function SupplierDrawer({
  supplierId,
  slug,
  onClose,
}: {
  supplierId: string;
  slug: string;
  locale: 'en' | 'ar';
  onClose: () => void;
}) {
  const [s, setS] = useState<Supplier | null>(null);
  useEffect(() => {
    getSupplierForBrowse({ slug, supplierId }).then(setS);
  }, [slug, supplierId]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'color-mix(in srgb, var(--ink-strong) 35%, transparent)',
          zIndex: 40,
        }}
      />
      <aside
        role="dialog"
        aria-label="Supplier"
        style={{
          position: 'fixed',
          insetInlineEnd: 0,
          top: 0,
          height: '100%',
          width: 'min(360px, 90vw)',
          background: 'var(--surface-elevated, var(--surface-bg))',
          borderInlineStart: '1px solid var(--surface-rule)',
          padding: 24,
          overflowY: 'auto',
          zIndex: 41,
          boxShadow:
            '-24px 0 60px -20px color-mix(in srgb, var(--ink-strong) 30%, transparent)',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'transparent',
              color: 'var(--ink-muted)',
              border: '1px solid var(--surface-rule)',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </header>

        {s ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--font-serif, var(--font-sans))',
                fontWeight: 400,
                fontSize: 22,
                color: 'var(--ink-strong)',
                letterSpacing: '-0.01em',
              }}
            >
              {s.displayName}
            </h2>

            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.04em',
                color: 'var(--ink-muted)',
              }}
            >
              {s.area && <Chip>{s.area}</Chip>}
              <Chip>
                trust&nbsp;
                {s.trustScore ?? '—'}
              </Chip>
            </div>

            {s.trustReason ? (
              <p
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  color: 'var(--ink-strong)',
                }}
              >
                {s.trustReason}
              </p>
            ) : null}

            {s.whatsapp && (
              <KeyValue label="WhatsApp" value={s.whatsapp} mono />
            )}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)' }}>
            Loading…
          </p>
        )}
      </aside>
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 999,
        background: 'color-mix(in srgb, var(--ink-strong) 8%, transparent)',
        color: 'var(--ink-strong)',
        textTransform: 'lowercase',
      }}
    >
      {children}
    </span>
  );
}

function KeyValue({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: mono ? 'var(--font-mono)' : 'inherit',
          fontSize: 13,
          color: 'var(--ink-strong)',
        }}
      >
        {value}
      </div>
    </div>
  );
}
