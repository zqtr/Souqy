import 'server-only';

import { unstable_noStore as noStore } from 'next/cache';
import { db, hasDb } from './db';
import type { CollectionMode, Order } from './checkout-orders';

export type PlatformFeeEntry = {
  id: string;
  orderId: string;
  clerkUserId: string;
  storefrontSlug: string;
  planSnapshot: string;
  feeBps: number;
  grossQar: number;
  feeQar: number;
  collectionMode: CollectionMode;
  status: 'collected' | 'receivable' | 'waived';
  collectedAt: string | null;
  waivedAt: string | null;
  createdAt: string;
};

export type CheckoutPayout = {
  id: string;
  orderId: string;
  clerkUserId: string;
  storefrontSlug: string;
  grossQar: number;
  feeQar: number;
  netQar: number;
  status: 'pending' | 'paid' | 'cancelled';
  paidAt: string | null;
  paidBy: string | null;
  note: string | null;
  createdAt: string;
};

type OwnerRow = { clerk_user_id: string };

async function getOrderOwner(storefrontSlug: string): Promise<string | null> {
  const rows = (await db()`
    select clerk_user_id
    from briefs
    where slug = ${storefrontSlug}
    limit 1
  `) as unknown as OwnerRow[];
  return rows[0]?.clerk_user_id ?? null;
}

export async function recordPlatformFeeForPaidOrder(order: Order): Promise<void> {
  if (!hasDb()) return;
  if (order.paymentStatus !== 'marked_paid') return;

  const ownerId = await getOrderOwner(order.storefrontSlug);
  if (!ownerId) return;

  const feeStatus =
    order.platformFeeQar <= 0
      ? 'waived'
      : order.collectionMode === 'platform_skipcash'
        ? 'collected'
        : 'receivable';
  const collectedAt = feeStatus === 'collected' ? new Date() : null;

  if (order.platformFeeQar > 0) {
    await db()`
      insert into platform_fee_entries (
        order_id, clerk_user_id, storefront_slug, plan_snapshot,
        fee_bps, gross_qar, fee_qar, collection_mode, status, collected_at
      ) values (
        ${order.id}, ${ownerId}, ${order.storefrontSlug}, ${order.planSnapshot},
        ${order.platformFeeBps}, ${order.totalQar}, ${order.platformFeeQar},
        ${order.collectionMode}, ${feeStatus}, ${collectedAt}
      )
      on conflict (order_id) do update set
        status = case
          when platform_fee_entries.status = 'waived' then platform_fee_entries.status
          when platform_fee_entries.status = 'collected' then platform_fee_entries.status
          else excluded.status
        end,
        collected_at = coalesce(platform_fee_entries.collected_at, excluded.collected_at),
        updated_at = now()
    `;
  }

  if (order.collectionMode === 'platform_skipcash') {
    await db()`
      insert into checkout_payouts (
        order_id, clerk_user_id, storefront_slug,
        gross_qar, fee_qar, net_qar, status
      ) values (
        ${order.id}, ${ownerId}, ${order.storefrontSlug},
        ${order.totalQar}, ${order.platformFeeQar}, ${order.sellerNetQar}, 'pending'
      )
      on conflict (order_id) do nothing
    `;
  }

  await db()`
    update checkout_orders
    set
      platform_fee_status = case
        when platform_fee_status in ('collected', 'waived') then platform_fee_status
        else ${feeStatus}
      end,
      payout_status = case
        when ${order.collectionMode} <> 'platform_skipcash' then payout_status
        when payout_status in ('paid', 'cancelled') then payout_status
        else 'pending'
      end,
      updated_at = now()
    where id = ${order.id}
  `;
}

