import 'server-only';
import { db, hasDb } from './db';
import type { Order } from './checkout-orders';
import { getPlanMeta, patchPlanMeta } from './billing';
import {
  sendSouqnaAccountCreatedTemplate,
  sendSouqnaFirstOrderTemplate,
} from './apps/whatsapp';

/**
 * Notifications center — single per-user event log behind the bell in
 * `AdminTopBar`. One table, many emitters: storefront publish/unpublish,
 * Vercel cert provisioning outcome, billing payments, plan changes.
 *
 * Why pre-rendered title/body (vs storing i18n keys + interpolation
 * args): mirrors `src/lib/mailer.ts`. A founder who switches locale
 * after a row is written sees the original locale; in exchange we keep
 * the popover a dumb renderer with zero interpolation logic.
 *
 * `meta` is an opaque jsonb blob whose shape varies per `kind` — see
 * `NotificationPayloadByKind` for the contracts callers must honour.
 */

export type NotificationKind =
  | 'storefront.live'
  | 'storefront.unpublished'
  | 'storefront.provision_failed'
  | 'billing.payment_succeeded'
  | 'billing.payment_failed'
  | 'plan.changed'
  | 'system.welcome'
  | 'storefront.first_created'
  | 'order.created'
  | 'storefront.weekly_reminder';

export interface NotificationPayloadByKind {
  'storefront.live': { slug: string; url: string };
  'storefront.unpublished': { slug: string };
  'storefront.provision_failed': { slug: string; error: string };
  'billing.payment_succeeded': {
    plan: string;
    amount?: number;
    currency?: string;
    periodEnd?: string;
  };
  'billing.payment_failed': { plan: string; reason?: string };
  'plan.changed': { from: string; to: string; periodEnd?: string };
  'system.welcome': { phone?: string | null; notificationChannels?: string[] };
  'storefront.first_created': { slug: string; url: string };
  'order.created': { slug: string; orderId: string; total: number; currency: string };
  'storefront.weekly_reminder': {
    slug: string;
    orders7d: number;
    products: number;
    revenueQar: number;
  };
}

export interface NotificationRow {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  href: string | null;
  meta: Record<string, unknown>;
  createdAt: Date;
  seenAt: Date | null;
}

interface CreateInput<K extends NotificationKind = NotificationKind> {
  userId: string;
  kind: K;
  title: string;
  body?: string;
  href?: string;
  meta?: NotificationPayloadByKind[K] & Record<string, unknown>;
}

interface DbNotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  meta: unknown;
  created_at: string;
  seen_at: string | null;
}

function fromRow(row: DbNotificationRow): NotificationRow {
  return {
    id: row.id,
    kind: row.kind as NotificationKind,
    title: row.title,
    body: row.body,
    href: row.href,
    meta:
      row.meta && typeof row.meta === 'object' ? (row.meta as Record<string, unknown>) : {},
    createdAt: new Date(row.created_at),
    seenAt: row.seen_at ? new Date(row.seen_at) : null,
  };
}

export async function createNotification<K extends NotificationKind>(
  input: CreateInput<K>,
): Promise<void> {
  if (!hasDb()) return;
  const meta = input.meta ?? {};
  try {
    await db()`
      insert into notifications (clerk_user_id, kind, title, title_ar, body, href, meta)
      values (
        ${input.userId},
        ${input.kind},
        ${input.title},
        ${input.title},
        ${input.body ?? null},
        ${input.href ?? null},
        ${JSON.stringify(meta)}::jsonb
      )
    `;
  } catch (err) {
    console.error('[notifications] createNotification failed', err);
  }
}

/* ────────────────────────────────────────────────────────────────── */
/* New bilingual surface (post-migration 023).                         */
/*                                                                    */
/* The bell + SSE channel consume this shape; the legacy English-only */
/* `createNotification`/`listForUser`/`unseenCount`/`markAllSeen`     */
/* helpers above stay around until every emitter is moved over.       */
/* ────────────────────────────────────────────────────────────────── */

