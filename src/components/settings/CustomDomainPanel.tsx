'use client';

import { useState, useTransition } from 'react';
import { StatusBadge, Surface } from '@/components/admin/primitives';
import {
  attachCustomDomain,
  detachCustomDomain,
  verifyCustomDomain,
  type CustomDomainResult,
} from '@/app/actions/customDomain';
import type { CustomDomainDnsRecord } from '@/lib/vercelDomains';
import type { CloudflareZone } from '@/lib/apps/cloudflare';
import { CloudflareConnect } from './CloudflareConnect';

/**
 * Founder-facing custom-domain control. Three operations:
 *
 *   - Attach: empty state shows a hostname input + recommended DNS once
 *     submitted. We surface the records inline so the founder can
 *     configure their registrar without leaving the page.
 *   - Verify: re-polls Vercel. The action revalidates the page on
 *     success; we also keep a transient client snapshot so the badge
 *     flips immediately without waiting for the round-trip.
 *   - Detach: confirms first (a verified domain serves live traffic).
 *
 * The component never speaks to Vercel directly — every network call
 * goes through the corresponding server action so plan gating, owner
 * checks, and audit writes happen exactly once and in one place.
 */

type Props = {
  slug: string;
  initialDomain: string | null;
  initialVerified: boolean;
  initialDns: CustomDomainDnsRecord[];
  canManage: boolean;
  cloudflareConnected: boolean;
  cloudflareZones: CloudflareZone[];
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid color-mix(in srgb, var(--ink-strong) 14%, transparent)',
  background: 'var(--surface-bg)',
  color: 'var(--ink-strong)',
  fontSize: 14,
  fontFamily: 'inherit',
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
};

const buttonDanger: React.CSSProperties = {
  ...buttonGhost,
  color: 'var(--color-maroon, #8b3a3a)',
  borderColor: 'color-mix(in srgb, var(--color-maroon, #8b3a3a) 30%, transparent)',
};

