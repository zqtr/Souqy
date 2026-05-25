import { z } from 'zod';
import { db } from '@/lib/db';
import { uniqueVisitorsSince } from '@/lib/analytics';
import { countCustomers } from '@/lib/customers';
import { countInquiries } from '@/lib/inquiries';
import { countDiscounts } from '@/lib/discounts';
import { getAllProducts } from '@/lib/products';
import { listInstalledApps } from '@/lib/apps/installed';
import { APP_REGISTRY } from '@/lib/apps/registry';
import { getRegister } from '@/lib/pos';
import { getUnreadCount } from '@/lib/notifications';
import {
  mobileError,
  mobileJson,
  mobileOptions,
  requireMobileStoreAccess,
  searchParam,
} from '@/lib/mobile/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(): Response {
  return mobileOptions();
}

const QuerySchema = z.object({
  store: z.string().trim().min(1),
});

export async function GET(req: Request): Promise<Response> {
  const parsed = QuerySchema.safeParse({ store: searchParam(req, 'store') });
  if (!parsed.success) {
    return mobileError(400, 'missing_store', 'Choose a storefront first.');
  }

  const gate = await requireMobileStoreAccess(parsed.data.store, 'analytics.view');
  if (!gate.ok) return gate.response;

  const slug = gate.access.storefront.slug;
  const [
    checkoutTotals,
    products,
    customers,
    marketingAudience,
    inquiryTotals,
    discounts,
    activeDiscounts,
    visitors30d,
    revenue30d,
    installedApps,
    posRegister,
    unreadNotifications,
    teamMembers,
    websites,
    pages,
    broadcasts,
  ] = await Promise.all([
    checkoutOrderTotals(slug),
    getAllProducts(slug),
    countCustomers(slug),
    countMarketingAudience(slug),
    inquiryCounts(slug),
    countDiscounts(slug),
    countDiscounts(slug, 'active'),
    uniqueVisitorsSince(slug, 30),
    sumCheckoutRevenueSince(slug, 30),
    listInstalledApps(slug),
    getRegister(slug),
    getUnreadCount(gate.user.userId),
    countTeamMembers(slug),
    countWebsites(gate.access.storefront.clerkUserId),
    countStorefrontPages(slug),
    countBroadcasts(slug),
  ]);

  const activeProducts = products.filter((product) => product.status === 'active').length;
  const draftProducts = products.filter((product) => product.status === 'draft').length;
  const soldOutProducts = products.filter((product) => product.status === 'sold_out').length;

  return mobileJson({
    store: {
      slug,
      businessName: gate.access.storefront.businessName,
      locale: gate.access.storefront.locale,
      isPublished: gate.access.storefront.isPublished,
    },
    sell: {
      orders: checkoutTotals,
      products: {
        total: products.length,
        active: activeProducts,
        draft: draftProducts,
        soldOut: soldOutProducts,
      },
      customers: { total: customers, marketingAudience },
      inquiries: inquiryTotals,
      pos: {
        configured: posRegister.configured,
        locationName: posRegister.locationName || null,
      },
    },
    grow: {
      analytics: {
        visitors30d,
        revenue30d,
        conversionRate30d:
          visitors30d > 0 ? Math.round((checkoutTotals.total / visitors30d) * 1000) / 10 : 0,
      },
      marketing: {
        audience: marketingAudience,
        broadcasts,
        availableChannels: ['email'],
      },
      discounts: { total: discounts, active: activeDiscounts },
      apps: {
        installed: installedApps.length,
        available: APP_REGISTRY.filter((app) => app.available).length,
        enabled: installedApps.filter((app) => app.enabled).length,
      },
    },
    more: {
      settingsSections: 18,
      teamMembers,
      websites,
      pages,
      unreadNotifications,
      billingPlan: 'account',
      customDomain: gate.access.storefront.customDomain,
    },
  });
}

async function checkoutOrderTotals(slug: string): Promise<{ total: number; pending: number }> {
  const rows = (await db()`
    select
      count(*)::int as total,
      count(*) filter (where order_status in ('pending', 'confirmed', 'preparing'))::int as pending
    from checkout_orders
    where storefront_slug = ${slug}
  `) as unknown as { total: number; pending: number }[];
  return { total: rows[0]?.total ?? 0, pending: rows[0]?.pending ?? 0 };
}

async function inquiryCounts(slug: string): Promise<{ total: number; open: number }> {
  const [total, open] = await Promise.all([
    countInquiries(slug),
    countInquiries(slug, 'new'),
  ]);
  return { total, open };
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

async function countMarketingAudience(slug: string): Promise<number> {
  const rows = (await db()`
    select count(*)::int as n
    from customers
    where storefront_slug = ${slug}
      and marketing_consent = true
      and coalesce(email, '') <> ''
  `) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}

async function countTeamMembers(slug: string): Promise<number> {
  const rows = (await db()`
    select count(*)::int as n
    from storefront_members
    where storefront_slug = ${slug}
  `) as unknown as { n: number }[];
  return (rows[0]?.n ?? 0) + 1;
}

async function countWebsites(ownerClerkUserId: string): Promise<number> {
  const rows = (await db()`
    select count(*)::int as n
    from briefs
    where clerk_user_id = ${ownerClerkUserId}
      and expires_at > now()
  `) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}

async function countStorefrontPages(slug: string): Promise<number> {
  const rows = (await db()`
    select count(*)::int as n
    from storefront_pages
    where storefront_slug = ${slug}
  `) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}

async function countBroadcasts(slug: string): Promise<number> {
  const rows = (await db()`
    select count(*)::int as n
    from audit_log
    where storefront_slug = ${slug}
      and action = 'marketing.broadcast'
  `) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}
