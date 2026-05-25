'use client';

import { useState } from 'react';
import { saveTikTokPixelAction } from '@/app/actions/apps';
import type { TikTokPixelSettings as Settings } from '@/lib/apps/tiktok-pixel';

// Mirrored client-side; the server module pulls in node-only deps.
const PIXEL_ID_RE = /^[A-Z0-9]{16,32}$/i;
function isValidPixelId(id: string): boolean {
  return PIXEL_ID_RE.test(id.trim());
}
import {
  AppSettingsCard,
  AppField,
  AppToggle,
  appCodeInputStyle,
} from './AppSettingsCard';

export function TikTokPixelSettingsForm({
  storefrontSlug,
  initial,
}: {
  storefrontSlug: string;
  initial: Settings;
}) {
  const [pixelId, setPixelId] = useState(initial.pixelId);
  const [advancedMatching, setAdvancedMatching] = useState(initial.advancedMatching);
  const [autoViewContent, setAutoViewContent] = useState(initial.autoViewContent);
  const [updateToken, setUpdateToken] = useState(false);
  const [accessToken, setAccessToken] = useState('');

  return (
    <AppSettingsCard
      eyebrow="Customise"
      title="TikTok Pixel"
      description="Souqna fires standard pixel events (Pageview, ViewContent, Lead, CompletePayment) for your TikTok ads. Your Pixel ID is required; the optional access token unlocks server-side mirroring so ad-blockers can’t drop conversions."
      onSave={async () => {
        if (!isValidPixelId(pixelId)) {
          return { status: 'error', message: 'Pixel ID looks wrong. It’s usually 16–32 letters and digits.' };
        }
        return saveTikTokPixelAction({
          storefrontSlug,
          pixelId: pixelId.trim(),
          advancedMatching,
          autoViewContent,
          ...(updateToken ? { accessToken: accessToken.trim() } : {}),
        });
      }}
    >
      <AppField
        label="Pixel ID"
        hint="Find this in TikTok Ads Manager → Assets → Events → Web Events. Looks like CK1A2B3C4D5E6F7G8H."
      >
        <input
          type="text"
          value={pixelId}
          onChange={(e) => setPixelId(e.target.value.trim())}
          placeholder="CK1A2B3C4D5E6F7G8H"
          style={appCodeInputStyle}
          autoComplete="off"
        />
      </AppField>
      <AppToggle
        label="Auto-fire ViewContent on every page"
        hint="Recommended. Counts each visit toward your TikTok audience signals."
        value={autoViewContent}
        onChange={setAutoViewContent}
      />
      <AppToggle
        label="Advanced matching"
        hint="Hashes any visitor email/phone in the browser before sending — improves attribution without leaking PII."
        value={advancedMatching}
        onChange={setAdvancedMatching}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink-muted)' }}>
        <input
          type="checkbox"
          checked={updateToken}
          onChange={(e) => setUpdateToken(e.target.checked)}
        />
        Update Events API access token (optional, encrypted at rest)
      </label>
      {updateToken ? (
        <AppField
          label="Access token"
          hint="Generated in TikTok Ads Manager → Events Manager → Settings. Leave blank to clear."
        >
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Paste the long token"
            style={appCodeInputStyle}
            autoComplete="new-password"
          />
        </AppField>
      ) : null}
    </AppSettingsCard>
  );
}
