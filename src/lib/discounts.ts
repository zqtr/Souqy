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

export type CheckoutDiscountLine = {
  productId: string;
  lineTotalQar: number;
  categoryIds?: string[];
};

export type CheckoutDiscountEvaluation =
  | {
      status: 'success';
      discount: Discount;
      subtotalDiscountQar: number;
      shippingDiscountQar: number;
      totalDiscountQar: number;
    }
  | {
      status: 'error';
      message: string;
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
  const normalizedCode = normalizeDiscountCode(code);
  const rows = (await db()`
    select * from discounts
    where storefront_slug = ${storefrontSlug}
      and upper(code) = ${normalizedCode}
      and status = 'active'
    limit 1
  `) as unknown as DiscountRow[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export function normalizeDiscountCode(code: string): string {
  return code.trim().toUpperCase();
}

export function evaluateCheckoutDiscount({
  discount,
  subtotalQar,
  shippingQar,
  lines,
  now = new Date(),
}: {
  discount: Discount;
  subtotalQar: number;
  shippingQar: number;
  lines: CheckoutDiscountLine[];
  now?: Date;
}): CheckoutDiscountEvaluation {
  if (discount.kind !== 'code') {
    return { status: 'error', message: 'This code is not available at checkout.' };
  }
  if (discount.status !== 'active') {
    return { status: 'error', message: 'This code is not active.' };
  }
  if (discount.startsAt && discount.startsAt.getTime() > now.getTime()) {
    return { status: 'error', message: 'This code is not active yet.' };
  }
  if (discount.endsAt && discount.endsAt.getTime() < now.getTime()) {
    return { status: 'error', message: 'This code has expired.' };
  }
  if (discount.usageLimit !== null && discount.usedCount >= discount.usageLimit) {
    return { status: 'error', message: 'This code has reached its usage limit.' };
  }
  if (discount.minimumSubtotal !== null && subtotalQar < discount.minimumSubtotal) {
    return {
      status: 'error',
      message: `Minimum order for this code is QAR ${Math.round(discount.minimumSubtotal)}.`,
    };
  }

  const eligibleSubtotalQar = eligibleSubtotalForDiscount(discount, lines);
  if (discount.valueType !== 'free_shipping' && eligibleSubtotalQar <= 0) {
    return { status: 'error', message: 'This code does not apply to these items.' };
  }

  const subtotalDiscountQar =
    discount.valueType === 'percentage'
      ? Math.min(eligibleSubtotalQar, Math.round((eligibleSubtotalQar * discount.value) / 100))
      : discount.valueType === 'fixed_amount'
        ? Math.min(eligibleSubtotalQar, Math.round(discount.value))
        : 0;
  const shippingDiscountQar =
    discount.valueType === 'free_shipping' ? Math.max(0, Math.round(shippingQar)) : 0;
  const totalDiscountQar = subtotalDiscountQar + shippingDiscountQar;

  if (totalDiscountQar <= 0) {
    return { status: 'error', message: 'This code does not change this order.' };
  }

  return {
    status: 'success',
    discount,
    subtotalDiscountQar,
    shippingDiscountQar,
    totalDiscountQar,
  };
}

export async function claimDiscountUse(
  storefrontSlug: string,
  discountId: number,
): Promise<boolean> {
  const rows = (await db()`
    update discounts
    set used_count = used_count + 1,
        updated_at = now()
    where storefront_slug = ${storefrontSlug}
      and id = ${discountId}
      and status = 'active'
      and (usage_limit is null or used_count < usage_limit)
    returning id
  `) as unknown as { id: number }[];
  return rows.length > 0;
}

export async function releaseDiscountUse(
  storefrontSlug: string,
  discountId: number,
): Promise<void> {
  await db()`
    update discounts
    set used_count = greatest(used_count - 1, 0),
        updated_at = now()
    where storefront_slug = ${storefrontSlug}
      and id = ${discountId}
  `;
}

function eligibleSubtotalForDiscount(
  discount: Discount,
  lines: CheckoutDiscountLine[],
): number {
  if (discount.appliesTo === 'all') {
    return lines.reduce((sum, line) => sum + Math.max(0, Math.round(line.lineTotalQar)), 0);
  }

  if (discount.appliesToIds.length === 0) return 0;
  const allowed = new Set(discount.appliesToIds);

  return lines.reduce((sum, line) => {
    if (discount.appliesTo === 'products' && allowed.has(line.productId)) {
      return sum + Math.max(0, Math.round(line.lineTotalQar));
    }
    if (
      discount.appliesTo === 'categories' &&
      (line.categoryIds ?? []).some((categoryId) => allowed.has(categoryId))
    ) {
      return sum + Math.max(0, Math.round(line.lineTotalQar));
    }
    return sum;
  }, 0);
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
