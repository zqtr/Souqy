'use client';

import { useState } from 'react';
import { saveCrispAction } from '@/app/actions/apps';
import type { CrispSettings as Settings } from '@/lib/apps/crisp';

const WEBSITE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidWebsiteId(id: string): boolean {
  return WEBSITE_ID_RE.test(id.trim());
}
import {
  AppSettingsCard,
  AppField,
  AppToggle,
  appCodeInputStyle,
} from './AppSettingsCard';

export function CrispSettingsForm({
  storefrontSlug,
  initial,
}: {
  storefrontSlug: string;
  initial: Settings;
}) {
  const [websiteId, setWebsiteId] = useState(initial.websiteId);
  const [hideOnInquireOpen, setHideOnInquireOpen] = useState(initial.hideOnInquireOpen);
  const [locale, setLocale] = useState<Settings['locale']>(initial.locale);

  return (
    <AppSettingsCard
      eyebrow="Customise"
      title="Crisp live chat"
      description="Souqna drops the Crisp messenger on every storefront page. Conversations live entirely in your Crisp inbox — Souqna can’t read them."
      onSave={async () => {
        if (!isValidWebsiteId(websiteId)) {
          return {
            status: 'error',
            message: 'That doesn’t look like a Crisp Website ID. Find it in Crisp → Settings → Setup instructions.',
          };
        }
        return saveCrispAction({
          storefrontSlug,
          websiteId: websiteId.trim(),
          hideOnInquireOpen,
          locale,
        });
      }}
    >
      <AppField
        label="Website ID"
        hint="UUID format (e.g. 12345678-aaaa-bbbb-cccc-1234567890ab). Found in Crisp under Settings → Setup."
      >
        <input
          type="text"
          value={websiteId}
          onChange={(e) => setWebsiteId(e.target.value.trim())}
          placeholder="12345678-aaaa-bbbb-cccc-1234567890ab"
          style={appCodeInputStyle}
          autoComplete="off"
        />
      </AppField>
      <AppField label="Locale">
        <div style={{ display: 'flex', gap: 6 }}>
          {(['auto', 'en', 'ar'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setLocale(opt)}
              style={{
                padding: '7px 14px',
                borderRadius: 999,
                background: locale === opt ? 'var(--admin-accent)' : 'transparent',
                border: `1px solid ${locale === opt ? 'var(--admin-accent)' : 'var(--surface-rule-strong)'}`,
                color: locale === opt ? 'var(--ink-on-gold)' : 'var(--ink-strong)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                letterSpacing: '0.06em',
                cursor: 'pointer',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </AppField>
      <AppToggle
        label="Hide chat bubble while the Inquire dialog is open"
        hint="Keeps the storefront focused when a visitor is mid-form."
        value={hideOnInquireOpen}
        onChange={setHideOnInquireOpen}
      />
    </AppSettingsCard>
  );
}
