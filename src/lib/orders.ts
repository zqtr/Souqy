import { unstable_noStore as noStore } from 'next/cache';
import { db } from './db';
import { dispatchAppEventDetached } from './apps/dispatch';

/**
 * Orders represent finalised purchases or manual draft orders the
 * founder logs from the dashboard. Souqna v1 deliberately does NOT
 * run a checkout — most Doha founders close on WhatsApp and then log
 * the sale here so analytics + customer history stay accurate.
 */
export type OrderStatus =
  | 'open'
  | 'draft'
  | 'paid'
  | 'partially_paid'
  | 'refunded'
  | 'partially_refunded'
  | 'cancelled'
  | 'archived';

export type FulfilmentStatus = 'unfulfilled' | 'partial' | 'fulfilled' | 'restocked';
export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'refunded'
  | 'voided'
  | 'failed';
export type OrderChannel = 'admin' | 'storefront' | 'inquiry' | 'import' | 'pos';

export type OrderItem = {
  id: number;
  orderId: number;
  productId: string | null;
  productTitle: string;
  variantLabel: string | null;
  unitPrice: number;
  quantity: number;
  total: number;
  meta: Record<string, unknown>;
};

export type Order = {
  id: number;
  storefrontSlug: string;
  customerId: number | null;
  orderNumber: number;
  status: OrderStatus;
  fulfilmentStatus: FulfilmentStatus;
  paymentStatus: PaymentStatus;
  currencyCode: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  shippingAddress: Record<string, unknown> | null;
  billingAddress: Record<string, unknown> | null;
  notes: string | null;
  channel: OrderChannel;
  discountCode: string | null;
  discountId: number | null;
  meta: Record<string, unknown>;
  placedAt: Date | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items?: OrderItem[];
};

