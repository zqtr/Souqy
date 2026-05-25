import { unstable_noStore as noStore } from 'next/cache';
import { db } from './db';

/**
 * Customer = anyone who has talked to a storefront — placed an order,
 * sent an inquiry, or been added manually by the founder. The same
 * person at two different storefronts is two distinct rows because
 * tags / order count / spend are per-store, not per-person.
 *
 * The `identifier` column is the canonical handle. On insert we lower-
 * case the email (or fall back to a normalised phone, then a generated
 * `manual:<id>` string for hand-keyed entries). It's surfaced to the UI
 * only as a debug aid; the dashboard always renders `firstName / lastName
 * / email / phone` directly.
 */
export type CustomerStatus = 'active' | 'declined_marketing' | 'archived';

export type Customer = {
  id: number;
  storefrontSlug: string;
  identifier: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  tags: string[];
  marketingConsent: boolean;
  totalSpent: number;
  orderCount: number;
  inquiryCount: number;
  lastSeenAt: Date | null;
  meta: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

type CustomerRow = {
  id: number;
  storefront_slug: string;
  identifier: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  tags: string[];
  marketing_consent: boolean;
  total_spent: string;
  order_count: number;
  inquiry_count: number;
  last_seen_at: string | null;
  meta: unknown;
  created_at: string;
  updated_at: string;
};

function fromRow(r: CustomerRow): Customer {
  return {
    id: r.id,
    storefrontSlug: r.storefront_slug,
    identifier: r.identifier,
    email: r.email,
    phone: r.phone,
    firstName: r.first_name,
    lastName: r.last_name,
    tags: Array.isArray(r.tags) ? r.tags : [],
    marketingConsent: r.marketing_consent,
    totalSpent: Number(r.total_spent),
    orderCount: r.order_count,
    inquiryCount: r.inquiry_count,
    lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at) : null,
    meta: (r.meta as Record<string, unknown>) ?? {},
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

/**
 * Normalise a contact handle into a stable lookup key. Lowercase emails;
 * digits-only for phones (so `+974 5555` and `00974-5555` collide). Falls
 * back to a manual marker when both are blank.
 */
export function normalizeIdentifier(input: {
  email?: string | null;
  phone?: string | null;
  manualLabel?: string | null;
}): string {
  const e = input.email?.trim().toLowerCase();
  if (e) return `email:${e}`;
  const p = input.phone?.replace(/[^\d+]/g, '');
  if (p) return `phone:${p}`;
  return `manual:${(input.manualLabel ?? 'unknown').trim().toLowerCase().replace(/\s+/g, '_')}`;
}

export type CustomersListOptions = {
  query?: string;
  limit?: number;
  offset?: number;
};

export async function listCustomers(
  storefrontSlug: string,
  opts: CustomersListOptions = {},
): Promise<Customer[]> {
  noStore();
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const q = opts.query?.trim().toLowerCase() ?? '';
  if (q) {
    const like = `%${q}%`;
    const rows = (await db()`
      select * from customers
      where storefront_slug = ${storefrontSlug}
        and (
          lower(coalesce(email, '')) like ${like}
          or coalesce(phone, '') like ${like}
          or lower(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) like ${like}
        )
      order by created_at desc
      limit ${limit} offset ${offset}
    `) as unknown as CustomerRow[];
    return rows.map(fromRow);
  }
  const rows = (await db()`
    select * from customers
    where storefront_slug = ${storefrontSlug}
    order by created_at desc
    limit ${limit} offset ${offset}
  `) as unknown as CustomerRow[];
  return rows.map(fromRow);
}

export async function getCustomer(
  storefrontSlug: string,
  id: number,
): Promise<Customer | null> {
  noStore();
  const rows = (await db()`
    select * from customers
    where storefront_slug = ${storefrontSlug} and id = ${id}
    limit 1
  `) as unknown as CustomerRow[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function countCustomers(storefrontSlug: string): Promise<number> {
  noStore();
  const rows = (await db()`
    select count(*)::int as n from customers
    where storefront_slug = ${storefrontSlug}
  `) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}

export type CustomerWriteInput = {
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  tags: string[];
  marketingConsent: boolean;
  meta?: Record<string, unknown>;
};

/**
 * Insert-or-fetch by identifier. Used by the inquiry / order write paths
 * so a fresh inquirer auto-becomes a customer record without the founder
 * having to add them by hand. Idempotent on the unique
 * (storefront_slug, identifier) pair: a second call with the same email
 * updates first/last name + marketing consent and returns the same row.
 */
export async function upsertCustomer(
  storefrontSlug: string,
  input: CustomerWriteInput,
): Promise<Customer> {
  const identifier = normalizeIdentifier(input);
  const meta = JSON.stringify(input.meta ?? {});
  const rows = (await db()`
    insert into customers (
      storefront_slug, identifier, email, phone,
      first_name, last_name, tags, marketing_consent, meta
    ) values (
      ${storefrontSlug}, ${identifier}, ${input.email}, ${input.phone},
      ${input.firstName}, ${input.lastName}, ${input.tags as unknown as string},
      ${input.marketingConsent}, ${meta}::jsonb
    )
    on conflict (storefront_slug, identifier) do update set
      email             = coalesce(excluded.email, customers.email),
      phone             = coalesce(excluded.phone, customers.phone),
      first_name        = coalesce(excluded.first_name, customers.first_name),
      last_name         = coalesce(excluded.last_name, customers.last_name),
      tags              = (
        select array(select distinct unnest(customers.tags || excluded.tags))
      ),
      marketing_consent = customers.marketing_consent or excluded.marketing_consent,
      last_seen_at      = now(),
      updated_at        = now()
    returning *
  `) as unknown as CustomerRow[];
  if (!rows[0]) throw new Error('upsert customer failed');
  return fromRow(rows[0]);
}

export async function deleteCustomer(
  storefrontSlug: string,
  id: number,
): Promise<boolean> {
  const rows = (await db()`
    delete from customers
    where storefront_slug = ${storefrontSlug} and id = ${id}
    returning id
  `) as unknown as { id: number }[];
  return rows.length > 0;
}

export async function bumpCustomerInquiry(
  storefrontSlug: string,
  customerId: number,
): Promise<void> {
  await db()`
    update customers set
      inquiry_count = inquiry_count + 1,
      last_seen_at  = now(),
      updated_at    = now()
    where storefront_slug = ${storefrontSlug} and id = ${customerId}
  `;
}

export async function bumpCustomerOrder(
  storefrontSlug: string,
  customerId: number,
  totalDelta: number,
): Promise<void> {
  await db()`
    update customers set
      order_count = order_count + 1,
      total_spent = total_spent + ${totalDelta},
      last_seen_at = now(),
      updated_at  = now()
    where storefront_slug = ${storefrontSlug} and id = ${customerId}
  `;
}
