'use client';

import { useState } from 'react';
import { saveHubspotAction } from '@/app/actions/apps';
import type { HubspotSettings as Settings } from '@/lib/apps/hubspot';

const HUB_ID_RE = /^\d{4,10}$/;
const FORM_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidHubId(id: string): boolean {
  return HUB_ID_RE.test(id.trim());
}
function isValidFormId(id: string): boolean {
  return FORM_ID_RE.test(id.trim());
}
import {
  AppSettingsCard,
  AppField,
  AppToggle,
  appCodeInputStyle,
} from './AppSettingsCard';

export function HubspotSettingsForm({
  storefrontSlug,
  initial,
}: {
  storefrontSlug: string;
  initial: Settings;
}) {
  const [hubId, setHubId] = useState(initial.hubId);
  const [formId, setFormId] = useState(initial.formId);
  const [hideOnInquireOpen, setHideOnInquireOpen] = useState(initial.hideOnInquireOpen);

  return (
    <AppSettingsCard
      eyebrow="Customise"
      title="HubSpot tracking + chat"
      description="Souqna drops the HubSpot tracking script (which also ships HubSpot Conversations) on every storefront page. Optionally, mirror inquiries into a HubSpot Form so leads land in your CRM."
      onSave={async () => {
        if (!isValidHubId(hubId)) {
          return {
            status: 'error',
            message: 'Hub ID should be a 4–10 digit number — find it in HubSpot Settings → Account.',
          };
        }
        if (formId && !isValidFormId(formId)) {
          return {
            status: 'error',
            message: 'Form ID should be a UUID — copy it from HubSpot Marketing → Forms.',
          };
        }
        return saveHubspotAction({
          storefrontSlug,
          hubId: hubId.trim(),
          formId: formId.trim(),
          hideOnInquireOpen,
        });
      }}
    >
      <AppField label="Hub ID" hint="The number after `hubspot.com/portal/`.">
        <input
          type="text"
          value={hubId}
          onChange={(e) => setHubId(e.target.value.trim())}
          placeholder="1234567"
          style={appCodeInputStyle}
          autoComplete="off"
        />
      </AppField>
      <AppField
        label="Form ID (optional)"
        hint="When set, every Souqna inquiry is also submitted to this HubSpot form so it lands as a CRM contact."
      >
        <input
          type="text"
          value={formId}
          onChange={(e) => setFormId(e.target.value.trim())}
          placeholder="Optional — UUID of a HubSpot form"
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
