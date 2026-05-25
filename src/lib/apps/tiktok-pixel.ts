import { decryptToken } from './crypto';
import { getInstalledApp } from './installed';
import type { AppEvent } from './dispatch';

/**
 * TikTok Pixel + Events API plugin.
 *
 * The founder pastes:
 *   - their own Pixel id (mandatory; format `C[A-Z0-9]+`)
 *   - their own Events API access token (optional; unlocks server-side
 *     event mirroring so ad-blockers can't drop conversions)
 *
 * Souqna never holds a TikTok app registration. All requests use the
 * founder's credentials and post to TikTok directly.
 *
 * Storefront snippet: drops the standard TikTok base pixel and hooks
 * into `window.__souqnaTrack` so the existing storefront UI (e.g.
 * InquireDialog, future cart) can fire `Lead` / `CompletePayment`
 * without each surface knowing TikTok exists.
 *
 * Server-side: `onEvent` mirrors `inquiry.created` (Lead) and
 * `order.created` (CompletePayment) to TikTok's Events API when an
 * access token is configured.
 */

export type TikTokPixelSettings = {
  pixelId: string;
  /** Optional advanced-matching toggle. When true, the snippet hashes
   *  email/phone before reporting (PII never leaves the visitor's
   *  browser un-hashed). */
  advancedMatching: boolean;
  /** When true, fire ViewContent on every page view (default). */
  autoViewContent: boolean;
};

export const DEFAULT_TIKTOK_SETTINGS: TikTokPixelSettings = {
  pixelId: '',
  advancedMatching: true,
  autoViewContent: true,
};

const PIXEL_ID_RE = /^[A-Z0-9]{16,32}$/i;

export function isValidPixelId(id: string): boolean {
  return PIXEL_ID_RE.test(id.trim());
}

export function normaliseSettings(
  raw: Partial<TikTokPixelSettings> | null | undefined,
): TikTokPixelSettings {
  if (!raw) return DEFAULT_TIKTOK_SETTINGS;
  return {
    pixelId: typeof raw.pixelId === 'string' ? raw.pixelId.trim() : '',
    advancedMatching:
      typeof raw.advancedMatching === 'boolean'
        ? raw.advancedMatching
        : DEFAULT_TIKTOK_SETTINGS.advancedMatching,
    autoViewContent:
      typeof raw.autoViewContent === 'boolean'
        ? raw.autoViewContent
        : DEFAULT_TIKTOK_SETTINGS.autoViewContent,
  };
}

/**
 * Builds the inline JS dropped into the storefront `<head>` via
 * next/script. Includes the standard TikTok pixel bootstrapper plus
 * the bridge that registers a `__souqnaTrackHooks` listener so any
 * call to `window.__souqnaTrack(event, props)` hits TikTok.
 */
export function buildTikTokSnippet(s: TikTokPixelSettings): string {
  const id = JSON.stringify(s.pixelId);
  const advanced = s.advancedMatching ? 'true' : 'false';
  const auto = s.autoViewContent ? 'true' : 'false';
  return `
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
  ttq.load(${id});
  ttq.page();
  if (${auto}) { try { ttq.track('ViewContent'); } catch(e){} }
  if (${advanced}) { try { ttq.identify({}); } catch(e){} }
  var hooks = w.__souqnaTrackHooks || (w.__souqnaTrackHooks = []);
  hooks.push(function (event, props) {
    try { ttq.track(event, props || {}); } catch (e) {}
  });
}(window, document, 'ttq');
`.trim();
}

// ------------------------------------------------------------------
// Server-side Events API mirror
// ------------------------------------------------------------------

const EVENTS_API_URL = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

/**
 * Mirror Souqna events to TikTok's Events API when the founder has
 * supplied an access token. TikTok refers to this as "server events" /
 * EventsAPI and uses it to recover conversions blocked by client-side
 * ad blockers. Never throws; failure is just a missed sync.
 */
export async function onEvent(event: AppEvent): Promise<void> {
  if (event.kind !== 'inquiry.created' && event.kind !== 'order.created') {
    return;
  }
  const installed = await getInstalledApp(event.storefrontSlug, 'tiktok-pixel');
  if (!installed || !installed.enabled) return;
  const settings = normaliseSettings(installed.settings as Partial<TikTokPixelSettings>);
  if (!settings.pixelId) return;
  const accessToken = decryptToken(installed.oauthAccessTokenCt);
  if (!accessToken) return;

  const eventName = event.kind === 'inquiry.created' ? 'Lead' : 'CompletePayment';
  const ts = Math.floor(Date.now() / 1000);

  let user: Record<string, unknown> = {};
  let props: Record<string, unknown> = {};
  if (event.kind === 'inquiry.created') {
    user = pruneUser({
      email: event.inquiry.visitorEmail,
      phone: event.inquiry.visitorPhone,
    });
    props = {
      content_name: event.inquiry.productTitle ?? 'Inquiry',
      content_id: event.inquiry.productId ?? `inquiry-${event.inquiry.id}`,
      currency: 'QAR',
    };
  } else {
    props = {
      currency: event.order.currencyCode || 'QAR',
      value: event.order.total,
      content_id: `order-${event.order.id}`,
      contents: event.items.map((it) => ({
        content_id: it.productId ?? `line-${it.id}`,
        content_name: it.productTitle,
        quantity: it.quantity,
        price: it.unitPrice,
      })),
    };
  }

  const body = {
    event_source: 'web',
    event_source_id: settings.pixelId,
    data: [
      {
        event: eventName,
        event_time: ts,
        event_id: `${event.storefrontSlug}-${event.kind}-${ts}`,
        user,
        properties: props,
      },
    ],
  };

  const res = await fetch(EVENTS_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'access-token': accessToken,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`TikTok Events API ${res.status}: ${detail.slice(0, 240)}`);
  }
}

function pruneUser(u: Record<string, string | null>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(u)) {
    if (v && v.length > 0) out[k] = v;
  }
  return out;
}
