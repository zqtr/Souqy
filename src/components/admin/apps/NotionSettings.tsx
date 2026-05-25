'use client';

import { useState, useTransition } from 'react';
import {
  saveNotionAction,
  notionBackfillAction,
} from '@/app/actions/apps';
import type {
  NotionSettings as Settings,
  NotionEntity,
} from '@/lib/apps/notion';

// Inlined client-side mirror of `normaliseDatabaseId` from
// `@/lib/apps/notion`. Importing the module proper would
// transitively pull `node:crypto` into the client bundle.
const NOTION_ID_RE = /^[0-9a-f]{32}$/i;
function normaliseDatabaseId(input: string): string {
  const trimmed = input.trim();
  const hexOnly = trimmed.replace(/[^0-9a-f]/gi, '');
  if (hexOnly.length >= 32) {
    const tail = hexOnly.slice(hexOnly.length - 32);
    if (NOTION_ID_RE.test(tail)) return tail;
  }
  return trimmed;
}
import {
  AppSettingsCard,
  AppField,
  appCodeInputStyle,
} from './AppSettingsCard';

const ROWS: Array<{ kind: NotionEntity; label: string; hint: string }> = [
  {
    kind: 'inquiries',
    label: 'Inquiries database',
    hint: 'Each new inquiry becomes a Notion page. Suggested columns: Name, Email, Phone, Channel, Message, Status.',
  },
  {
    kind: 'orders',
    label: 'Orders database',
    hint: 'New (non-draft) orders become Notion pages. Suggested columns: Name, Status, Total, Currency, Channel.',
  },
  {
    kind: 'products',
    label: 'Products database',
    hint: 'Newly published products become Notion pages. Suggested columns: Name, Description, Price, Category, Status.',
  },
];

export function NotionSettingsForm({
  storefrontSlug,
  initial,
}: {
  storefrontSlug: string;
  initial: Settings;
}) {
  const [databaseIds, setDatabaseIds] = useState<Settings['databaseIds']>(initial.databaseIds);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ kind: NotionEntity; message: string; ok: boolean } | null>(null);

  function update(kind: NotionEntity, value: string) {
    setDatabaseIds((prev) => {
      const next = { ...prev };
      if (value.trim()) next[kind] = normaliseDatabaseId(value);
      else delete next[kind];
      return next;
    });
  }

  function backfill(kind: NotionEntity) {
    setResult(null);
    start(async () => {
      const res = await notionBackfillAction({ storefrontSlug, entity: kind });
      setResult({
        kind,
        ok: res.status === 'success',
        message:
          res.status === 'success'
            ? `Backfilled — see your Notion DB.`
            : res.status === 'error'
              ? res.message
              : 'Backfill failed',
      });
    });
  }

  return (
    <AppSettingsCard
      eyebrow="Customise"
      title="Notion mirror"
      description="Souqna copies new inquiries, orders, and products into Notion databases you own. Create an internal integration in Notion, share each database with it, then paste the integration token (on install) and the database links here."
      onSave={async () =>
        saveNotionAction({
          storefrontSlug,
          databaseIds,
        })
      }
    >
      {ROWS.map((row) => {
        const id = databaseIds[row.kind] ?? '';
        const r = result?.kind === row.kind ? result : null;
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
                type="text"
                value={id}
                onChange={(e) => update(row.kind, e.target.value)}
                placeholder="Paste the database link or 32-char id"
                style={appCodeInputStyle}
                autoComplete="off"
              />
            </AppField>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => backfill(row.kind)}
                disabled={!id || pending}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: 'transparent',
                  border: '1px solid var(--surface-rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  color: 'var(--ink-strong)',
                  cursor: !id || pending ? 'default' : 'pointer',
                  opacity: !id ? 0.5 : 1,
                }}
              >
                {pending ? 'Syncing…' : 'Sync existing'}
              </button>
              {r ? (
                <span
                  style={{
                    fontSize: 11.5,
                    fontFamily: 'var(--font-mono)',
                    color: r.ok ? 'var(--admin-accent)' : 'var(--color-maroon, #8b3a3a)',
                  }}
                >
                  {r.ok ? '✓ ' : '✕ '}
                  {r.message}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </AppSettingsCard>
  );
}