export function CustomDomainPanel({
  slug,
  initialDomain,
  initialVerified,
  initialDns,
  canManage,
  cloudflareConnected,
  cloudflareZones,
}: Props) {
  const [domain, setDomain] = useState<string | null>(initialDomain);
  const [verified, setVerified] = useState<boolean>(initialVerified);
  const [dns, setDns] = useState<CustomDomainDnsRecord[]>(initialDns);
  const [draft, setDraft] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function applyResult(res: CustomDomainResult) {
    if (res.status === 'error') {
      setError(res.message);
      setInfo(null);
      return;
    }
    setError(null);
    setDomain(res.domain);
    setVerified(res.verified);
    if (res.vercel) {
      setDns(res.vercel.recommendedDns);
      if (res.verified) {
        setInfo('Domain verified — your storefront is live on this hostname.');
      } else if (res.vercel.misconfigured) {
        setInfo('DNS not detected yet. Publish the records below, then click Verify.');
      } else {
        setInfo('Domain attached. DNS propagation can take up to 5 minutes.');
      }
    } else if (!res.domain) {
      setInfo('Custom domain removed.');
      setDns([]);
    }
  }

  function handleAttach(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;
    setError(null);
    setInfo(null);
    start(async () => {
      const res = await attachCustomDomain({ slug, domain: draft });
      applyResult(res);
      if (res.status === 'success') setDraft('');
    });
  }

  function handleVerify() {
    if (!canManage) return;
    setError(null);
    setInfo(null);
    start(async () => {
      const res = await verifyCustomDomain({ slug });
      applyResult(res);
    });
  }

  function handleDetach() {
    if (!canManage) return;
    if (!confirm('Remove this custom domain? Your storefront will keep working on the souqna.qa subdomain.')) {
      return;
    }
    setError(null);
    setInfo(null);
    start(async () => {
      const res = await detachCustomDomain({ slug });
      applyResult(res);
    });
  }

  return (
    <Surface padding={20} style={{ marginTop: 16 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: 'var(--font-serif, var(--font-sans))',
            fontWeight: 400,
            fontSize: 17,
            color: 'var(--ink-strong)',
          }}
        >
          Custom domain
        </h3>
        {!canManage ? (
          <StatusBadge tone="neutral">Pro</StatusBadge>
        ) : domain ? (
          verified ? (
            <StatusBadge tone="success">verified</StatusBadge>
          ) : (
            <StatusBadge tone="warning">pending DNS</StatusBadge>
          )
        ) : (
          <StatusBadge tone="neutral">not connected</StatusBadge>
        )}
      </header>

      <p
        style={{
          margin: '0 0 14px',
          fontSize: 13.5,
          color: 'var(--ink-muted)',
          lineHeight: 1.55,
          maxWidth: 640,
        }}
      >
        Connect a domain you already own (e.g. <code>shop.yourbrand.com</code>).
        Souqna provisions SSL automatically via Vercel — usually live within
        five minutes of DNS propagating.
      </p>

      {!canManage ? (
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            border: '1px dashed color-mix(in srgb, var(--ink-strong) 18%, transparent)',
            background: 'color-mix(in srgb, var(--ink-strong) 2%, transparent)',
            fontSize: 13.5,
            color: 'var(--ink-muted)',
            lineHeight: 1.55,
          }}
        >
          Custom domains unlock on the Pro plan and above.{' '}
          <a
            href="/account/settings/plan"
            style={{ color: 'var(--admin-accent)', textDecoration: 'underline' }}
          >
            Upgrade to Pro →
          </a>
        </div>
      ) : !domain ? (
        <form
          onSubmit={handleAttach}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'stretch' }}
        >
          <input
            type="text"
            inputMode="url"
            placeholder="shop.yourbrand.com"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={inputStyle}
            disabled={pending}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" style={buttonPrimary} disabled={pending || draft.length < 3}>
            {pending ? 'Connecting…' : 'Connect'}
          </button>
        </form>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'color-mix(in srgb, var(--ink-strong) 4%, var(--surface-bg))',
              border: '1px solid color-mix(in srgb, var(--ink-strong) 8%, transparent)',
            }}
          >
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                color: 'var(--ink-strong)',
              }}
            >
              {domain}
            </code>
            <span style={{ flex: 1 }} />
            {!verified ? (
              <button type="button" style={buttonGhost} onClick={handleVerify} disabled={pending}>
                {pending ? 'Checking…' : 'Verify'}
              </button>
            ) : null}
            <button type="button" style={buttonDanger} onClick={handleDetach} disabled={pending}>
              Remove
            </button>
          </div>

          {!verified ? (
            <CloudflareConnect
              slug={slug}
              host={domain}
              initialConnected={cloudflareConnected}
              initialZones={cloudflareZones}
              onCompleted={(d, v) => {
                setDomain(d);
                setVerified(v);
                if (v) {
                  setInfo('Domain verified — your storefront is live on this hostname.');
                } else {
                  setInfo('DNS written via Cloudflare. SSL is provisioning…');
                }
              }}
            />
          ) : null}

          {!verified && dns.length > 0 ? (
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--admin-accent)',
                  marginBottom: 8,
                }}
              >
                ◈ Or publish DNS manually
              </div>
              <div
                style={{
                  border: '1px solid color-mix(in srgb, var(--ink-strong) 8%, transparent)',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: 'color-mix(in srgb, var(--ink-strong) 4%, transparent)',
                        textAlign: 'left',
                      }}
                    >
                      <th style={{ padding: '8px 12px', fontWeight: 500 }}>Type</th>
                      <th style={{ padding: '8px 12px', fontWeight: 500 }}>Name</th>
                      <th style={{ padding: '8px 12px', fontWeight: 500 }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dns.map((r) => (
                      <tr
                        key={`${r.type}-${r.name}-${r.value}`}
                        style={{
                          borderTop:
                            '1px solid color-mix(in srgb, var(--ink-strong) 6%, transparent)',
                        }}
                      >
                        <td style={{ padding: '8px 12px' }}>{r.type}</td>
                        <td style={{ padding: '8px 12px' }}>{r.name}</td>
                        <td style={{ padding: '8px 12px', wordBreak: 'break-all' }}>{r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p
                style={{
                  margin: '10px 0 0',
                  fontSize: 12.5,
                  color: 'var(--ink-muted)',
                  lineHeight: 1.55,
                }}
              >
                Add the record(s) at your registrar (Cloudflare, GoDaddy, Namecheap, …).
                Once DNS propagates, click <strong>Verify</strong> — SSL provisions
                automatically.
              </p>
            </div>
          ) : null}
        </>
      )}

      {error ? (
        <p
          style={{
            margin: '12px 0 0',
            fontSize: 13,
            color: 'var(--color-maroon, #8b3a3a)',
          }}
        >
          {error}
        </p>
      ) : null}
      {info && !error ? (
        <p
          style={{
            margin: '12px 0 0',
            fontSize: 13,
            color: 'var(--ink-muted)',
          }}
        >
          {info}
        </p>
      ) : null}
    </Surface>
  );
}