type OrderRow = {
  id: number;
  storefront_slug: string;
  customer_id: number | null;
  order_number: number;
  status: OrderStatus;
  fulfilment_status: FulfilmentStatus;
  payment_status: PaymentStatus;
  currency_code: string;
  subtotal: string;
  discount_total: string;
  shipping_total: string;
  tax_total: string;
  total: string;
  shipping_address: unknown;
  billing_address: unknown;
  notes: string | null;
  channel: OrderChannel;
  discount_code: string | null;
  discount_id: number | null;
  meta: unknown;
  placed_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

function asJson(v: unknown): Record<string, unknown> | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function fromRow(r: OrderRow): Order {
  return {
    id: r.id,
    storefrontSlug: r.storefront_slug,
    customerId: r.customer_id,
    orderNumber: r.order_number,
    status: r.status,
    fulfilmentStatus: r.fulfilment_status,
    paymentStatus: r.payment_status,
    currencyCode: r.currency_code,
    subtotal: Number(r.subtotal),
    discountTotal: Number(r.discount_total),
    shippingTotal: Number(r.shipping_total),
    taxTotal: Number(r.tax_total),
    total: Number(r.total),
    shippingAddress: asJson(r.shipping_address),
    billingAddress: asJson(r.billing_address),
    notes: r.notes,
    channel: r.channel,
    discountCode: r.discount_code,
    discountId: r.discount_id,
    meta: asJson(r.meta) ?? {},
    placedAt: r.placed_at ? new Date(r.placed_at) : null,
    paidAt: r.paid_at ? new Date(r.paid_at) : null,
    cancelledAt: r.cancelled_at ? new Date(r.cancelled_at) : null,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

/**
 * Atomic per-storefront order number generator. Lives in app code so
 * the migration runner doesn't have to handle dollar-quoted plpgsql.
 *
 * Uses INSERT … ON CONFLICT DO UPDATE … RETURNING so the read-modify-
 * write happens in a single SQL round-trip — concurrent requests cannot
 * collide because the row-level lock is held for the entire statement.
 */
export async function nextOrderNumber(storefrontSlug: string): Promise<number> {
  const rows = (await db()`
    insert into order_number_counters (storefront_slug, next_value)
    values (${storefrontSlug}, 1002)
    on conflict (storefront_slug) do update
      set next_value = order_number_counters.next_value + 1
    returning next_value - 1 as assigned
  `) as unknown as { assigned: number }[];
  if (!rows[0]) throw new Error('order number generation failed');
  return rows[0].assigned;
}

export type OrdersListOptions = {
  status?: OrderStatus | 'all';
  limit?: number;
  offset?: number;
};

export async function listOrders(
  storefrontSlug: string,
  opts: OrdersListOptions = {},
): Promise<Order[]> {
  noStore();
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const status = opts.status ?? 'all';
  const rows =
    status === 'all'
      ? ((await db()`
          select * from orders
          where storefront_slug = ${storefrontSlug}
          order by created_at desc
          limit ${limit} offset ${offset}
        `) as unknown as OrderRow[])
      : ((await db()`
          select * from orders
          where storefront_slug = ${storefrontSlug} and status = ${status}
          order by created_at desc
          limit ${limit} offset ${offset}
        `) as unknown as OrderRow[]);
  return rows.map(fromRow);
}

export async function getOrder(
  storefrontSlug: string,
  id: number,
): Promise<Order | null> {
  noStore();
  const rows = (await db()`
    select * from orders
    where storefront_slug = ${storefrontSlug} and id = ${id}
    limit 1
  `) as unknown as OrderRow[];
  if (!rows[0]) return null;
  const order = fromRow(rows[0]);
  const items = (await db()`
    select * from order_items where order_id = ${id} order by id
  `) as unknown as Array<{
    id: number;
    order_id: number;
    product_id: string | null;
    product_title: string;
    variant_label: string | null;
    unit_price: string;
    quantity: number;
    total: string;
    meta: unknown;
  }>;
  order.items = items.map((it) => ({
    id: it.id,
    orderId: it.order_id,
    productId: it.product_id,
    productTitle: it.product_title,
    variantLabel: it.variant_label,
    unitPrice: Number(it.unit_price),
    quantity: it.quantity,
    total: Number(it.total),
    meta: asJson(it.meta) ?? {},
  }));
  return order;
}

export async function countOrders(
  storefrontSlug: string,
  status?: OrderStatus,
): Promise<number> {
  noStore();
  if (status) {
    const rows = (await db()`
      select count(*)::int as n from orders
      where storefront_slug = ${storefrontSlug} and status = ${status}
    `) as unknown as { n: number }[];
    return rows[0]?.n ?? 0;
  }
  const rows = (await db()`
    select count(*)::int as n from orders
    where storefront_slug = ${storefrontSlug}
  `) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}

export async function sumOrderRevenueSince(
  storefrontSlug: string,
  since: Date,
): Promise<number> {
  noStore();
  const rows = (await db()`
    select coalesce(sum(total), 0)::numeric as revenue
    from orders
    where storefront_slug = ${storefrontSlug}
      and created_at >= ${since.toISOString()}
      and status not in ('draft','cancelled','refunded')
  `) as unknown as { revenue: string }[];
  return Number(rows[0]?.revenue ?? 0);
}

export type OrderItemInput = {
  productId: string | null;
  productTitle: string;
  variantLabel: string | null;
  unitPrice: number;
  quantity: number;
};

export type OrderCreateInput = {
  customerId: number | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  currencyCode: string;
  items: OrderItemInput[];
  shippingTotal?: number;
  discountTotal?: number;
  discountCode?: string | null;
  taxTotal?: number;
  notes?: string | null;
  channel: OrderChannel;
};

export async function createOrder(
  storefrontSlug: string,
  input: OrderCreateInput,
): Promise<Order> {
  if (input.items.length === 0) {
    throw new Error('order requires at least one line item');
  }
  const subtotal = input.items.reduce(
    (acc, it) => acc + it.unitPrice * it.quantity,
    0,
  );
  const discount = input.discountTotal ?? 0;
  const shipping = input.shippingTotal ?? 0;
  const tax = input.taxTotal ?? 0;
  const total = Math.max(subtotal - discount + shipping + tax, 0);
  const orderNumber = await nextOrderNumber(storefrontSlug);
  const now = new Date().toISOString();

  const rows = (await db()`
    insert into orders (
      storefront_slug, customer_id, order_number,
      status, fulfilment_status, payment_status, currency_code,
      subtotal, discount_total, shipping_total, tax_total, total,
      notes, channel, discount_code, placed_at
    ) values (
      ${storefrontSlug}, ${input.customerId}, ${orderNumber},
      ${input.status}, ${input.fulfilmentStatus}, ${input.paymentStatus},
      ${input.currencyCode},
      ${subtotal}, ${discount}, ${shipping}, ${tax}, ${total},
      ${input.notes ?? null}, ${input.channel},
      ${input.discountCode ?? null},
      ${input.status === 'draft' ? null : now}
    )
    returning *
  `) as unknown as OrderRow[];
  if (!rows[0]) throw new Error('insert order failed');
  const order = fromRow(rows[0]);

  const persistedItems: OrderItem[] = [];
  for (const item of input.items) {
    const lineTotal = item.unitPrice * item.quantity;
    const rows2 = (await db()`
      insert into order_items (
        order_id, product_id, product_title, variant_label,
        unit_price, quantity, total
      ) values (
        ${order.id}, ${item.productId}, ${item.productTitle},
        ${item.variantLabel}, ${item.unitPrice}, ${item.quantity}, ${lineTotal}
      )
      returning id
    `) as unknown as { id: number }[];
    persistedItems.push({
      id: rows2[0]?.id ?? 0,
      orderId: order.id,
      productId: item.productId,
      productTitle: item.productTitle,
      variantLabel: item.variantLabel,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      total: lineTotal,
      meta: {},
    });
  }
  order.items = persistedItems;
  // Fan out to installed apps. Skip drafts — those are
  // founder-private placeholders that aren't real sales yet.
  if (order.status !== 'draft') {
    dispatchAppEventDetached({
      kind: 'order.created',
      storefrontSlug,
      order,
      items: persistedItems,
    });
  }
  return order;
}

export async function updateOrderStatus(
  storefrontSlug: string,
  id: number,
  status: OrderStatus,
): Promise<Order | null> {
  const rows = (await db()`
    update orders set
      status = ${status},
      cancelled_at = case when ${status} = 'cancelled' then now() else cancelled_at end,
      paid_at = case when ${status} in ('paid','partially_paid') and paid_at is null then now() else paid_at end,
      updated_at = now()
    where storefront_slug = ${storefrontSlug} and id = ${id}
    returning *
  `) as unknown as OrderRow[];
  return rows[0] ? fromRow(rows[0]) : null;
}
