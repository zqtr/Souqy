import { listInstalledApps, setAppLastError, setAppLastSuccess } from './installed';
import type { Inquiry } from '@/lib/inquiries';
import type { Order, OrderItem } from '@/lib/orders';
import type { Product } from '@/lib/products';
import { onEvent as zapierOnEvent } from './zapier';
import { onEvent as notionOnEvent } from './notion';
import { onEvent as sheetsOnEvent } from './google-sheets';
import { onEvent as tiktokOnEvent } from './tiktok-pixel';
import { onEvent as hubspotOnEvent } from './hubspot';
import {
  onKlaviyoEvent,
  onMailchimpEvent,
  syncOAuthApp,
} from './oauth-providers';

/**
 * Plugin event bus.
 *
 * Five sites in the codebase write a row that an installed plugin might
 * care about (inquiry submitted, order placed, product created). Rather
 * than hard-coding integration calls into each write site, the writes
 * fire a typed event through `dispatchAppEvent` and the bus fans out
 * to every installed + enabled plugin that exported an `onEvent`.
 *
 * Errors are caught per-plugin and recorded via `setAppLastError` so a
 * single broken integration cannot block the originating insert.
 *
 * Plugin handlers are imported statically (not dynamically) so the
 * production bundle stays tree-shake-friendly. Each plugin's `onEvent`
 * is a no-op when the app isn't installed for that storefront — it's
 * the bus that filters by install status.
 */

export type AppEventInquiryCreated = {
  kind: 'inquiry.created';
  storefrontSlug: string;
  inquiry: Inquiry;
};

export type AppEventOrderCreated = {
  kind: 'order.created';
  storefrontSlug: string;
  order: Order;
  items: OrderItem[];
};

export type AppEventProductCreated = {
  kind: 'product.created';
  storefrontSlug: string;
  product: Product;
};

export type AppEvent =
  | AppEventInquiryCreated
  | AppEventOrderCreated
  | AppEventProductCreated;

export type AppEventHandler = (
  event: AppEvent,
  installedAppId: string,
) => Promise<void> | void;

const HANDLERS: Record<string, AppEventHandler> = {
  zapier: zapierOnEvent,
  notion: notionOnEvent,
  'google-sheets': sheetsOnEvent,
  'tiktok-pixel': tiktokOnEvent,
  hubspot: hubspotOnEvent,
  mailchimp: (event) => onMailchimpEvent(event),
  klaviyo: (event) => onKlaviyoEvent(event),
  'instagram-shop': (event) => {
    if (event.kind !== 'product.created') return;
    return syncOAuthApp(event.storefrontSlug, 'instagram-shop');
  },
};

/**
 * Fan an event out to every installed + enabled plugin handler. Never
 * throws — every per-plugin failure is recorded on `installed_apps`
 * and logged. Returns the count of successful handler invocations,
 * useful for tests + the audit log.
 */
export async function dispatchAppEvent(event: AppEvent): Promise<number> {
  let installed: Awaited<ReturnType<typeof listInstalledApps>>;
  try {
    installed = await listInstalledApps(event.storefrontSlug);
  } catch (err) {
    console.warn('[apps/dispatch] could not load installed apps', err);
    return 0;
  }

  let succeeded = 0;
  await Promise.allSettled(
    installed
      .filter((row) => row.enabled)
      .map(async (row) => {
        const handler = HANDLERS[row.appId];
        if (!handler) return;
        try {
          await handler(event, row.appId);
          succeeded += 1;
          await setAppLastSuccess(event.storefrontSlug, row.appId).catch(() => {});
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'plugin handler failed';
          console.warn(
            `[apps/dispatch] ${row.appId} failed on ${event.kind}`,
            message,
          );
          await setAppLastError(event.storefrontSlug, row.appId, message).catch(
            () => {},
          );
        }
      }),
  );
  return succeeded;
}

/**
 * Fire an event but never await it. Used at write sites where we don't
 * want to slow down the user response — the dispatch happens in the
 * background and any failures are logged + recorded on the install row.
 */
export function dispatchAppEventDetached(event: AppEvent): void {
  void dispatchAppEvent(event).catch((err) => {
    console.warn('[apps/dispatch] detached failure', err);
  });
}
