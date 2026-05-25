'use client';

import { useState } from 'react';
import { saveIntercomAction } from '@/app/actions/apps';
import type { IntercomSettings as Settings } from '@/lib/apps/intercom';

const APP_ID_RE = /^[a-z0-9]{6,12}$/i;
function isValidAppId(id: string): boolean {
  return APP_ID_RE.test(id.trim());
}
import {
  AppSettingsCard,
  AppField,
  AppToggle,
  appCodeInputStyle,
} from './AppSettingsCard';

export function IntercomSettingsForm({
  storefrontSlug,
  initial,
}: {
  storefrontSlug: string;
  initial: Settings;
}) {
  const [appId, setAppId] = useState(initial.appId);
  const [hideOnInquireOpen, setHideOnInquireOpen] = useState(initial.hideOnInquireOpen);

  return (
    <AppSettingsCard
      eyebrow="Customise"
      title="Intercom messenger"
      description="Souqna drops the Intercom messenger on every storefront page. Visitor conversations route into your Intercom workspace — Souqna doesn’t see them."
      onSave={async () => {
        if (!isValidAppId(appId)) {
          return {
            status: 'error',
            message: 'That doesn’t look like an Intercom App ID. Find it in Intercom → Settings → Installation.',
          };
        }
        return saveIntercomAction({
          storefrontSlug,
          appId: appId.trim(),
          hideOnInquireOpen,
        });
      }}
    >
      <AppField
        label="App ID"
        hint="Short alphanumeric workspace id (e.g. ab12cd34). Look for `app_id` in Intercom’s install snippet."
      >
        <input
          type="text"
          value={appId}
          onChange={(e) => setAppId(e.target.value.trim())}
          placeholder="ab12cd34"
          style={appCodeInputStyle}
          autoComplete="off"
        />
      </AppField>
      <AppToggle
        label="Hide messenger while the Inquire dialog is open"
        value={hideOnInquireOpen}
        onChange={setHideOnInquireOpen}
      />
    </AppSettingsCard>
  );
}
