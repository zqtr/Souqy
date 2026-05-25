import { getInstalledApp } from './installed';
import type { AppEvent } from './dispatch';

/**
 * HubSpot Live Chat + Forms plugin.
 *
 * The HubSpot tracking snippet is built from the founder's portal
 * "hub id" (a 6–10 digit number). The same script ships HubSpot's
 * chat widget. Founders who also paste a Forms API form id get a
 * server-side mirror of every inquiry submitted through Souqna —
 * useful for keeping the contact in their CRM even if the visitor
 * never opens the chat bubble.
 *
 * No HubSpot OAuth on Souqna's side: the hub id is public on every
 * HubSpot-tracked site, and the Forms API endpoint is keyed on the
 * (hub id, form id) pair the founder owns.
 */

export type HubspotSettings = {
  hubId: string;
  /** Optional. When set, every `inquiry.created` is mirrored to this
   *  HubSpot Form via the Forms Submissions API. */
  formId: string;
  hideOnInquireOpen: boolean;
};

export const DEFAULT_HUBSPOT_SETTINGS: HubspotSettings = {
  hubId: '',
  formId: '',
  hideOnInquireOpen: true,
};

const HUB_ID_RE = /^\d{4,10}$/;
// Form ids are UUID-shaped on HubSpot.
const FORM_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidHubId(id: string): boolean {
  return HUB_ID_RE.test(id.trim());
}
export function isValidFormId(id: string): boolean {
  return FORM_ID_RE.test(id.trim());
}

export function normaliseSettings(
  raw: Partial<HubspotSettings> | null | undefined,
): HubspotSettings {
  if (!raw) return DEFAULT_HUBSPOT_SETTINGS;
  return {
    hubId: typeof raw.hubId === 'string' ? raw.hubId.trim() : '',
    formId: typeof raw.formId === 'string' ? raw.formId.trim() : '',
    hideOnInquireOpen:
      typeof raw.hideOnInquireOpen === 'boolean'
        ? raw.hideOnInquireOpen
        : DEFAULT_HUBSPOT_SETTINGS.hideOnInquireOpen,
  };
}

export function buildHubspotSnippet(s: HubspotSettings): string {
  const id = JSON.stringify(s.hubId);
  const hideOnInquire = s.hideOnInquireOpen ? 'true' : 'false';
  return `
(function () {
  var d = document;
  var s = d.createElement('script');
  s.id = 'hs-script-loader'; s.async = true; s.defer = true;
  s.src = '//js.hs-scripts.com/' + ${id} + '.js';
  d.getElementsByTagName('head')[0].appendChild(s);
  if (${hideOnInquire}) {
    document.addEventListener('souqna:inquire:open', function () {
      try { window.HubSpotConversations && window.HubSpotConversations.widget.remove(); } catch (e) {}
    });
    document.addEventListener('souqna:inquire:close', function () {
      try { window.HubSpotConversations && window.HubSpotConversations.widget.load(); } catch (e) {}
    });
  }
  var hooks = window.__souqnaTrackHooks || (window.__souqnaTrackHooks = []);
  hooks.push(function (event, props) {
    try { window._hsq = window._hsq || []; window._hsq.push(['trackEvent', { id: event, value: (props && props.value) || 0 }]); } catch (e) {}
  });
})();
`.trim();
}

// ---------------------------------------------------------------
// Server-side: HubSpot Forms API submission
// ---------------------------------------------------------------

export async function onEvent(event: AppEvent): Promise<void> {
  if (event.kind !== 'inquiry.created') return;
  const installed = await getInstalledApp(event.storefrontSlug, 'hubspot');
  if (!installed || !installed.enabled) return;
  const settings = normaliseSettings(installed.settings as Partial<HubspotSettings>);
  if (!settings.hubId || !settings.formId) return;

  const inquiry = event.inquiry;
  const fields: Array<{ objectTypeId: string; name: string; value: string }> = [];
  if (inquiry.visitorEmail) {
    fields.push({ objectTypeId: '0-1', name: 'email', value: inquiry.visitorEmail });
  }
  if (inquiry.visitorName) {
    const [first, ...rest] = inquiry.visitorName.split(' ');
    if (first) fields.push({ objectTypeId: '0-1', name: 'firstname', value: first });
    if (rest.length > 0)
      fields.push({ objectTypeId: '0-1', name: 'lastname', value: rest.join(' ') });
  }
  if (inquiry.visitorPhone) {
    fields.push({ objectTypeId: '0-1', name: 'phone', value: inquiry.visitorPhone });
  }
  fields.push({ objectTypeId: '0-1', name: 'message', value: inquiry.message });
  if (inquiry.productTitle) {
    fields.push({
      objectTypeId: '0-1',
      name: 'sou_product_interest',
      value: inquiry.productTitle,
    });
  }

  const url = `https://api.hsforms.com/submissions/v3/integration/submit/${settings.hubId}/${settings.formId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fields,
      context: {
        pageUri: inquiry.sourceUrl ?? '',
        pageName: inquiry.productTitle ?? 'Souqna inquiry',
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`HubSpot Forms ${res.status}: ${detail.slice(0, 200)}`);
  }
}