export async function listPlatformFinanceOverview(limit = 50): Promise<{
  payouts: CheckoutPayout[];
  fees: PlatformFeeEntry[];
}> {
  noStore();
  if (!hasDb()) return { payouts: [], fees: [] };

  let payoutRows: Array<{
    id: string;
    order_id: string;
    clerk_user_id: string;
    storefront_slug: string;
    gross_qar: number | string;
    fee_qar: number | string;
    net_qar: number | string;
    status: 'pending' | 'paid' | 'cancelled';
    paid_at: string | null;
    paid_by: string | null;
    note: string | null;
    created_at: string;
  }>;
  let feeRows: Array<{
    id: string;
    order_id: string;
    clerk_user_id: string;
    storefront_slug: string;
    plan_snapshot: string;
    fee_bps: number | string;
    gross_qar: number | string;
    fee_qar: number | string;
    collection_mode: CollectionMode;
    status: 'collected' | 'receivable' | 'waived';
    collected_at: string | null;
    waived_at: string | null;
    created_at: string;
  }>;

  try {
    payoutRows = (await db()`
      select *
      from checkout_payouts
      where status = 'pending'
      order by created_at asc
      limit ${Math.min(Math.max(limit, 1), 100)}
    `) as unknown as typeof payoutRows;

    feeRows = (await db()`
      select *
      from platform_fee_entries
      where status = 'receivable'
      order by created_at asc
      limit ${Math.min(Math.max(limit, 1), 100)}
    `) as unknown as typeof feeRows;
  } catch (err) {
    console.warn('[platformFees] finance overview unavailable', err);
    return { payouts: [], fees: [] };
  }

  return {
    payouts: payoutRows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      clerkUserId: row.clerk_user_id,
      storefrontSlug: row.storefront_slug,
      grossQar: Number(row.gross_qar),
      feeQar: Number(row.fee_qar),
      netQar: Number(row.net_qar),
      status: row.status,
      paidAt: row.paid_at,
      paidBy: row.paid_by,
      note: row.note,
      createdAt: row.created_at,
    })),
    fees: feeRows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      clerkUserId: row.clerk_user_id,
      storefrontSlug: row.storefront_slug,
      planSnapshot: row.plan_snapshot,
      feeBps: Number(row.fee_bps),
      grossQar: Number(row.gross_qar),
      feeQar: Number(row.fee_qar),
      collectionMode: row.collection_mode,
      status: row.status,
      collectedAt: row.collected_at,
      waivedAt: row.waived_at,
      createdAt: row.created_at,
    })),
  };
}

export async function markCheckoutPayoutPaid(
  payoutId: string,
  operatorUserId: string,
): Promise<boolean> {
  if (!hasDb()) return false;
  const rows = (await db()`
    update checkout_payouts
    set status = 'paid', paid_at = now(), paid_by = ${operatorUserId}, updated_at = now()
    where id = ${payoutId} and status = 'pending'
    returning order_id
  `) as unknown as { order_id: string }[];
  const orderId = rows[0]?.order_id;
  if (!orderId) return false;
  await db()`
    update checkout_orders
    set payout_status = 'paid', updated_at = now()
    where id = ${orderId}
  `;
  return true;
}

export async function markPlatformFeeCollected(feeId: string): Promise<boolean> {
  if (!hasDb()) return false;
  const rows = (await db()`
    update platform_fee_entries
    set status = 'collected', collected_at = now(), updated_at = now()
    where id = ${feeId} and status = 'receivable'
    returning order_id
  `) as unknown as { order_id: string }[];
  const orderId = rows[0]?.order_id;
  if (!orderId) return false;
  await db()`
    update checkout_orders
    set platform_fee_status = 'collected', updated_at = now()
    where id = ${orderId}
  `;
  return true;
}

export async function waivePlatformFee(feeId: string): Promise<boolean> {
  if (!hasDb()) return false;
  const rows = (await db()`
    update platform_fee_entries
    set status = 'waived', waived_at = now(), updated_at = now()
    where id = ${feeId} and status <> 'waived'
    returning order_id
  `) as unknown as { order_id: string }[];
  const orderId = rows[0]?.order_id;
  if (!orderId) return false;
  await db()`
    update checkout_orders
    set platform_fee_status = 'waived', updated_at = now()
    where id = ${orderId}
  `;
  return true;
}
