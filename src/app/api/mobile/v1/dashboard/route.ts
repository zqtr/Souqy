import { z } from 'zod';
import { db } from '@/lib/db';
import { eventCountSince, uniqueVisitorsSince } from '@/lib/analytics';
import { recentActivity } from '@/lib/audit';
import { getProductsForUser } from '@/lib/products';
import { countCustomers } from '@/lib/customers';
import { countInquiries } from '@/lib/inquiries';
import { listInstalledApps } from '@/lib/apps/installed';
import { evaluateSetupCompletion } from '@/lib/accountSetupCompletion';
import {
  mobileJson,
  mobileOptions,
  requireMobileStoreAccess,
  searchParam,
} from '@/lib/mobile/auth';
import { getUnreadCount } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(): Response {
  return mobileOptions();
}

const WindowSchema = z.coerce.number().int().min(1).max(90).catch(7);

export async function GET(req: Request): Promise<Response> {
  const slug = searchParam(req, 'store');
  const gate = await requireMobileStoreAccess(slug, 'analytics.view');
  if (!gate.ok) return gate.response;

  const days = WindowSchema.parse(new URL(req.url).searchParams.get('days') ?? '7');
  const storefront = gate.access.storefront;

  const [
    revenue,
    orders,
    pageViews,
    visitors,
    products,
    customerCount,
    inquiryOpen,
    activity,
    installedApps,
    unread,
  ] = await Promise.all([
    sumCheckoutRevenueSince(storefront.slug, days),
    countCheckoutOrdersSince(storefront.slug, days),
    eventCountSince(storefront.slug, 'page_view', days),
    uniqueVisitorsSince(storefront.slug, days),
    getProductsForUser(storefront.clerkUserId),
    countCustomers(storefront.slug),
    countInquiries(storefront.slug, 'new'),
    recentActivity(storefront.slug, 12),
    listInstalledApps(storefront.slug),
    getUnreadCount(gate.user.userId),
  ]);

  const productsForStore = products.filter((p) => p.storefrontSlug === storefront.slug);
  const setup = evaluateSetupCompletion({
    storefront,
    productsCount: productsForStore.length,
    customerCount,
    installedAppIds: installedApps.map((app) => app.appId),
  });

  return mobileJson({
    store: {
      slug: storefront.slug,
      businessName: storefront.businessName,
      locale: storefront.locale,
      isPublished: storefront.isPublished,
    },
    windowDays: days,
    kpis: {
      revenueQar: revenue,
      orders,
      pageViews,
      visitors,
      conversionRate: visitors > 0 ? Math.round((orders / visitors) * 1000) / 10 : 0,
      customers: customerCount,
      openInquiries: inquiryOpen,
      unreadNotifications: unread,
    },
    setup: {
      completed: setup.tasks.filter((task) => task.done).length,
      total: setup.tasks.length,
      tasks: setup.tasks,
    },
    recentActivity: activity.map((entry) => ({
      id: entry.id,
      occurredAt: entry.occurredAt.toISOString(),
      action: entry.action,
      summary: entry.summary,
      targetId: entry.targetId,
      meta: entry.meta,
    })),
  });
}

async function sumCheckoutRevenueSince(slug: string, days: number): Promise<number> {
  const rows = (await db()`
    select coalesce(sum(total_qar), 0)::int as n
    from checkout_orders
    where storefront_slug = ${slug}
      and order_status not in ('cancelled')
      and payment_status <> 'refunded'
      and created_at >= now() - (${days}::int * interval '1 day')
  `) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}

async function countCheckoutOrdersSince(slug: string, days: number): Promise<number> {
  const rows = (await db()`
    select count(*)::int as n
    from checkout_orders
    where storefront_slug = ${slug}
      and created_at >= now() - (${days}::int * interval '1 day')
  `) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}
