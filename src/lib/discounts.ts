import { unstable_noStore as noStore } from 'next/cache';
import { db } from './db';

export type DiscountKind = 'code' | 'automatic';
export type DiscountValueType = 'percentage' | 'fixed_amount' | 'free_shipping';
export type DiscountAppliesTo = 'all' | 'products' | 'categories';
export type DiscountStatus = 'active' | 'scheduled' | 'expired' | 'disabled';

export type Discount = {
  id: number;
  storefrontSlug: string;
  kind: DiscountKind;
  code: string;
  title: string | null;
  valueType: DiscountValueType;
  value: number;
  appliesTo: DiscountAppliesTo;
  appliesToIds: string[];
  minimumSubtotal: number | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usedCount: number;
  status: DiscountStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  meta: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

type DiscountRow = {
  id: number;
  storefront_slug: string;
  kind: DiscountKind;
  code: string;
  title: string | null;
  value_type: DiscountValueType;
  value: string;
  applies_to: DiscountAppliesTo;
  applies_to_ids: string[];
  minimum_subtotal: string | null;
  usage_limit: number | null;
  per_customer_limit: number | null;
  used_count: number;
  status: DiscountStatus;
  starts_at: string | null;
  ends_at: string | null;
  meta: unknown;
  created_at: string;
  updated_at: string;
};

function fromRow(r: DiscountRow): Discount {
  return {
    id: r.id,
    storefrontSlug: r.storefront_slug,
    kind: r.kind,
    code: r.code,
    title: r.title,
    valueType: r.value_type,
    value: Number(r.value),
    appliesTo: r.applies_to,
    appliesToIds: Array.isArray(r.applies_to_ids) ? r.applies_to_ids : [],
    minimumSubtotal: r.minimum_subtotal !== null ? Number(r.minimum_subtotal) : null,
    usageLimit: r.usage_limit,
    perCustomerLimit: r.per_customer_limit,
    usedCount: r.used_count,
    status: r.status,
    startsAt: r.starts_at ? new Date(r.starts_at) : null,
    endsAt: r.ends_at ? new Date(r.ends_at) : null,
    meta:
      r.meta && typeof r.meta === 'object'
        ? (r.meta as Record<string, unknown>)
        : {},
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

export async function listDiscounts(
  storefrontSlug: string,
  opts: { status?: DiscountStatus | 'all'; limit?: number } = {},
): Promise<Discount[]> {
  noStore();
  const limit = Math.min(opts.limit ?? 100, 200);
  const status = opts.status ?? 'all';
  const rows =
    status === 'all'
      ? ((await db()`
          select * from discounts
          where storefront_slug = ${storefrontSlug}
          order by created_at desc
          limit ${limit}
        `) as unknown as DiscountRow[])
      : ((await db()`
          select * from discounts
          where storefront_slug = ${storefrontSlug} and status = ${status}
          order by created_at desc
          limit ${limit}
        `) as unknown as DiscountRow[]);
  return rows.map(fromRow);
}

export async function getDiscount(
  storefrontSlug: string,
  id: number,
): Promise<Discount | null> {
  noStore();
  const rows = (await db()`
    select * from discounts
    where storefront_slug = ${storefrontSlug} and id = ${id}
    limit 1
  `) as unknown as DiscountRow[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function getDiscountByCode(
  storefrontSlug: string,
  code: string,
): Promise<Discount | null> {
  noStore();
  const rows = (await db()`
    select * from discounts
    where storefront_slug = ${storefrontSlug}
      and code = ${code}
      and status = 'active'
    limit 1
  `) as unknown as DiscountRow[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function countDiscounts(
  storefrontSlug: string,
  status?: DiscountStatus,
): Promise<number> {
  noStore();
  if (status) {
    const rows = (await db()`
      select count(*)::int as n from discounts
      where storefront_slug = ${storefrontSlug} and status = ${status}
    `) as unknown as { n: number }[];
    return rows[0]?.n ?? 0;
  }
  const rows = (await db()`
    select count(*)::int as n from discounts
    where storefront_slug = ${storefrontSlug}
  `) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}

export type DiscountWriteInput = {
  kind: DiscountKind;
  code: string;
  title: string | null;
  valueType: DiscountValueType;
  value: number;
  appliesTo: DiscountAppliesTo;
  appliesToIds: string[];
  minimumSubtotal: number | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  status: DiscountStatus;
  startsAt: Date | null;
  endsAt: Date | null;
};

export async function createDiscount(
  storefrontSlug: string,
  input: DiscountWriteInput,
): Promise<Discount> {
  const rows = (await db()`
    insert into discounts (
      storefront_slug, kind, code, title, value_type, value,
      applies_to, applies_to_ids, minimum_subtotal,
      usage_limit, per_customer_limit, status, starts_at, ends_at
    ) values (
      ${storefrontSlug}, ${input.kind}, ${input.code}, ${input.title},
      ${input.valueType}, ${input.value}, ${input.appliesTo},
      ${input.appliesToIds as unknown as string},
      ${input.minimumSubtotal}, ${input.usageLimit}, ${input.perCustomerLimit},
      ${input.status},
      ${input.startsAt ? input.startsAt.toISOString() : null},
      ${input.endsAt ? input.endsAt.toISOString() : null}
    )
    returning *
  `) as unknown as DiscountRow[];
  if (!rows[0]) throw new Error('insert discount failed');
  return fromRow(rows[0]);
}

export async function updateDiscount(
  storefrontSlug: string,
  id: number,
  input: DiscountWriteInput,
): Promise<Discount | null> {
  const rows = (await db()`
    update discounts set
      kind                = ${input.kind},
      code                = ${input.code},
      title               = ${input.title},
      value_type          = ${input.valueType},
      value               = ${input.value},
      applies_to          = ${input.appliesTo},
      applies_to_ids      = ${input.appliesToIds as unknown as string},
      minimum_subtotal    = ${input.minimumSubtotal},
      usage_limit         = ${input.usageLimit},
      per_customer_limit  = ${input.perCustomerLimit},
      status              = ${input.status},
      starts_at           = ${input.startsAt ? input.startsAt.toISOString() : null},
      ends_at             = ${input.endsAt ? input.endsAt.toISOString() : null},
      updated_at          = now()
    where storefront_slug = ${storefrontSlug} and id = ${id}
    returning *
  `) as unknown as DiscountRow[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function deleteDiscount(
  storefrontSlug: string,
  id: number,
): Promise<boolean> {
  const rows = (await db()`
    delete from discounts
    where storefront_slug = ${storefrontSlug} and id = ${id}
    returning id
  `) as unknown as { id: number }[];
  return rows.length > 0;
}
