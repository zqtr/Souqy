import { unstable_noStore as noStore } from 'next/cache';
import { db } from './db';

/**
 * Analytics event log. Aggregations live in this module so that the
 * UI never has to write a `select count(*) from analytics_events` by
 * hand. Adding a new chart usually means adding a function here.
 *
 * The event kinds are intentionally loose strings — plugins can emit
 * `kind = 'app_event'` with their own payload in `meta` and we still
 * roll them up into the event volume sparkline.
 */
export type AnalyticsEventKind =
  | 'page_view'
  | 'product_view'
  | 'inquire_open'
  | 'inquire_submit'
  | 'cart_add'
  | 'cart_remove'
  | 'order_placed'
  | 'discount_applied'
  | 'app_event';

export type AnalyticsEventInput = {
  storefrontSlug: string;
  kind: AnalyticsEventKind | string;
  visitorId?: string | null;
  sessionId?: string | null;
  productId?: string | null;
  referrerHost?: string | null;
  meta?: Record<string, unknown>;
};

export async function recordEvent(input: AnalyticsEventInput): Promise<void> {
  await db()`
    insert into analytics_events (
      storefront_slug, kind, visitor_id, session_id,
      product_id, referrer_host, meta
    ) values (
      ${input.storefrontSlug}, ${input.kind},
      ${input.visitorId ?? null}, ${input.sessionId ?? null},
      ${input.productId ?? null}, ${input.referrerHost ?? null},
      ${JSON.stringify(input.meta ?? {})}::jsonb
    )
  `;
}

export type DailyMetric = { day: string; n: number };

/**
 * Per-day event counts in the requested window. Used by the line
 * sparklines on Home and Analytics. Days with zero events are NOT
 * back-filled — the chart code interpolates so the X axis stays dense.
 */
export async function dailyEventCounts(
  storefrontSlug: string,
  kind: string,
  sinceDays: number,
): Promise<DailyMetric[]> {
  noStore();
  const rows = (await db()`
    select to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') as day,
           count(*)::int as n
    from analytics_events
    where storefront_slug = ${storefrontSlug}
      and kind = ${kind}
      and occurred_at >= now() - (${sinceDays}::int * interval '1 day')
    group by 1
    order by 1
  `) as unknown as { day: string; n: number }[];
  return rows;
}

export async function eventCountSince(
  storefrontSlug: string,
  kind: string,
  sinceDays: number,
): Promise<number> {
  noStore();
  const rows = (await db()`
    select count(*)::int as n from analytics_events
    where storefront_slug = ${storefrontSlug}
      and kind = ${kind}
      and occurred_at >= now() - (${sinceDays}::int * interval '1 day')
  `) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}

export async function uniqueVisitorsSince(
  storefrontSlug: string,
  sinceDays: number,
): Promise<number> {
  noStore();
  const rows = (await db()`
    select count(distinct visitor_id)::int as n
    from analytics_events
    where storefront_slug = ${storefrontSlug}
      and visitor_id is not null
      and occurred_at >= now() - (${sinceDays}::int * interval '1 day')
  `) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}

export type TopProduct = { productId: string; title: string | null; views: number };

export async function topProductsSince(
  storefrontSlug: string,
  sinceDays: number,
  limit = 5,
): Promise<TopProduct[]> {
  noStore();
  const rows = (await db()`
    select
      e.product_id as "productId",
      max(p.title) as title,
      count(*)::int as views
    from analytics_events e
    left join products p
      on p.id::text = e.product_id
      and p.storefront_slug = e.storefront_slug
    where e.storefront_slug = ${storefrontSlug}
      and e.kind = 'product_view'
      and e.product_id is not null
      and e.occurred_at >= now() - (${sinceDays}::int * interval '1 day')
    group by e.product_id
    order by views desc
    limit ${limit}
  `) as unknown as TopProduct[];
  return rows;
}

/**
 * Per-day distinct visitor count across the requested window, returned
 * as a `sinceDays`-length zero-filled array (one entry per day, oldest
 * first). Drives the dashboard home revenue sparkline.
 *
 * Filled-and-aligned shape (vs. `dailyEventCounts` which omits empty
 * days) so the chart code stays branch-free: a flat-zero baseline reads
 * better than an interpolated jump across missing days.
 */
export async function dailyVisitorsSince(
  storefrontSlug: string,
  sinceDays: number,
): Promise<number[]> {
  noStore();
  const rows = (await db()`
    select to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') as day,
           count(distinct visitor_id)::int as n
    from analytics_events
    where storefront_slug = ${storefrontSlug}
      and visitor_id is not null
      and occurred_at >= now() - (${sinceDays}::int * interval '1 day')
    group by 1
    order by 1
  `) as unknown as { day: string; n: number }[];
  return fillDailySeries(rows, sinceDays);
}

/**
 * Per-day order count across the requested window. Drives the
 * dashboard home orders bar chart. Cancelled orders are excluded so
 * the trend reflects realised revenue intent, not all submissions.
 */
