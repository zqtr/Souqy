'use client';

import { useEffect, useState, useTransition } from 'react';
import { StatusBadge } from '@/components/admin/primitives';
import {
  connectCloudflare,
  setupCloudflareDomain,
  disconnectCloudflare,
  type CloudflareActionResult,
} from '@/app/actions/cloudflare';
import type { CloudflareZone } from '@/lib/apps/cloudflare';

/**
 * Three-state Cloudflare helper rendered next to the manual DNS table:
 *
 *   1. Not connected → token paste field with a deep-link to Cloudflare's
 *      "Create Token" page using the `Edit zone DNS` template. Submitting
 *      verifies the token via the server action and flips into state 2.
 *   2. Connected, no zone selected → zone picker (populated by the
 *      server action's response). Founders with one zone see it
 *      pre-selected.
 *   3. Connected + zone chosen → "Set up automatically" button. On
 *      success it invokes `onCompleted(domain, verified)` so the parent
 *      panel can update the verified badge / clear the manual DNS table
 *      without waiting for a page reload.
 *
 * Network calls always go through the server action — never directly to
 * Cloudflare — so plan gating, owner check, and the encrypted token
 * read all happen server-side.
 */

type Props = {
  slug: string;
  host: string | null;
  initialConnected: boolean;
  initialZones: CloudflareZone[];
  onCompleted: (host: string, verified: boolean) => void;
};

const TOKEN_TEMPLATE_URL =
  'https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22dns%22%2C%22type%22%3A%22edit%22%7D%5D&name=Souqna+DNS';

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
  padding: '8px 12px',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--ink-muted)',
  border: '1px solid color-mix(in srgb, var(--ink-strong) 12%, transparent)',
  fontSize: 12.5,
  cursor: 'pointer',
};

export function CloudflareConnect({
  slug,
  host,
  initialConnected,
  initialZones,
  onCompleted,
}: Props) {
  const [connected, setConnected] = useState(initialConnected);
  const [zones, setZones] = useState<CloudflareZone[]>(initialZones);
  const [zoneId, setZoneId] = useState<string>(initialZones[0]?.id ?? '');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setConnected(initialConnected);
    setZones(initialZones);
    setZoneId((prev) => (initialZones.some((z) => z.id === prev) ? prev : initialZones[0]?.id ?? ''));
  }, [initialConnected, initialZones]);

  function applyResult(res: CloudflareActionResult): boolean {
    if (res.status === 'error') {
      setError(res.message);
      setInfo(null);
      return false;
    }
    setError(null);
    return true;
  }

  function handleConnect(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    start(async () => {
      const res = await connectCloudflare({ slug, token: token.trim() });
      if (!applyResult(res)) return;
      setConnected(true);
      setToken('');
      const z = res.status === 'success' ? res.zones ?? [] : [];
      setZones(z);
      setZoneId(z[0]?.id ?? '');
      setInfo(
        z.length === 0
          ? 'Connected — but this token can’t see any zones. Re-create it scoped to the right zone.'
          : 'Cloudflare connected. Pick a zone and click Set up automatically.',
      );
    });
  }

  function handleSetup() {
    if (!host) {
      setError('Attach a domain first, then run the auto-setup.');
      return;
    }
    if (!zoneId) {
      setError('Pick the Cloudflare zone that owns this domain.');
      return;
    }
    setError(null);
    setInfo(null);
    start(async () => {
      const res = await setupCloudflareDomain({ slug, zoneId, host });
      if (!applyResult(res) || res.status !== 'success' || !res.domain) return;
      setInfo(
        res.verified
          ? 'DNS written and the domain is verified — your storefront is live on this hostname.'
          : 'DNS written. SSL is provisioning — usually live within a couple of minutes.',
      );
      onCompleted(res.domain, Boolean(res.verified));
    });
  }

  function handleDisconnect() {
    if (!confirm('Disconnect Cloudflare? Any attached domains keep working — you’ll just lose auto-setup.')) {
      return;
    }
    setError(null);
    setInfo(null);
    start(async () => {
      const res = await disconnectCloudflare({ slug });
      if (!applyResult(res)) return;
      setConnected(false);
      setZones([]);
      setZoneId('');
      setInfo('Cloudflare disconnected.');
    });
  }

  return (
    <div
      style={{
        marginTop: 14,
        padding: 14,
        borderRadius: 10,
        border: '1px solid color-mix(in srgb, var(--admin-accent) 28%, transparent)',
        background: 'color-mix(in srgb, var(--admin-accent) 5%, var(--surface-bg))',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--admin-accent)',
          }}
        >
          ◈ Set up automatically
        </div>
        {connected ? <StatusBadge tone="success">Cloudflare connected</StatusBadge> : null}
      </header>

      {!connected ? (
        <>
          <p
            style={{
              margin: '0 0 10px',
              fontSize: 13,
              color: 'var(--ink-muted)',
              lineHeight: 1.55,
            }}
          >
            Skip the manual DNS step. Connect Cloudflare and Souqna writes the
            record for you, then verifies SSL automatically.{' '}
            <a
              href={TOKEN_TEMPLATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--admin-accent)', textDecoration: 'underline' }}
            >
              Create a scoped token →
            </a>
          </p>
          <form
            onSubmit={handleConnect}
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
          >
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="Paste your Cloudflare API token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              style={inputStyle}
              disabled={pending}
            />
            <button
              type="submit"
              style={buttonPrimary}
              disabled={pending || token.trim().length < 20}
            >
              {pending ? 'Verifying…' : 'Connect Cloudflare'}
            </button>
          </form>
        </>
      ) : (
        <>
          <p
            style={{
              margin: '0 0 10px',
              fontSize: 13,
              color: 'var(--ink-muted)',
              lineHeight: 1.55,
            }}
          >
            Pick the Cloudflare zone that owns <code>{host ?? 'your domain'}</code>{' '}
            and we’ll publish the right DNS record.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'stretch',
            }}
          >
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              disabled={pending || zones.length === 0}
              style={{ ...inputStyle, padding: '10px 10px' }}
            >
              {zones.length === 0 ? (
                <option value="">No zones visible to this token</option>
              ) : (
                zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              style={buttonPrimary}
              onClick={handleSetup}
              disabled={pending || !host || !zoneId}
            >
              {pending ? 'Setting up…' : 'Set up automatically'}
            </button>
          </div>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              style={buttonGhost}
              onClick={handleDisconnect}
              disabled={pending}
            >
              Disconnect Cloudflare
            </button>
          </div>
        </>
      )}

      {error ? (
        <p
          style={{
            margin: '10px 0 0',
            fontSize: 12.5,
            color: 'var(--color-maroon, #8b3a3a)',
          }}
        >
          {error}
        </p>
      ) : null}
      {info && !error ? (
        <p
          style={{
            margin: '10px 0 0',
            fontSize: 12.5,
            color: 'var(--ink-muted)',
          }}
        >
          {info}
        </p>
      ) : null}
    </div>
  );
}
