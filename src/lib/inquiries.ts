import { unstable_noStore as noStore } from 'next/cache';
import { db } from './db';
import { upsertCustomer, bumpCustomerInquiry } from './customers';
import { dispatchAppEventDetached } from './apps/dispatch';

export type InquiryStatus = 'new' | 'responded' | 'closed' | 'spam';
export type PreferredChannel = 'whatsapp' | 'email' | 'phone' | 'any';

export type Inquiry = {
  id: number;
  storefrontSlug: string;
  customerId: number | null;
  productId: string | null;
  productTitle: string | null;
  message: string;
  visitorName: string | null;
  visitorEmail: string | null;
  visitorPhone: string | null;
  preferredChannel: PreferredChannel;
  status: InquiryStatus;
  sourceUrl: string | null;
  userAgent: string | null;
  meta: Record<string, unknown>;
  createdAt: Date;
  respondedAt: Date | null;
};

type InquiryRow = {
  id: number;
  storefront_slug: string;
  customer_id: number | null;
  product_id: string | null;
  product_title: string | null;
  message: string;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  preferred_channel: PreferredChannel;
  status: InquiryStatus;
  source_url: string | null;
  user_agent: string | null;
  meta: unknown;
  created_at: string;
  responded_at: string | null;
};

function fromRow(r: InquiryRow): Inquiry {
  return {
    id: r.id,
    storefrontSlug: r.storefront_slug,
    customerId: r.customer_id,
    productId: r.product_id,
    productTitle: r.product_title,
    message: r.message,
    visitorName: r.visitor_name,
    visitorEmail: r.visitor_email,
    visitorPhone: r.visitor_phone,
    preferredChannel: r.preferred_channel,
    status: r.status,
    sourceUrl: r.source_url,
    userAgent: r.user_agent,
    meta:
      r.meta && typeof r.meta === 'object'
        ? (r.meta as Record<string, unknown>)
        : {},
    createdAt: new Date(r.created_at),
    respondedAt: r.responded_at ? new Date(r.responded_at) : null,
  };
}

export type InquiriesListOptions = {
  status?: InquiryStatus | 'all';
  limit?: number;
  offset?: number;
};

export async function listInquiries(
  storefrontSlug: string,
  opts: InquiriesListOptions = {},
): Promise<Inquiry[]> {
  noStore();
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const status = opts.status ?? 'all';
  const rows =
    status === 'all'
      ? ((await db()`
          select * from inquiries
          where storefront_slug = ${storefrontSlug}
          order by created_at desc
          limit ${limit} offset ${offset}
        `) as unknown as InquiryRow[])
      : ((await db()`
          select * from inquiries
          where storefront_slug = ${storefrontSlug} and status = ${status}
          order by created_at desc
          limit ${limit} offset ${offset}
        `) as unknown as InquiryRow[]);
  return rows.map(fromRow);
}

export async function getInquiry(
  storefrontSlug: string,
  id: number,
): Promise<Inquiry | null> {
  noStore();
  const rows = (await db()`
    select * from inquiries
    where storefront_slug = ${storefrontSlug} and id = ${id}
    limit 1
  `) as unknown as InquiryRow[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function countInquiries(
  storefrontSlug: string,
  status?: InquiryStatus,
): Promise<number> {
  noStore();
  if (status) {
    const rows = (await db()`
      select count(*)::int as n from inquiries
      where storefront_slug = ${storefrontSlug} and status = ${status}
    `) as unknown as { n: number }[];
    return rows[0]?.n ?? 0;
  }
  const rows = (await db()`
    select count(*)::int as n from inquiries
    where storefront_slug = ${storefrontSlug}
  `) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}

export type InquiryCreateInput = {
  productId?: string | null;
  productTitle?: string | null;
  message: string;
  visitorName?: string | null;
  visitorEmail?: string | null;
  visitorPhone?: string | null;
  preferredChannel?: PreferredChannel;
  sourceUrl?: string | null;
  userAgent?: string | null;
  marketingConsent?: boolean;
  meta?: Record<string, unknown>;
};

/**
 * Submit an inquiry from the storefront. Side-effects:
 *  - creates / updates a customer row by email/phone
 *  - bumps that customer's inquiry counter
 *
 * The whole flow happens in two round-trips (upsert + insert + bump),
 * which is fine for the storefront-facing call where consistency
 * across the join isn't critical.
 */
export async function createInquiry(
  storefrontSlug: string,
  input: InquiryCreateInput,
): Promise<Inquiry> {
  let customerId: number | null = null;
  if (input.visitorEmail || input.visitorPhone || input.visitorName) {
    const cust = await upsertCustomer(storefrontSlug, {
      email: input.visitorEmail ?? null,
      phone: input.visitorPhone ?? null,
      firstName: input.visitorName ?? null,
      lastName: null,
      tags: ['inquiry'],
      marketingConsent: input.marketingConsent ?? false,
    });
    customerId = cust.id;
  }

  const rows = (await db()`
    insert into inquiries (
      storefront_slug, customer_id, product_id, product_title, message,
      visitor_name, visitor_email, visitor_phone, preferred_channel,
      source_url, user_agent, meta
    ) values (
      ${storefrontSlug}, ${customerId},
      ${input.productId ?? null}, ${input.productTitle ?? null},
      ${input.message},
      ${input.visitorName ?? null}, ${input.visitorEmail ?? null},
      ${input.visitorPhone ?? null}, ${input.preferredChannel ?? 'whatsapp'},
      ${input.sourceUrl ?? null}, ${input.userAgent ?? null},
      ${JSON.stringify(input.meta ?? {})}::jsonb
    )
    returning *
  `) as unknown as InquiryRow[];

  if (customerId !== null) {
    await bumpCustomerInquiry(storefrontSlug, customerId);
  }

  if (!rows[0]) throw new Error('insert inquiry failed');
  const inquiry = fromRow(rows[0]);
  // Fan out to installed apps (Zapier, Notion, Google Sheets, TikTok
  // server-side, HubSpot Forms). Detached so a slow Notion or a 503
  // from Zapier never delays the storefront response.
  dispatchAppEventDetached({
    kind: 'inquiry.created',
    storefrontSlug,
    inquiry,
  });
  return inquiry;
}

export async function updateInquiryStatus(
  storefrontSlug: string,
  id: number,
  status: InquiryStatus,
): Promise<Inquiry | null> {
  const rows = (await db()`
    update inquiries set
      status = ${status},
      responded_at = case
        when ${status} = 'responded' and responded_at is null then now()
        else responded_at end
    where storefront_slug = ${storefrontSlug} and id = ${id}
    returning *
  `) as unknown as InquiryRow[];
  return rows[0] ? fromRow(rows[0]) : null;
}