export async function dailyOrdersSince(
  storefrontSlug: string,
  sinceDays: number,
): Promise<number[]> {
  noStore();
  const rows = (await db()`
    select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
           count(*)::int as n
    from checkout_orders
    where storefront_slug = ${storefrontSlug}
      and created_at >= now() - (${sinceDays}::int * interval '1 day')
      and order_status <> 'cancelled'
    group by 1
    order by 1
  `) as unknown as { day: string; n: number }[];
  return fillDailySeries(rows, sinceDays);
}

function fillDailySeries(
  rows: { day: string; n: number }[],
  sinceDays: number,
): number[] {
  const byDay = new Map(rows.map((r) => [r.day, r.n] as const));
  const out = new Array(sinceDays).fill(0);
  const today = new Date();
  for (let i = 0; i < sinceDays; i++) {
    const d = new Date(today);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - (sinceDays - 1 - i));
    const key = d.toISOString().slice(0, 10);
    out[i] = byDay.get(key) ?? 0;
  }
  return out;
}

export type TopReferrer = { host: string; count: number };
export type BreakdownRow = { label: string; count: number };

export async function topReferrersSince(
  storefrontSlug: string,
  sinceDays: number,
  limit = 5,
): Promise<TopReferrer[]> {
  noStore();
  const rows = (await db()`
    select coalesce(referrer_host, 'direct') as host, count(*)::int as count
    from analytics_events
    where storefront_slug = ${storefrontSlug}
      and kind = 'page_view'
      and occurred_at >= now() - (${sinceDays}::int * interval '1 day')
    group by 1
    order by count desc
    limit ${limit}
  `) as unknown as TopReferrer[];
  return rows;
}

export async function funnelCountsSince(
  storefrontSlug: string,
  sinceDays: number,
): Promise<Record<'pageViews' | 'productViews' | 'cartAdds' | 'orders' | 'inquiries', number>> {
  noStore();
  const rows = (await db()`
    select
      count(*) filter (where kind = 'page_view')::int as page_views,
      count(*) filter (where kind = 'product_view')::int as product_views,
      count(*) filter (where kind = 'cart_add')::int as cart_adds,
      count(*) filter (where kind = 'order_placed')::int as orders,
      count(*) filter (where kind = 'inquire_submit')::int as inquiries
    from analytics_events
    where storefront_slug = ${storefrontSlug}
      and occurred_at >= now() - (${sinceDays}::int * interval '1 day')
  `) as unknown as {
    page_views: number;
    product_views: number;
    cart_adds: number;
    orders: number;
    inquiries: number;
  }[];
  const row = rows[0];
  return {
    pageViews: row?.page_views ?? 0,
    productViews: row?.product_views ?? 0,
    cartAdds: row?.cart_adds ?? 0,
    orders: row?.orders ?? 0,
    inquiries: row?.inquiries ?? 0,
  };
}

export async function analyticsBreakdownSince(
  storefrontSlug: string,
  field: 'device' | 'browser' | 'language' | 'screen' | 'country',
  sinceDays: number,
  limit = 6,
): Promise<BreakdownRow[]> {
  noStore();
  const expression = breakdownExpression(field);
  const rows = (await db()`
    select ${expression} as label, count(*)::int as count
    from analytics_events
    where storefront_slug = ${storefrontSlug}
      and kind = 'page_view'
      and occurred_at >= now() - (${sinceDays}::int * interval '1 day')
    group by 1
    order by count desc
    limit ${limit}
  `) as unknown as BreakdownRow[];
  return rows;
}

function breakdownExpression(field: 'device' | 'browser' | 'language' | 'screen' | 'country') {
  switch (field) {
    case 'device':
      return db()`
        case
          when coalesce(meta->>'ua', '') ~* 'ipad|tablet' then 'Tablet'
          when coalesce(meta->>'ua', '') ~* 'mobile|iphone|android' then 'Mobile'
          else 'Desktop'
        end
      `;
    case 'browser':
      return db()`
        case
          when coalesce(meta->>'ua', '') ~* 'edg/' then 'Edge'
          when coalesce(meta->>'ua', '') ~* 'chrome|crios' and coalesce(meta->>'ua', '') !~* 'edg/' then 'Chrome'
          when coalesce(meta->>'ua', '') ~* 'safari' and coalesce(meta->>'ua', '') !~* 'chrome|crios' then 'Safari'
          when coalesce(meta->>'ua', '') ~* 'firefox|fxios' then 'Firefox'
          else 'Other'
        end
      `;
    case 'language':
      return db()`coalesce(nullif(split_part(meta->>'lang', '-', 1), ''), 'unknown')`;
    case 'screen':
      return db()`
        case
          when split_part(coalesce(meta->>'screen', ''), 'x', 1) !~ '^[0-9]+$' then 'unknown'
          when split_part(coalesce(meta->>'screen', ''), 'x', 1)::int < 640 then '<640'
          when split_part(coalesce(meta->>'screen', ''), 'x', 1)::int < 1024 then '640-1023'
          when split_part(coalesce(meta->>'screen', ''), 'x', 1)::int < 1440 then '1024-1439'
          when split_part(coalesce(meta->>'screen', ''), 'x', 1)::int >= 1440 then '1440+'
          else 'unknown'
        end
      `;
    case 'country':
      return db()`coalesce(nullif(meta->>'country', ''), 'unknown')`;
  }
}
