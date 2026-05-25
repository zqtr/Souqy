'use client';

import { useState, useTransition } from 'react';
import { retryStorefrontDomain } from '@/app/actions/notifications';
import { StatusBadge, Surface } from '@/components/admin/primitives';

type Props = {
  slug: string;
  primaryDomain: string;
  backupDomain: string | null;
  status: 'pending' | 'live' | 'failed';
  error: string | null;
};

const buttonPrimary: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 8,
  background: 'var(--ink-strong)',
  color: 'var(--surface-bg)',
  border: 'none',
  fontSize: 13.5,
  fontWeight: 500,
  cursor: 'pointer',
  textDecoration: 'none',
};

const buttonGhost: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--ink-strong)',
  border: '1px solid color-mix(in srgb, var(--ink-strong) 14%, transparent)',
  fontSize: 13.5,
  fontWeight: 500,
  cursor: 'pointer',
  textDecoration: 'none',
};

function statusTone(status: Props['status']): 'success' | 'warning' | 'neutral' {
  if (status === 'live') return 'success';
  if (status === 'failed') return 'warning';
  return 'neutral';
}

function statusLabel(status: Props['status']): string {
  if (status === 'live') return 'live';
  if (status === 'failed') return 'needs attention';
  return 'provisioning';
}

export function PrimaryDomainPanel({
  slug,
  primaryDomain,
  backupDomain,
  status,
  error,
}: Props) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [message, setMessage] = useState<string | null>(error);
  const [pending, start] = useTransition();
  const primaryUrl = `https://${primaryDomain}`;
  const backupUrl = backupDomain ? `https://${backupDomain}` : null;

  function handleRetry() {
    setMessage(null);
    start(async () => {
      const res = await retryStorefrontDomain({ slug });
      if (res.ok) {
        setCurrentStatus('pending');
        setMessage('Primary domain retry started. SSL usually finishes within a few minutes.');
      } else {
        setCurrentStatus('failed');
        setMessage(res.message ?? 'Primary domain retry failed.');
      }
    });
  }

  return (
    <Surface padding={20}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <h3
          style={{
            margin: 0,
            fontFamily: 'var(--font-serif, var(--font-sans))',
            fontWeight: 400,
            fontSize: 18,
            color: 'var(--ink-strong)',
          }}
        >
          {primaryDomain}
        </h3>
        <StatusBadge tone={statusTone(currentStatus)}>{statusLabel(currentStatus)}</StatusBadge>
      </div>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-muted)', lineHeight: 1.55 }}>
        Every storefront ships with a free <code>{`{slug}.souqna.qa`}</code> subdomain.
        SSL is handled automatically by Souqna.
      </p>

      {backupDomain ? (
        <div
          style={{
            marginTop: 14,
            padding: '12px 14px',
            borderRadius: 10,
            background: 'color-mix(in srgb, var(--ink-strong) 4%, var(--surface-bg))',
            border: '1px solid color-mix(in srgb, var(--ink-strong) 8%, transparent)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--admin-accent)',
                  marginBottom: 4,
                }}
              >
                Backup link
              </div>
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  color: 'var(--ink-strong)',
                  wordBreak: 'break-all',
                }}
              >
                {backupDomain}
              </code>
            </div>
            <a href={backupUrl ?? undefined} target="_blank" rel="noreferrer" style={buttonGhost}>
              Open backup link
            </a>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <a href={primaryUrl} target="_blank" rel="noreferrer" style={buttonPrimary}>
          Open primary link
        </a>
        {currentStatus === 'failed' ? (
          <button type="button" style={buttonGhost} onClick={handleRetry} disabled={pending}>
            {pending ? 'Retrying…' : 'Retry primary domain'}
          </button>
        ) : null}
      </div>

      {message ? (
        <p
          style={{
            margin: '12px 0 0',
            fontSize: 13,
            color:
              currentStatus === 'failed'
                ? 'var(--color-maroon, #8b3a3a)'
                : 'var(--ink-muted)',
            lineHeight: 1.55,
          }}
        >
          {message}
        </p>
      ) : null}
    </Surface>
  );
}
