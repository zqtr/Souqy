import 'server-only';

import { unstable_noStore as noStore } from 'next/cache';
import { db, hasDb } from './db';
import { PLAN_LIMITS, PLANS, type Plan } from './plans';
import { storefrontBaseUrl } from './storefrontUrl';

export type SouqnaSubscriberStore = {
  slug: string;
  businessName: string;
  isPublished: boolean;
  isDeleted: boolean;
  createdAt: Date;
  liveUrl: string;
};

export type SouqnaSubscriberKind =
  | 'paid'
  | 'comped'
  | 'legacy'
  | 'pending_checkout'
  | 'failed_checkout'
  | 'payment_issue';

export type SouqnaSubscriber = {
  clerkUserId: string;
  email: string | null;
  plan: Plan;
  planLabel: string;
  kind: SouqnaSubscriberKind;
  provider: string | null;
  paymentStatus: string | null;
  cycle: string | null;
  source: string | null;
  paymentId: string | null;
  currentPeriodEnd: Date | null;
  updatedAt: Date;
  lastHistorySource: string | null;
  lastHistoryAt: Date | null;
  storefrontCount: number;
  stores: SouqnaSubscriberStore[];
};

type SubscriberRow = {
  clerk_user_id: string;
  plan: string;
  meta: unknown;
  updated_at: string;
  contact_email: string | null;
  storefront_count: number | string;
  stores: unknown;
  last_history_source: string | null;
  last_history_at: string | null;
};

function isPlan(value: unknown): value is Plan {
  return typeof value === 'string' && (PLANS as readonly string[]).includes(value);
}

function metaString(meta: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function metaRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function classifySubscriber(plan: Plan, meta: Record<string, unknown>): SouqnaSubscriberKind {
  const provider = metaString(meta, 'provider')?.toLowerCase();
  const status = metaString(meta, 'status', 'skipcashStatus')?.toLowerCase() ?? '';
  const source = metaString(meta, 'source')?.toLowerCase() ?? '';
  const hasSkipCash = Boolean(metaString(meta, 'skipcashPaymentId', 'paymentId'));
  const hasPaypal = Boolean(metaString(meta, 'paypalSubscriptionId'));
  const isAdminGrant =
    source === 'admin_grant' ||
    source === 'souqna_operator' ||
    meta.adminGrant === true ||
    meta.operatorUserId != null;
  const failed = ['failed', 'cancelled', 'canceled', 'expired', 'declined', 'suspended'].some((word) =>
    status.includes(word),
  );
  const paid = ['paid', 'success', 'succeeded', 'active', 'approved', 'captured'].some((word) =>
    status.includes(word),
  );

  if (plan === 'free') {
    return failed ? 'failed_checkout' : 'pending_checkout';
  }
  if ((provider === 'skipcash' || hasSkipCash) && failed) return 'payment_issue';
  if ((provider === 'skipcash' || hasSkipCash) && (paid || status === '')) return 'paid';
  if (provider === 'skipcash' || hasSkipCash) return 'pending_checkout';
  if (provider === 'paypal' || hasPaypal) return 'legacy';
  if (isAdminGrant) return 'comped';
  return 'comped';
}

function toStores(value: unknown): SouqnaSubscriberStore[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = metaRecord(item);
      const slug = metaString(record, 'slug');
      if (!slug) return null;
      return {
        slug,
        businessName: metaString(record, 'businessName') ?? slug,
        isPublished: record.isPublished === true,
        isDeleted: record.isDeleted === true,
        createdAt: new Date(metaString(record, 'createdAt') ?? Date.now()),
        liveUrl: storefrontBaseUrl(slug),
      };
    })
    .filter((store): store is SouqnaSubscriberStore => Boolean(store));
}

export function subscriberKindLabel(kind: SouqnaSubscriberKind): string {
  switch (kind) {
    case 'paid':
      return 'paid';
    case 'comped':
      return 'comped';
    case 'legacy':
      return 'legacy';
    case 'pending_checkout':
      return 'pending';
    case 'failed_checkout':
      return 'failed checkout';
    case 'payment_issue':
      return 'payment issue';
  }
}

export async function listSouqnaSubscribers(limit = 200): Promise<SouqnaSubscriber[]> {
  noStore();
  if (!hasDb()) return [];

  const rows = (await db()`
    select
      up.clerk_user_id,
      up.plan,
      up.meta,
      up.updated_at,
      coalesce(
        max(nullif(b.contact_email, '')),
        up.meta->>'account_welcome_email_to',
        up.meta->>'email'
      ) as contact_email,
      count(b.slug)::int as storefront_count,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'slug', b.slug,
            'businessName', b.business_name,
            'isPublished', b.is_published,
            'isDeleted', b.deleted_at is not null,
            'createdAt', b.created_at
          )
          order by b.created_at desc
        ) filter (where b.slug is not null),
        '[]'::jsonb
      ) as stores,
      ph.source as last_history_source,
      ph.created_at as last_history_at
    from user_plans up
    left join briefs b on b.clerk_user_id = up.clerk_user_id
    left join lateral (
      select source, created_at
      from plan_history
      where clerk_user_id = up.clerk_user_id
      order by created_at desc
      limit 1
    ) ph on true
    where up.plan <> 'free'
       or up.meta ? 'skipcashPaymentId'
       or up.meta ? 'skipcashPendingPlan'
       or up.meta ? 'paypalSubscriptionId'
       or up.meta ? 'paypalPendingPlan'
    group by up.clerk_user_id, up.plan, up.meta, up.updated_at, ph.source, ph.created_at
    order by
      case when up.plan <> 'free' then 0 else 1 end,
      up.updated_at desc
    limit ${Math.min(Math.max(limit, 1), 500)}
  `) as unknown as SubscriberRow[];

  return rows.map((row) => {
    const meta = metaRecord(row.meta);
    const plan = isPlan(row.plan) ? row.plan : 'free';
    const provider =
      metaString(meta, 'provider') ??
      (metaString(meta, 'skipcashPaymentId', 'paymentId') ? 'skipcash' : null) ??
      (metaString(meta, 'paypalSubscriptionId') ? 'paypal' : null);
    const kind = classifySubscriber(plan, meta);
    const paymentId = metaString(
      meta,
      'skipcashPaymentId',
      'paymentId',
      'paypalSubscriptionId',
      'subscriptionId',
    );
    const currentPeriodEnd = metaString(meta, 'currentPeriodEnd', 'current_period_end');

    return {
      clerkUserId: row.clerk_user_id,
      email: row.contact_email,
      plan,
      planLabel: PLAN_LIMITS[plan].label,
      kind,
      provider,
      paymentStatus: metaString(meta, 'status', 'skipcashStatus'),
      cycle: metaString(meta, 'cycle', 'skipcashPendingCycle', 'paypalPendingCycle'),
      source: metaString(meta, 'source'),
      paymentId,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : null,
      updatedAt: new Date(row.updated_at),
      lastHistorySource: row.last_history_source,
      lastHistoryAt: row.last_history_at ? new Date(row.last_history_at) : null,
      storefrontCount: Number(row.storefront_count) || 0,
      stores: toStores(row.stores),
    };
  });
}
