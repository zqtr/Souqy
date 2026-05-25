import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';
import {
  listOrdersForStorefront,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type OrderStatus,
  type PaymentStatus,
} from '@/lib/checkout-orders';
import { PageHeader, EmptyState } from '@/components/admin/primitives';
import { OrdersTable } from '@/components/admin/orders/OrdersTable';
import { RecentOrdersCard } from '@/components/admin/orders/RecentOrdersCard';
import { adminPhrase } from '@/components/admin/adminLocale';

const PAGE_SIZE = 50;

/**
 * Checkout-driven orders list. Replaces the legacy "log a manual sale"
 * page surface; the M3 cart + checkout flow now feeds into this view.
 *
 * URL search params drive every filter so links + browser back/fwd
 * Just Work:
 *  - `?status=pending|confirmed|...`
 *  - `?paymentStatus=unpaid|marked_paid|payment_failed|refunded`
 *  - `?page=N` (0-indexed)
 *  - `?store=<slug>` (carried through every internal nav)
 *
 * The legacy `/account/orders/new` and `/account/orders/[id]` routes
 * still work — they back the older manual-sale flow and stay untouched
 * here so we don't accidentally break dashboards mid-migration.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    store?: string | string[];
    status?: string | string[];
    paymentStatus?: string | string[];
    page?: string | string[];
  }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/orders');
  const locale = (await cookies()).get('NEXT_LOCALE')?.value;
  const t = (text: string) => adminPhrase(locale, text);

  const sp = (await searchParams) ?? {};
  const requested = pickFirst(sp.store);
  const storefronts = await getStorefrontsForUser(userId);
  if (storefronts.length === 0) {
    return (
      <>
        <PageHeader
          title={t('Orders')}
          subtitle={t('Set up a storefront to start receiving orders.')}
        />
        <EmptyState
          eyebrow={t('Get started')}
          title={t('Create your store first')}
          body={t("Souqna's order log is per-storefront. Once you create a store, your buyer-side checkout flows directly into here.")}
          action={{ label: t('Create your store'), href: '/begin' }}
        />
      </>
    );
  }
  const known = storefronts.map((s) => s.slug);
  const slug =
    requested && known.includes(requested) ? requested : storefronts[0]!.slug;

  const status = parseStatus(pickFirst(sp.status));
  const paymentStatus = parsePaymentStatus(pickFirst(sp.paymentStatus));
  const page = Math.max(0, Number(pickFirst(sp.page) ?? 0) | 0);
  const offset = page * PAGE_SIZE;

  const { orders, total } = await listOrdersForStorefront(slug, {
    status: status || undefined,
    paymentStatus: paymentStatus || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const business =
    storefronts.find((s) => s.slug === slug)?.businessName ?? slug;

  return (
    <>
      <PageHeader
        eyebrow={t('Orders')}
        title={t('Orders')}
        subtitle={
          locale === 'ar'
            ? `${total.toLocaleString('ar-QA')} طلب على ${business}.`
            : `${total} order${total === 1 ? '' : 's'} on ${business}.`
        }
        secondaryActions={[
          {
            label: t('Manual sale'),
            href: `/account/orders/new?store=${encodeURIComponent(slug)}`,
          },
        ]}
      />

      <RecentOrdersCard storeSlug={slug} orders={orders} />

      <OrdersTable
        storeSlug={slug}
        orders={orders}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        status={status}
        paymentStatus={paymentStatus}
      />
    </>
  );
}

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function parseStatus(v: string | undefined): OrderStatus | '' {
  if (!v) return '';
  return (ORDER_STATUSES as readonly string[]).includes(v) ? (v as OrderStatus) : '';
}
function parsePaymentStatus(v: string | undefined): PaymentStatus | '' {
  if (!v) return '';
  return (PAYMENT_STATUSES as readonly string[]).includes(v)
    ? (v as PaymentStatus)
    : '';
}