export interface Notification {
  id: string;
  kind: string;
  title: string;
  titleAr: string;
  body: string | null;
  bodyAr: string | null;
  href: string | null;
  meta: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

interface DbNotificationRowFull extends DbNotificationRow {
  title_ar: string | null;
  body_ar: string | null;
  read_at: string | null;
}

function fromRowFull(row: DbNotificationRowFull): Notification {
  const meta =
    row.meta && typeof row.meta === 'object'
      ? (row.meta as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    titleAr: row.title_ar ?? row.title,
    body: row.body,
    bodyAr: row.body_ar,
    href: row.href,
    meta,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export interface PushNotificationInput {
  userId: string;
  kind: string;
  title: string;
  titleAr: string;
  body?: string | null;
  bodyAr?: string | null;
  href?: string | null;
  meta?: Record<string, unknown>;
}

/**
 * Insert one notification row. No-op when DB or user is missing.
 *
 * Idempotency: callers may pass `meta.dedupeKey` (e.g. derived from a
 * webhook event id) and a row with the same `dedupeKey + user + kind`
 * is skipped. Lets payment webhooks redeliver without duplicating.
 */
export async function pushNotification(input: PushNotificationInput): Promise<void> {
  if (!hasDb() || !input.userId) return;
  const meta = input.meta ?? {};
  const dedupeKey =
    typeof meta.dedupeKey === 'string' && meta.dedupeKey ? meta.dedupeKey : null;
  try {
    if (dedupeKey) {
      const existing = (await db()`
        select 1 from notifications
        where clerk_user_id = ${input.userId}
          and kind = ${input.kind}
          and meta->>'dedupeKey' = ${dedupeKey}
        limit 1
      `) as unknown as Array<unknown>;
      if (existing.length > 0) return;
    }
    await db()`
      insert into notifications
        (clerk_user_id, kind, title, title_ar, body, body_ar, href, meta)
      values (
        ${input.userId},
        ${input.kind},
        ${input.title},
        ${input.titleAr},
        ${input.body ?? null},
        ${input.bodyAr ?? null},
        ${input.href ?? null},
        ${JSON.stringify(meta)}::jsonb
      )
    `;
  } catch (err) {
    console.error('[notifications] pushNotification failed', err);
  }
}

export async function pushWelcomeNotification(input: {
  userId: string;
  phone?: string | null;
  founderName?: string | null;
}): Promise<void> {
  await pushNotification({
    userId: input.userId,
    kind: 'system.welcome',
    title: 'Welcome to Souqna',
    titleAr: 'أهلاً بك في سوقنا',
    body: input.phone
      ? `Your account is ready. We'll use ${input.phone} for important store and order notifications.`
      : 'Your account is ready. Add a phone number to receive important store and order notifications.',
    bodyAr: input.phone
      ? `حسابك جاهز. سنستخدم ${input.phone} لإرسال تنبيهات المتجر والطلبات المهمة.`
      : 'حسابك جاهز. أضف رقم هاتفك لتصلك تنبيهات المتجر والطلبات المهمة.',
    href: '/account',
    meta: {
      dedupeKey: `welcome-${input.userId}`,
      phone: input.phone ?? null,
      notificationChannels: ['bell', 'mobile', 'phone'],
    },
  });
  try {
    const meta = await getPlanMeta(input.userId);
    if (meta.account_created_whatsapp_sent === true) return;
    const res = await sendSouqnaAccountCreatedTemplate({
      phone: input.phone,
      founderName: input.founderName?.trim() || 'Founder',
    });
    if (res.status === 'error') console.warn('[notifications] account WhatsApp failed', res.reason);
    if (res.status === 'sent') {
      await patchPlanMeta(input.userId, { account_created_whatsapp_sent: true });
    }
  } catch (err) {
    console.warn('[notifications] account WhatsApp failed', err);
  }
}

export async function pushFirstWebsiteCongratsNotification(input: {
  userId: string;
  businessName: string;
  slug: string;
  url: string;
}): Promise<void> {
  await pushNotification({
    userId: input.userId,
    kind: 'storefront.first_created',
    title: 'Your first website is ready',
    titleAr: 'مبروك، موقعك الأول جاهز',
    body: `${input.businessName} is live on Souqna. You can now add products, receive orders, and share the store.`,
    bodyAr: `${input.businessName} أصبح جاهزاً على سوقنا. يمكنك الآن إضافة المنتجات، استقبال الطلبات، ومشاركة المتجر.`,
    href: input.url,
    meta: {
      dedupeKey: `first-website-${input.userId}`,
      slug: input.slug,
      url: input.url,
    },
  });
}

export async function pushOrderCreatedNotification(input: {
  userId: string;
  founderName?: string | null;
  businessName: string;
  slug: string;
  order: Order;
}): Promise<void> {
  const wasFirstOrder = await hasNoPreviousOrderNotification(input.userId, input.slug);
  await pushNotification({
    userId: input.userId,
    kind: 'order.created',
    title: `New order for ${input.businessName}`,
    titleAr: `طلب جديد من ${input.businessName}`,
    body: `${input.order.currency} ${input.order.totalQar} received. Open Orders to review and fulfil it.`,
    bodyAr: `تم استلام طلب بقيمة ${input.order.totalQar} ${input.order.currency}. افتح الطلبات لمراجعته وتجهيزه.`,
    href: `/account/orders?store=${encodeURIComponent(input.slug)}`,
    meta: {
      dedupeKey: `order-${input.order.id}`,
      slug: input.slug,
      orderId: input.order.id,
      total: input.order.totalQar,
      currency: input.order.currency,
    },
  });
  if (!wasFirstOrder) return;
  const meta = await getPlanMeta(input.userId);
  try {
    const res = await sendSouqnaFirstOrderTemplate({
      phone: typeof meta.notification_phone === 'string' ? meta.notification_phone : null,
      founderName:
        input.founderName?.trim() ||
        (typeof meta.founder_name === 'string' ? meta.founder_name : 'Founder'),
      businessName: input.businessName,
      order: input.order,
    });
    if (res.status === 'error') console.warn('[notifications] first-order WhatsApp failed', res.reason);
  } catch (err) {
    console.warn('[notifications] first-order WhatsApp failed', err);
  }
}

async function hasNoPreviousOrderNotification(userId: string, slug: string): Promise<boolean> {
  if (!hasDb()) return false;
  try {
    const rows = (await db()`
      select 1 from notifications
      where clerk_user_id = ${userId}
        and kind = 'order.created'
        and meta->>'slug' = ${slug}
      limit 1
    `) as unknown as Array<unknown>;
    return rows.length === 0;
  } catch (err) {
    console.error('[notifications] first-order check failed', err);
    return false;
  }
}

export async function pushWeeklyStoreReminder(input: {
  userId: string;
  businessName: string;
  slug: string;
  orders7d: number;
  products: number;
  revenueQar: number;
  weekKey: string;
}): Promise<void> {
  const body =
    input.orders7d > 0
      ? `${input.businessName} received ${input.orders7d} order${input.orders7d === 1 ? '' : 's'} this week. Review orders, update products, and keep the store fresh.`
      : `${input.businessName} is ready for the week. Add or refresh products, then share the store again.`;
  const bodyAr =
    input.orders7d > 0
      ? `${input.businessName} استقبل ${input.orders7d} طلب خلال هذا الأسبوع. راجع الطلبات وحدّث المنتجات ليبقى المتجر نشطاً.`
      : `${input.businessName} جاهز لهذا الأسبوع. أضف أو حدّث المنتجات ثم شارك المتجر من جديد.`;

  await pushNotification({
    userId: input.userId,
    kind: 'storefront.weekly_reminder',
    title: `Weekly store reminder · ${input.businessName}`,
    titleAr: `تذكير أسبوعي للمتجر · ${input.businessName}`,
    body,
    bodyAr,
    href: `/account?store=${encodeURIComponent(input.slug)}`,
    meta: {
      dedupeKey: `weekly-${input.weekKey}-${input.slug}`,
      slug: input.slug,
      orders7d: input.orders7d,
      products: input.products,
      revenueQar: input.revenueQar,
    },
  });
}

export async function pushWeeklyStoreReminders(): Promise<{ stores: number }> {
  if (!hasDb()) return { stores: 0 };
  const weekKey = weekKeyFor(new Date());
  try {
    const rows = (await db()`
      select
        b.slug,
        b.business_name,
        b.clerk_user_id,
        coalesce(o.orders_7d, 0)::int as orders_7d,
        coalesce(o.revenue_qar, 0)::int as revenue_qar,
        coalesce(p.products, 0)::int as products
      from briefs b
      left join (
        select
          storefront_slug,
          count(*)::int as orders_7d,
          coalesce(sum(total_qar), 0)::int as revenue_qar
        from checkout_orders
        where created_at >= now() - interval '7 days'
          and order_status <> 'cancelled'
        group by storefront_slug
      ) o on o.storefront_slug = b.slug
      left join (
        select storefront_slug, count(*)::int as products
        from products
        where status in ('active', 'sold_out')
        group by storefront_slug
      ) p on p.storefront_slug = b.slug
      where b.expires_at > now()
        and b.is_published = true
      order by b.created_at desc
      limit 500
    `) as unknown as Array<{
      slug: string;
      business_name: string;
      clerk_user_id: string;
      orders_7d: number;
      revenue_qar: number;
      products: number;
    }>;

    for (const row of rows) {
      await pushWeeklyStoreReminder({
        userId: row.clerk_user_id,
        businessName: row.business_name,
        slug: row.slug,
        orders7d: row.orders_7d,
        products: row.products,
        revenueQar: row.revenue_qar,
        weekKey,
      });
    }
    return { stores: rows.length };
  } catch (err) {
    console.error('[notifications] pushWeeklyStoreReminders failed', err);
    return { stores: 0 };
  }
}

function weekKeyFor(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
}

export async function listNotifications(
  userId: string,
  opts: { limit?: number; before?: string } = {},
): Promise<Notification[]> {
  if (!hasDb() || !userId) return [];
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  try {
    const rows = (opts.before
      ? await db()`
          select id, kind, title, title_ar, body, body_ar, href, meta, created_at, read_at, seen_at
          from notifications
          where clerk_user_id = ${userId}
            and created_at < (
              select created_at from notifications
              where id = ${opts.before} and clerk_user_id = ${userId}
            )
          order by created_at desc
          limit ${limit}
        `
      : await db()`
          select id, kind, title, title_ar, body, body_ar, href, meta, created_at, read_at, seen_at
          from notifications
          where clerk_user_id = ${userId}
          order by created_at desc
          limit ${limit}
        `) as unknown as DbNotificationRowFull[];
    return rows.map(fromRowFull);
  } catch (err) {
    console.error('[notifications] listNotifications failed', err);
    return [];
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  if (!hasDb() || !userId) return 0;
  try {
    const rows = (await db()`
      select count(*)::int as c
      from notifications
      where clerk_user_id = ${userId} and read_at is null
    `) as unknown as { c: number }[];
    return rows[0]?.c ?? 0;
  } catch (err) {
    console.error('[notifications] getUnreadCount failed', err);
    return 0;
  }
}

export async function markRead(input: {
  userId: string;
  ids: string[];
}): Promise<void> {
  if (!hasDb() || !input.userId || input.ids.length === 0) return;
  try {
    await db()`
      update notifications
         set read_at = coalesce(read_at, now()),
             seen_at = coalesce(seen_at, now())
       where clerk_user_id = ${input.userId}
         and id = any(${input.ids}::uuid[])
    `;
  } catch (err) {
    console.error('[notifications] markRead failed', err);
  }
}

export async function markAllRead(userId: string): Promise<void> {
  if (!hasDb() || !userId) return;
  try {
    await db()`
      update notifications
         set read_at = now(),
             seen_at = coalesce(seen_at, now())
       where clerk_user_id = ${userId} and read_at is null
    `;
  } catch (err) {
    console.error('[notifications] markAllRead failed', err);
  }
}

/**
 * Latest `created_at` ISO string across the user's notifications, used
 * by the SSE delta loop as a cheap cursor.
 */
export async function latestNotificationTs(userId: string): Promise<string | null> {
  if (!hasDb() || !userId) return null;
  try {
    const rows = (await db()`
      select max(created_at)::text as t
      from notifications where clerk_user_id = ${userId}
    `) as unknown as { t: string | null }[];
    return rows[0]?.t ?? null;
  } catch {
    return null;
  }
}

/**
 * Notifications strictly newer than the given ISO timestamp. Cap of 50
 * defends against runaway delta payloads if a writer goes wild.
 */
export async function listNotificationsSince(
  userId: string,
  sinceIso: string,
): Promise<Notification[]> {
  if (!hasDb() || !userId) return [];
  try {
    const rows = (await db()`
      select id, kind, title, title_ar, body, body_ar, href, meta, created_at, read_at, seen_at
      from notifications
      where clerk_user_id = ${userId}
        and created_at > ${sinceIso}::timestamptz
      order by created_at desc
      limit 50
    `) as unknown as DbNotificationRowFull[];
    return rows.map(fromRowFull);
  } catch (err) {
    console.error('[notifications] listNotificationsSince failed', err);
    return [];
  }
}

export async function listForUser(
  userId: string,
  opts: { limit?: number; unseenOnly?: boolean } = {},
): Promise<NotificationRow[]> {
  if (!hasDb() || !userId) return [];
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  try {
    const rows = (opts.unseenOnly
      ? await db()`
          select id, kind, title, body, href, meta, created_at, seen_at
          from notifications
          where clerk_user_id = ${userId} and seen_at is null
          order by created_at desc
          limit ${limit}
        `
      : await db()`
          select id, kind, title, body, href, meta, created_at, seen_at
          from notifications
          where clerk_user_id = ${userId}
          order by created_at desc
          limit ${limit}
        `) as unknown as DbNotificationRow[];
    return rows.map(fromRow);
  } catch (err) {
    console.error('[notifications] listForUser failed', err);
    return [];
  }
}

export async function unseenCount(userId: string): Promise<number> {
  if (!hasDb() || !userId) return 0;
  try {
    const rows = (await db()`
      select count(*)::int as c
      from notifications
      where clerk_user_id = ${userId} and seen_at is null
    `) as unknown as { c: number }[];
    return rows[0]?.c ?? 0;
  } catch (err) {
    console.error('[notifications] unseenCount failed', err);
    return 0;
  }
}

export async function markAllSeen(userId: string): Promise<void> {
  if (!hasDb() || !userId) return;
  try {
    // Keep `read_at` in lock-step with `seen_at` while both APIs are
    // live so the partial unread index and the legacy `seen_at` query
    // never disagree.
    await db()`
      update notifications
         set seen_at = now(),
             read_at = coalesce(read_at, now())
       where clerk_user_id = ${userId}
         and (seen_at is null or read_at is null)
    `;
  } catch (err) {
    console.error('[notifications] markAllSeen failed', err);
  }
}
