import { getInstalledApp } from './installed';
import type { AppEvent } from './dispatch';
import type { Inquiry } from '@/lib/inquiries';
import type { Order, OrderItem } from '@/lib/orders';
import type { Product } from '@/lib/products';

/**
 * Zapier plugin.
 *
 * Pure webhook fan-out — the founder creates a Zap with the
 * "Webhooks by Zapier > Catch Hook" trigger, copies the unique Zap
 * URL, and pastes it into the corresponding row in Settings. Souqna
 * POSTs the matching event payload to that URL.
 *
 * No Souqna account, no API key, no third-party SDK. Each row in
 * `hookUrls` is just an opaque URL the founder owns end-to-end.
 *
 * Reliability: every dispatch retries up to 3 times with exponential
 * backoff (250ms / 1s / 4s). After the third failure the dispatcher
 * marks the install with `last_error` so the founder can see it on
 * the configure page.
 */

export type ZapierEventKind =
  | 'inquiry.created'
  | 'order.created'
  | 'product.created';

export type ZapierSettings = {
  /** Per-event hook URL map. Keys must match `ZapierEventKind`. */
  hookUrls: Partial<Record<ZapierEventKind, string>>;
};

export const DEFAULT_ZAPIER_SETTINGS: ZapierSettings = {
  hookUrls: {},
};

const HOOK_URL_RE = /^https?:\/\/(?:hooks\.zapier\.com|zapier\.com|hook\.eu1\.make\.com|hook\.us2\.make\.com|hook\.eu2\.make\.com|hooks\.[\w-]+\.make\.com)\/.+/i;

export function isAcceptedHookUrl(url: string): boolean {
  // Accepts both Zapier and Make.com (formerly Integromat) endpoints —
  // both honour "Catch Hook" semantics and are interchangeable for
  // founders. Anything else is rejected to keep this plugin from
  // turning into an open-relay webhook poster.
  return typeof url === 'string' && HOOK_URL_RE.test(url.trim());
}

export function normaliseSettings(
  raw: Partial<ZapierSettings> | null | undefined,
): ZapierSettings {
  if (!raw || !raw.hookUrls) return DEFAULT_ZAPIER_SETTINGS;
  const out: ZapierSettings['hookUrls'] = {};
  for (const k of ['inquiry.created', 'order.created', 'product.created'] as ZapierEventKind[]) {
    const v = raw.hookUrls[k];
    if (typeof v === 'string' && v.trim().length > 0) {
      out[k] = v.trim();
    }
  }
  return { hookUrls: out };
}

export async function onEvent(event: AppEvent): Promise<void> {
  const installed = await getInstalledApp(event.storefrontSlug, 'zapier');
  if (!installed || !installed.enabled) return;
  const settings = normaliseSettings(installed.settings as Partial<ZapierSettings>);
  const url = settings.hookUrls[event.kind];
  if (!url) return;
  await postWithRetry(url, buildPayload(event));
}

export async function postTestEvent(url: string): Promise<void> {
  await postWithRetry(url, {
    kind: 'test.ping',
    storefront: 'demo',
    sentAt: new Date().toISOString(),
    note: 'Hello from Souqna — your Zap is wired up.',
  });
}

function buildPayload(event: AppEvent): Record<string, unknown> {
  const base = {
    kind: event.kind,
    storefront: event.storefrontSlug,
    sentAt: new Date().toISOString(),
  };
  if (event.kind === 'inquiry.created') {
    return { ...base, inquiry: serialiseInquiry(event.inquiry) };
  }
  if (event.kind === 'order.created') {
    return {
      ...base,
      order: serialiseOrder(event.order),
      items: event.items.map(serialiseItem),
    };
  }
  return { ...base, product: serialiseProduct(event.product) };
}

function serialiseInquiry(i: Inquiry) {
  return {
    id: i.id,
    productId: i.productId,
    productTitle: i.productTitle,
    message: i.message,
    visitorName: i.visitorName,
    visitorEmail: i.visitorEmail,
    visitorPhone: i.visitorPhone,
    preferredChannel: i.preferredChannel,
    sourceUrl: i.sourceUrl,
    createdAt: i.createdAt.toISOString(),
  };
}

function serialiseOrder(o: Order) {
  return {
    id: o.id,
    number: o.orderNumber,
    status: o.status,
    paymentStatus: o.paymentStatus,
    fulfilmentStatus: o.fulfilmentStatus,
    currency: o.currencyCode,
    subtotal: o.subtotal,
    shippingTotal: o.shippingTotal,
    discountTotal: o.discountTotal,
    taxTotal: o.taxTotal,
    total: o.total,
    notes: o.notes,
    channel: o.channel,
    placedAt: o.placedAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
  };
}

function serialiseItem(it: OrderItem) {
  return {
    id: it.id,
    productId: it.productId,
    productTitle: it.productTitle,
    variantLabel: it.variantLabel,
    unitPrice: it.unitPrice,
    quantity: it.quantity,
    total: it.total,
  };
}

function serialiseProduct(p: Product) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    priceQar: p.priceQar,
    imageUrl: p.imageUrl,
    category: p.category,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  };
}

const RETRY_DELAYS_MS = [250, 1000, 4000];

async function postWithRetry(
  url: string,
  body: Record<string, unknown>,
): Promise<void> {
  let lastError: unknown = null;
  for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      // Zapier returns 200 with `{ "status": "success" }` on success.
      // 4xx (except 429) means the founder unhooked the Zap — no point
      // retrying.
      if (res.ok) return;
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Webhook rejected ${res.status}: ${detail.slice(0, 200)}`);
      }
      lastError = new Error(`Webhook returned ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    const delay = RETRY_DELAYS_MS[i];
    if (delay !== undefined) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Webhook failed');
}
