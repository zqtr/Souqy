'use client';

import { useState, useTransition } from 'react';
import {
  saveGoogleSheetsAction,
  googleSheetsExportAction,
} from '@/app/actions/apps';
import type {
  SheetsSettings as Settings,
  SheetsEntity,
} from '@/lib/apps/google-sheets';

// Inlined here so this client component doesn't pull in the full
// google-sheets server module (which uses node:crypto for service
// account JWT signing). Mirrors the server helper byte-for-byte.
function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/\/d\/([a-zA-Z0-9-_]{20,})/);
  if (m && m[1]) return m[1];
  return trimmed.slice(0, 80);
}
import {
  AppSettingsCard,
  AppField,
  AppToggle,
  appCodeInputStyle,
  appInputStyle,
} from './AppSettingsCard';

const TABS: Array<{ kind: SheetsEntity; label: string; hint: string }> = [
  { kind: 'inquiries', label: 'Inquiries tab', hint: 'New inquiries appended in real time.' },
  { kind: 'orders', label: 'Orders tab', hint: 'Non-draft orders appended in real time.' },
  { kind: 'products', label: 'Products tab', hint: 'Off by default — flip if you keep your master catalogue in Sheets.' },
];

export function GoogleSheetsSettingsForm({
  storefrontSlug,
  initial,
}: {
  storefrontSlug: string;
  initial: Settings;
}) {
  const [spreadsheetId, setSpreadsheetId] = useState(initial.spreadsheetId);
  const [appendOnEvent, setAppendOnEvent] = useState(initial.appendOnEvent);
  const [tabs, setTabs] = useState<Settings['tabs']>(initial.tabs);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ kind: SheetsEntity; ok: boolean; message: string } | null>(null);

  function setTab(kind: SheetsEntity, patch: Partial<NonNullable<Settings['tabs'][SheetsEntity]>>) {
    setTabs((prev) => ({
      ...prev,
      [kind]: {
        tabName: prev[kind]?.tabName ?? '',
        enabled: prev[kind]?.enabled ?? false,
        ...patch,
      },
    }));
  }

  function exportNow(kind: SheetsEntity) {
    setResult(null);
    start(async () => {
      const res = await googleSheetsExportAction({ storefrontSlug, entity: kind });
      setResult({
        kind,
        ok: res.status === 'success',
        message:
          res.status === 'success'
            ? 'Exported. Check the spreadsheet.'
            : res.status === 'error'
              ? res.message
              : 'Export failed',
      });
    });
  }

  return (
    <AppSettingsCard
      eyebrow="Customise"
      title="Google Sheets export"
      description="Souqna writes rows directly into a Google Sheet you own. Create a service account in Google Cloud, share the sheet with that account’s email, and paste the JSON key on install. Souqna only writes to the sheet you specify here."
      onSave={async () =>
        saveGoogleSheetsAction({
          storefrontSlug,
          spreadsheetId: extractSpreadsheetId(spreadsheetId),
          appendOnEvent,
          tabs,
        })
      }
    >
      <AppField
        label="Spreadsheet"
        hint="Paste the full Google Sheets URL or just the long id from it."
      >
        <input
          type="text"
          value={spreadsheetId}
          onChange={(e) => setSpreadsheetId(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/…"
          style={appCodeInputStyle}
          autoComplete="off"
        />
      </AppField>
      <AppToggle
        label="Append rows in real-time"
        hint="When off, only the manual Export buttons below write to the sheet."
        value={appendOnEvent}
        onChange={setAppendOnEvent}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {TABS.map((row) => {
          const t = tabs[row.kind] ?? { tabName: '', enabled: false };
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--ink-strong)', fontWeight: 500 }}>
                  {row.label}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>{row.hint}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={t.tabName}
                  onChange={(e) => setTab(row.kind, { tabName: e.target.value })}
                  placeholder="Tab name (e.g. Inquiries)"
                  style={{ ...appInputStyle, maxWidth: 220 }}
                />
                <AppToggle
                  label={t.enabled ? 'On' : 'Off'}
                  value={t.enabled}
                  onChange={(v) => setTab(row.kind, { enabled: v })}
                />
                <button
                  type="button"
                  onClick={() => exportNow(row.kind)}
                  disabled={!spreadsheetId || pending}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    background: 'transparent',
                    border: '1px solid var(--surface-rule-strong)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    color: 'var(--ink-strong)',
                    cursor: !spreadsheetId || pending ? 'default' : 'pointer',
                    opacity: spreadsheetId ? 1 : 0.5,
                  }}
                >
                  {pending ? 'Exporting…' : 'Export now'}
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
      </div>
    </AppSettingsCard>
  );
}
