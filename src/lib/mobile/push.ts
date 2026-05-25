import 'server-only';

import { db, hasDb } from '@/lib/db';
import { env } from '@/lib/env';
import { hasCapability, isRole, type Capability } from '@/lib/team/capabilities';
import type { Order } from '@/lib/checkout-orders';

export type MobilePushTokenInput = {
  clerkUserId: string;
  deviceId: string;
  expoPushToken: string;
  platform?: string;
  appVersion?: string | null;
};

type PushTokenRow = {
  clerk_user_id: string;
  expo_push_token: string;
};

export async function upsertMobilePushToken(
  input: MobilePushTokenInput,
): Promise<void> {
  if (!hasDb()) return;
  await db()`
    insert into mobile_push_tokens (
      clerk_user_id, device_id, expo_push_token, platform, app_version
    ) values (
      ${input.clerkUserId}, ${input.deviceId}, ${input.expoPushToken},
      ${input.platform ?? 'ios'}, ${input.appVersion ?? null}
    )
    on conflict (clerk_user_id, device_id) do update set
      expo_push_token = excluded.expo_push_token,
      platform = excluded.platform,
      app_version = excluded.app_version,
      last_seen_at = now(),
      updated_at = now()
  `;
}

export async function deleteMobilePushToken(input: {
  clerkUserId: string;
  deviceId?: string | null;
  expoPushToken?: string | null;
}): Promise<void> {
  if (!hasDb()) return;
  if (input.deviceId) {
    await db()`
      delete from mobile_push_tokens
      where clerk_user_id = ${input.clerkUserId} and device_id = ${input.deviceId}
    `;
    return;
  }
  if (input.expoPushToken) {
    await db()`
      delete from mobile_push_tokens
      where clerk_user_id = ${input.clerkUserId}
        and expo_push_token = ${input.expoPushToken}
    `;
  }
}

async function recipientRowsForStorefront(
  storefrontSlug: string,
  capability: Capability,
): Promise<PushTokenRow[]> {
  if (!hasDb()) return [];
  const rows = (await db()`
    select distinct t.clerk_user_id, t.expo_push_token,
           case when b.clerk_user_id = t.clerk_user_id then 'owner' else m.role end as role,
           coalesce(m.capabilities, '{}'::jsonb) as capabilities
    from mobile_push_tokens t
    join briefs b on b.slug = ${storefrontSlug}
    left join storefront_members m
      on m.storefront_slug = b.slug and m.clerk_user_id = t.clerk_user_id
    where b.expires_at > now()
      and (
        t.clerk_user_id = b.clerk_user_id
        or m.clerk_user_id is not null
      )
  `) as unknown as Array<
    PushTokenRow & { role: string; capabilities: unknown }
  >;

  return rows.filter((row) => {
    if (!isRole(row.role)) return false;
    const caps =
      row.capabilities && typeof row.capabilities === 'object'
        ? (row.capabilities as Record<string, boolean>)
        : {};
    return hasCapability({ role: row.role, capabilities: caps }, capability);
  });
}

export async function notifyMobileNewOrder(input: {
  storefrontSlug: string;
  businessName: string;
  order: Order;
}): Promise<void> {
  const recipients = await recipientRowsForStorefront(
    input.storefrontSlug,
    'orders.manage',
  );
  if (recipients.length === 0) return;

  await sendExpoPush(
    recipients.map((r) => r.expo_push_token),
    {
      title: `New order · ${input.businessName}`,
      body: `${input.order.currency} ${input.order.totalQar} · tap to review`,
      data: {
        kind: 'order.created',
        store: input.storefrontSlug,
        orderId: input.order.id,
        title: `New order · ${input.businessName}`,
        body: `${input.order.customerName} · ${input.order.currency} ${input.order.totalQar}`,
      },
      sound: 'default',
      badge: 1,
    },
  );
}

/**
 * Push when a merchant marks an order as shipped. Distinct copy from
 * `notifyMobileNewOrder` so the merchant's other team members know
 * the courier handoff is in motion, not a fresh sale.
 */
export async function notifyMobileOrderShipped(input: {
  storefrontSlug: string;
  businessName: string;
  order: Order;
}): Promise<void> {
  const recipients = await recipientRowsForStorefront(
    input.storefrontSlug,
    'orders.manage',
  );
  if (recipients.length === 0) return;
  await sendExpoPush(
    recipients.map((r) => r.expo_push_token),
    {
      title: `Order shipped · ${input.businessName}`,
      body: `${input.order.customerName} · tap to track`,
      data: {
        kind: 'order.status.shipped',
        store: input.storefrontSlug,
        orderId: input.order.id,
        title: `Order shipped · ${input.businessName}`,
        body: `${input.order.customerName} · tap to track`,
      },
      sound: 'default',
    },
  );
}

/** Push when a payment is marked as paid. Drives the "money's in" moment. */
export async function notifyMobilePaymentPaid(input: {
  storefrontSlug: string;
  businessName: string;
  order: Order;
}): Promise<void> {
  const recipients = await recipientRowsForStorefront(
    input.storefrontSlug,
    'orders.manage',
  );
  if (recipients.length === 0) return;
  await sendExpoPush(
    recipients.map((r) => r.expo_push_token),
    {
      title: `Payment received · ${input.businessName}`,
      body: `${input.order.currency} ${input.order.totalQar} from ${input.order.customerName}`,
      data: {
        kind: 'order.payment.paid',
        store: input.storefrontSlug,
        orderId: input.order.id,
        title: `Payment received · ${input.businessName}`,
        body: `${input.order.currency} ${input.order.totalQar} from ${input.order.customerName}`,
      },
      sound: 'default',
      badge: 1,
    },
  );
}

/** Push when a payment is refunded. Warning tone on the mobile toast. */
export async function notifyMobilePaymentRefunded(input: {
  storefrontSlug: string;
  businessName: string;
  order: Order;
}): Promise<void> {
  const recipients = await recipientRowsForStorefront(
    input.storefrontSlug,
    'orders.manage',
  );
  if (recipients.length === 0) return;
  await sendExpoPush(
    recipients.map((r) => r.expo_push_token),
    {
      title: `Refund issued · ${input.businessName}`,
      body: `${input.order.currency} ${input.order.totalQar} to ${input.order.customerName}`,
      data: {
        kind: 'order.payment.refunded',
        store: input.storefrontSlug,
        orderId: input.order.id,
        title: `Refund issued · ${input.businessName}`,
        body: `${input.order.currency} ${input.order.totalQar} to ${input.order.customerName}`,
      },
      sound: 'default',
    },
  );
}

async function sendExpoPush(
  tokens: string[],
  message: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
    sound?: 'default';
    badge?: number;
  },
): Promise<void> {
  const unique = [...new Set(tokens)].filter((t) => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['));
  if (unique.length === 0) return;

  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(env.EXPO_ACCESS_TOKEN
            ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(
          chunk.map((to) => ({
            to,
            title: message.title,
            body: message.body,
            data: message.data ?? {},
            sound: message.sound,
            badge: message.badge,
          })),
        ),
      });
      const json = (await res.json().catch(() => null)) as
        | { data?: Array<{ status: string; details?: { error?: string } }> }
        | null;
      const tickets = json?.data ?? [];
      const deadTokens = tickets
        .map((ticket, index) =>
          ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
            ? chunk[index]
            : null,
        )
        .filter((token): token is string => Boolean(token));
      if (deadTokens.length > 0) {
        await db()`
          delete from mobile_push_tokens
          where expo_push_token = any(${deadTokens}::text[])
        `;
      }
    } catch (err) {
      console.error('[mobile.push] send failed', err);
    }
  }
}
