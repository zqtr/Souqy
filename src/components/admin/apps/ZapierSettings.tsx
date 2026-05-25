'use client';

import { useState, useTransition } from 'react';
import {
  saveZapierAction,
  testZapierHookAction,
} from '@/app/actions/apps';
import type {
  ZapierSettings as Settings,
  ZapierEventKind,
} from '@/lib/apps/zapier';

// Mirrored client-side: avoid pulling the server-only zapier module
// (which depends on db()) into the client bundle.
function isAcceptedHookUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    return host.endsWith('hooks.zapier.com') || host.endsWith('hook.us1.make.com') || host.endsWith('hook.eu1.make.com') || host.endsWith('hook.eu2.make.com') || host.endsWith('hook.integromat.com');
  } catch {
    return false;
  }
}
import {
  AppSettingsCard,
  AppField,
  appCodeInputStyle,
} from './AppSettingsCard';

const ROWS: Array<{ kind: ZapierEventKind; label: string; hint: string }> = [
  {
    kind: 'inquiry.created',
    label: 'When a customer sends an inquiry',
    hint: 'Fires the moment the inquire form is submitted on any storefront page.',
  },
  {
    kind: 'order.created',
    label: 'When an order is placed',
    hint: 'Fires for storefront orders and admin-logged orders. Drafts are skipped.',
  },
  {
    kind: 'product.created',
    label: 'When a new product is added',
    hint: 'Fires only for active products — drafts won’t broadcast.',
  },
];

export function ZapierSettingsForm({
  storefrontSlug,
  initial,
}: {
  storefrontSlug: string;
  initial: Settings;
}) {
  const [hookUrls, setHookUrls] = useState<Settings['hookUrls']>(initial.hookUrls);
  const [testing, startTest] = useTransition();
  const [testRow, setTestRow] = useState<ZapierEventKind | null>(null);
  const [testResult, setTestResult] = useState<{ kind: ZapierEventKind; ok: boolean; message: string } | null>(null);

  function update(kind: ZapierEventKind, value: string) {
    setHookUrls((prev) => {
      const next = { ...prev };
      if (value.trim()) next[kind] = value.trim();
      else delete next[kind];
      return next;
    });
  }

  function sendTest(kind: ZapierEventKind) {
    const url = hookUrls[kind];
    if (!url) return;
    setTestRow(kind);
    setTestResult(null);
    startTest(async () => {
      const res = await testZapierHookAction({ storefrontSlug, url });
      setTestResult({
        kind,
        ok: res.status === 'success',
        message:
          res.status === 'success'
            ? 'Sent. Check your Zap history.'
            : res.status === 'error'
              ? res.message
              : 'Failed',
      });
    });
  }

  return (
    <AppSettingsCard
      eyebrow="Customise"
      title="Zapier hooks"
      description="Paste a Catch Hook URL from Zapier (or Make.com) for each event you care about. Souqna POSTs the event payload as JSON the moment it happens — retried up to three times on failure."
      onSave={async () => {
        for (const v of Object.values(hookUrls)) {
          if (v && !isAcceptedHookUrl(v)) {
            return {
              status: 'error',
              message: `That doesn’t look like a Zapier or Make.com hook URL: ${v.slice(0, 60)}…`,
            };
          }
        }
        return saveZapierAction({ storefrontSlug, hookUrls });
      }}
    >
      {ROWS.map((row) => {
        const url = hookUrls[row.kind] ?? '';
        const isTesting = testing && testRow === row.kind;
        const result = testResult?.kind === row.kind ? testResult : null;
        return (
          <div
            key={row.kind}
            style={{
              padding: 14,
              borderRadius: 12,
              background: 'color-mix(in srgb, var(--ink-strong) 3%, transparent)',
              border: '1px solid var(--surface-rule)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <AppField label={row.label} hint={row.hint}>
              <input
                type="url"
                value={url}
                onChange={(e) => update(row.kind, e.target.value)}
                placeholder="https://hooks.zapier.com/hooks/catch/…"
                style={appCodeInputStyle}
                autoComplete="off"
              />
            </AppField>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => sendTest(row.kind)}
                disabled={!url || isTesting}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: 'transparent',
                  border: '1px solid var(--surface-rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  color: 'var(--ink-strong)',
                  cursor: !url || isTesting ? 'default' : 'pointer',
                  opacity: !url ? 0.5 : 1,
                }}
              >
                {isTesting ? 'Sending…' : 'Send test event'}
              </button>
              {result ? (
                <span
                  style={{
                    fontSize: 11.5,
                    fontFamily: 'var(--font-mono)',
                    color: result.ok ? 'var(--admin-accent)' : 'var(--color-maroon, #8b3a3a)',
                  }}
                >
                  {result.ok ? '✓ ' : '✕ '}
                  {result.message}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </AppSettingsCard>
  );
}
