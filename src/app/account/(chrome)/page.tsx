import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { defaultLocale, isLocale, type Locale } from '@/i18n/locales';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  EmptyState,
  PageHeader,
  Stat,
  StatusBadge,
  Surface,
} from '@/components/admin/primitives';
import { DashboardTabs } from '@/components/admin/DashboardTabs';
import { AccountUpdatesModal } from '@/components/account/updates/AccountUpdatesModal';
import { adminPhrase } from '@/components/admin/adminLocale';
import { getAdminUserId } from '@/lib/adminAuth';
import { getStorefrontsForUser } from '@/lib/brief';
import {
  listUnreadAccountUpdates,
  syncProductionDeploymentAccountUpdate,
} from '@/lib/accountUpdates';
import { getPlan } from '@/lib/billing';
import { getAllProducts } from '@/lib/products';
import { countCustomers } from '@/lib/customers';
import {
  dailyOrdersSince,
  dailyVisitorsSince,
  eventCountSince,
  uniqueVisitorsSince,
} from '@/lib/analytics';
import { MiniBarChart } from '@/components/admin/charts/MiniBarChart';
import { TopProductsCard } from '@/components/admin/home/TopProductsCard';
import { QuickActionsCard } from '@/components/admin/home/QuickActionsCard';
import { recentActivity } from '@/lib/audit';
import { listInstalledApps } from '@/lib/apps/installed';
import {
  getOrderStatsForStorefront,
  listOrdersForStorefront,
  type Order,
} from '@/lib/checkout-orders';

type StorefrontForHome = Awaited<ReturnType<typeof getStorefrontsForUser>>[number];

export default async function AccountHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const userId = await getAdminUserId('account/home');
  if (!userId) redirect('/sign-in?redirect_url=/account');

  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale: Locale =
    cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const t = HOME_STRINGS[locale];
  const p = (text: string) => adminPhrase(locale, text);
  const [storefronts, currentPlan] = await Promise.all([
    getStorefrontsForUser(userId),
    getPlan(userId),
  ]);
  await syncProductionDeploymentAccountUpdate();
  const accountUpdates = await listUnreadAccountUpdates(userId, currentPlan);

  if (storefronts.length === 0) {
    return (
      <>
        <AccountUpdatesModal initialUpdates={accountUpdates} locale={locale} />
        <PageHeader
          eyebrow={p('Workspace')}
          title={p('Create your first storefront')}
          subtitle={p('Your account is ready. Start with the onboarding flow and this dashboard will fill with live orders, products, customers, and activity.')}
        />
        <EmptyState
          eyebrow={p('No store yet')}
          title={p('Start with a real storefront')}
          body={p('Souqna needs one storefront before the admin workspace can show live commerce data.')}
          action={{ label: p('Start a store'), href: '/begin' }}
        />
      </>
    );
  }

  const known = new Set(storefronts.map((store) => store.slug));
  const storefront =
    storefronts.find((store) => store.slug === requested && known.has(store.slug)) ??
    storefronts[0]!;
  const storeParam = `?store=${encodeURIComponent(storefront.slug)}`;

  const [
    products,
    customersTotal,
    ordersPage,
    orderStats,
    installedApps,
    activity,
    visitors30,
    ,
    carts30,
    visitorTrend,
    ordersTrend,
  ] = await Promise.all([
    getAllProducts(storefront.slug),
    countCustomers(storefront.slug),
    listOrdersForStorefront(storefront.slug, { limit: 6 }),
    getOrderStatsForStorefront(storefront.slug),
    listInstalledApps(storefront.slug),
    recentActivity(storefront.slug, 8),
    uniqueVisitorsSince(storefront.slug, 30),
    eventCountSince(storefront.slug, 'page_view', 30),
    eventCountSince(storefront.slug, 'cart_add', 30),
    dailyVisitorsSince(storefront.slug, 30).catch(() => [] as number[]),
    dailyOrdersSince(storefront.slug, 30).catch(() => [] as number[]),
  ]);
  const setupItems = [
    { label: t.setupAddProducts, done: products.length > 0, href: `/account/products${storeParam}` },
    { label: t.setupConfigureCheckout, done: storefront.checkout.paymentMethods.length > 0, href: `/account/settings/checkout${storeParam}` },
    { label: t.setupPublishStorefront, done: storefront.isPublished, href: `/account/builder${storeParam}` },
    { label: t.setupInstallApps, done: installedApps.length > 0, href: `/account/apps${storeParam}` },
  ];
  const setupProgress = Math.round(
    (setupItems.filter((item) => item.done).length / setupItems.length) * 100,
  );
  const souqyPortalHref = locale === 'ar' ? '/ar/begin/souqy' : '/begin/souqy';

  const overviewSlot = (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}
      >
        <Stat
          label={t.revenue}
          value={formatCurrency(orderStats.revenueQar, storefront.checkout.currency)}
          hint={`${orderStats.totalOrders} ${t.revenueHint}`}
          trend={ordersTrend}
          trendLabel={t.revenueTrendAria}
        />
        <Stat
          label={t.visitors}
          value={visitors30}
          hint={t.visitorsHint}
          trend={visitorTrend}
          trendLabel={t.visitorTrendAria}
        />
        <Stat label={t.products} value={products.length} hint={t.productsHint} />
        <Stat label={t.customers} value={customersTotal} hint={t.customersHint} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.55fr) minmax(280px, 0.9fr)',
          gap: 16,
          alignItems: 'start',
        }}
        className="souqna-home-overview-grid"
      >
        <TopProductsCard
          slug={storefront.slug}
          storeParam={storeParam}
          currency={storefront.checkout.currency}
          labels={{
            title: t.topProductsTitle,
            viewAll: t.topProductsViewAll,
            empty: t.topProductsEmpty,
            emptyCta: t.topProductsEmptyCta,
            ordersSuffix: t.topProductsOrdersSuffix,
          }}
        />
        <Surface padding={18}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="m-0 font-serif text-lg font-medium text-foreground">
                {t.ordersTrendTitle}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {`${ordersTrend.reduce((a, b) => a + b, 0)} ${t.ordersTrendSuffix}`}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <MiniBarChart
              data={ordersTrend}
              width={300}
              height={64}
              ariaLabel={t.ordersBarAria}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t.thirtyDaysAgo}</span>
            <span>{t.today}</span>
          </div>
        </Surface>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.55fr) minmax(280px, 0.9fr)',
          gap: 16,
          alignItems: 'start',
        }}
        className="souqna-home-overview-grid"
      >
        <Surface padding={0} style={{ overflow: 'hidden' }}>
          <SectionHeader
            title={t.recentOrdersTitle}
            actionHref={`/account/orders${storeParam}`}
            actionLabel={t.topProductsViewAll}
          />
          {ordersPage.orders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.customer}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead className="text-right">{t.total}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersPage.orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link
                        href={`/account/orders/${order.id}${storeParam}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {order.customerName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={statusTone(order.orderStatus)}>
                        {p(order.orderStatus.replace('_', ' '))}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(order.totalQar, order.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <InlineEmpty
              title={t.noOrdersYet}
              body={t.noOrdersBody}
              href={`/account/products${storeParam}`}
              label={t.setupAddProducts}
            />
          )}
        </Surface>

        <SetupPanel
          setupProgress={setupProgress}
          setupItems={setupItems}
          orderStats={orderStats}
          carts30={carts30}
          currency={storefront.checkout.currency}
          labels={t}
        />
      </div>
    </>
  );

  const setupSlot = (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: 16,
        alignItems: 'start',
      }}
      className="souqna-home-overview-grid"
    >
      <SetupPanel
        setupProgress={setupProgress}
        setupItems={setupItems}
        orderStats={orderStats}
        carts30={carts30}
        currency={storefront.checkout.currency}
        spacious
        labels={t}
      />
      <QuickActionsCard
        storeParam={storeParam}
        labels={{
          title: t.quickActionsTitle,
          addProduct: t.quickActionsAddProduct,
          editStorefront: t.quickActionsEditStorefront,
          browseApps: t.quickActionsBrowseApps,
        }}
      />
    </div>
  );

  const activitySlot = (
    <Surface padding={0} style={{ overflow: 'hidden' }}>
      <SectionHeader
        title={t.recentActivityTitle}
        actionHref={`/account/settings/activity-log${storeParam}`}
        actionLabel={t.log}
      />
      {activity.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.action}</TableHead>
              <TableHead>{t.summary}</TableHead>
              <TableHead className="text-right">{t.when}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activity.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-mono text-xs">{entry.action}</TableCell>
                <TableCell>{entry.summary ?? entry.targetId ?? t.recordedActivity}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatDate(entry.occurredAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <InlineEmpty
          title={t.noActivityYet}
          body={t.noActivityBody}
        />
      )}
    </Surface>
  );

  return (
    <>
      <AccountUpdatesModal initialUpdates={accountUpdates} locale={locale} />
      <AccountHomeHero
        storefront={storefront}
        setupProgress={setupProgress}
        productsCount={products.length}
        customersTotal={customersTotal}
        ordersTotal={ordersPage.total}
        revenue={formatCurrency(orderStats.revenueQar, storefront.checkout.currency)}
        builderHref={`/account/builder${storeParam}`}
        souqyPortalHref={souqyPortalHref}
        labels={t}
      />
      <DashboardTabs overview={overviewSlot} setup={setupSlot} activity={activitySlot} />
      <style>{`
        @media (max-width: 940px) {
          .souqna-home-overview-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}

function AccountHomeHero({
  storefront,
  setupProgress,
  productsCount,
  customersTotal,
  ordersTotal,
  revenue,
  builderHref,
  souqyPortalHref,
  labels,
}: {
  storefront: StorefrontForHome;
  setupProgress: number;
  productsCount: number;
  customersTotal: number;
  ordersTotal: number;
  revenue: string;
  builderHref: string;
  souqyPortalHref: string;
  labels: (typeof HOME_STRINGS)[Locale];
}) {
  return (
    <Surface
      padding={0}
      style={{
        overflow: 'hidden',
        margin: '18px 0 22px',
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--admin-accent) 9%, var(--surface-elevated)) 0%, var(--surface-elevated) 52%, var(--surface-bg) 100%)',
      }}
    >
      <div
        dir="ltr"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: 20,
          alignItems: 'start',
          padding: '24px clamp(18px, 3vw, 28px)',
        }}
        className="souqna-account-hero"
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 12,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--ink-faint)',
              }}
            >
              {labels.workspace}
            </span>
            <StatusBadge tone={storefront.isPublished ? 'success' : 'neutral'}>
              {storefront.isPublished ? labels.live : labels.draft}
            </StatusBadge>
            <StatusBadge tone={setupProgress === 100 ? 'success' : 'warning'}>
              {setupProgress}% {labels.setup}
            </StatusBadge>
          </div>
          <h1
            dir="auto"
            style={{
              margin: 0,
              maxWidth: 780,
              color: 'var(--ink-strong)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'clamp(28px, 4vw, 44px)',
              fontWeight: 650,
              lineHeight: 1.05,
              letterSpacing: 0,
              textWrap: 'balance',
              unicodeBidi: 'plaintext',
            }}
          >
            {storefront.businessName}
          </h1>
          <p
            style={{
              margin: '10px 0 0',
              maxWidth: 620,
              color: 'var(--ink-muted)',
              fontSize: 14.5,
              lineHeight: 1.65,
            }}
          >
            {labels.heroSubtitle}
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              marginTop: 18,
            }}
          >
            <Button asChild>
              <Link href={builderHref}>{labels.openBuilder}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={souqyPortalHref}>{labels.viewStore}</Link>
            </Button>
          </div>
        </div>

        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(120px, 1fr))',
            gap: 10,
            minWidth: 280,
            margin: 0,
          }}
          className="souqna-account-hero-signals"
        >
          <Signal label={labels.orders} value={ordersTotal} />
          <Signal label={labels.products} value={productsCount} />
          <Signal label={labels.customers} value={customersTotal} />
          <Signal label={labels.revenue} value={revenue} />
        </dl>
      </div>
      <style>{`
        @media (max-width: 820px) {
          .souqna-account-hero {
            grid-template-columns: 1fr !important;
          }
          .souqna-account-hero-signals {
            min-width: 0 !important;
          }
        }
      `}</style>
    </Surface>
  );
}

function SetupPanel({
  setupProgress,
  setupItems,
  orderStats,
  carts30,
  currency,
  spacious = false,
  labels,
}: {
  setupProgress: number;
  setupItems: Array<{ label: string; done: boolean; href: string }>;
  orderStats: {
    averageOrderQar: number;
    pendingOrders: number;
    unpaidOrders: number;
  };
  carts30: number;
  currency: string;
  spacious?: boolean;
  labels: (typeof HOME_STRINGS)[Locale];
}) {
  return (
    <Surface padding={spacious ? 22 : 18}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="m-0 font-serif text-lg font-medium text-foreground">
            {labels.setupTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {labels.setupProgress(setupProgress)}
          </p>
        </div>
        <StatusBadge tone={setupProgress === 100 ? 'success' : 'warning'}>
          {setupProgress === 100 ? labels.ready : labels.progress}
        </StatusBadge>
      </div>
      <Progress value={setupProgress} className="mt-4" />
      <div className="mt-4 flex flex-col gap-2">
        {setupItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm text-foreground transition hover:bg-accent hover:text-accent-foreground"
          >
            <span>{item.label}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {item.done ? labels.done : labels.open}
            </span>
          </Link>
        ))}
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <Signal label={labels.cartAdds} value={carts30} />
        <Signal label={labels.aov} value={formatCurrency(orderStats.averageOrderQar, currency)} />
        <Signal label={labels.pending} value={orderStats.pendingOrders} />
        <Signal label={labels.unpaid} value={orderStats.unpaidOrders} />
      </dl>
    </Surface>
  );
}

function SectionHeader({
  title,
  actionHref,
  actionLabel,
}: {
  title: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <h2 className="m-0 font-serif text-lg font-medium text-foreground">{title}</h2>
      <Button asChild variant="ghost" size="sm">
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  );
}

function InlineEmpty({
  title,
  body,
  href,
  label,
}: {
  title: string;
  body: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-2 px-4 py-10">
      <h3
        className="m-0 font-serif text-base font-semibold"
        style={{ color: 'var(--ink-strong)' }}
      >
        {title}
      </h3>
      <p
        className="m-0 max-w-xl"
        style={{
          fontSize: '14.5px',
          lineHeight: 1.65,
          color: 'var(--ink-muted)',
        }}
      >
        {body}
      </p>
      {href && label ? (
        <Button asChild size="sm" className="mt-2">
          <Link href={href}>{label}</Link>
        </Button>
      ) : null}
    </div>
  );
}

function Signal({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-muted px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function formatCurrency(value: number, currency: string): string {
  return `${currency} ${Intl.NumberFormat('en-GB').format(value)}`;
}

function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusTone(status: Order['orderStatus']): 'success' | 'warning' | 'critical' | 'info' | 'neutral' {
  if (status === 'delivered' || status === 'confirmed') return 'success';
  if (status === 'cancelled') return 'critical';
  if (status === 'pending') return 'warning';
  if (status === 'preparing' || status === 'shipped') return 'info';
  return 'neutral';
}

const HOME_STRINGS = {
  en: {
    workspace: 'Workspace',
    live: 'live',
    draft: 'draft',
    setup: 'setup',
    heroSubtitle: 'A quieter control room for orders, products, customers, and the storefront you are building.',
    openBuilder: 'Open builder',
    viewStore: 'Souqy Portal',
    orders: 'Orders',
    revenue: 'Revenue',
    visitors: 'Visitors',
    products: 'Products',
    customers: 'Customers',
    customer: 'Customer',
    status: 'Status',
    total: 'Total',
    revenueHint: 'total orders',
    visitorsHint: 'Last 30 days',
    productsHint: 'Published and draft items',
    customersHint: 'Saved customer records',
    revenueTrendAria: 'Revenue trend over the last 30 days',
    visitorTrendAria: 'Visitor trend over the last 30 days',
    ordersBarAria: 'Daily order count over the last 30 days',
    topProductsTitle: 'Top products',
    topProductsViewAll: 'View all',
    topProductsEmpty:
      'No paid orders yet. Once buyers check out, your best sellers surface here.',
    topProductsEmptyCta: 'Manage catalogue',
    topProductsOrdersSuffix: 'orders',
    ordersTrendTitle: 'Orders trend',
    ordersTrendSuffix: 'orders · last 30 days',
    thirtyDaysAgo: '30 days ago',
    today: 'Today',
    quickActionsTitle: 'Quick actions',
    quickActionsAddProduct: 'Add a product',
    quickActionsEditStorefront: 'Edit storefront',
    quickActionsBrowseApps: 'Browse apps',
    setupAddProducts: 'Add products',
    setupConfigureCheckout: 'Configure checkout',
    setupPublishStorefront: 'Publish storefront',
    setupInstallApps: 'Install apps',
    recentOrdersTitle: 'Recent orders',
    noOrdersYet: 'No orders yet',
    noOrdersBody: 'Orders placed from checkout will appear here automatically.',
    recentActivityTitle: 'Recent activity',
    log: 'Log',
    action: 'Action',
    summary: 'Summary',
    when: 'When',
    recordedActivity: 'Recorded activity',
    noActivityYet: 'No activity yet',
    noActivityBody: 'Saved changes, app installs, and order actions will build this log.',
    setupTitle: 'Setup',
    setupProgress: (n: number) => `${n}% complete for this storefront.`,
    ready: 'ready',
    progress: 'progress',
    done: 'done',
    open: 'open',
    cartAdds: 'Cart adds',
    aov: 'AOV',
    pending: 'Pending',
    unpaid: 'Unpaid',
  },
  ar: {
    workspace: 'مساحة العمل',
    live: 'مباشر',
    draft: 'مسودة',
    setup: 'إعداد',
    heroSubtitle: 'غرفة تحكم أهدأ للطلبات والمنتجات والعملاء والمتجر الذي تبنيه.',
    openBuilder: 'افتح المصمم',
    viewStore: 'Souqy Portal',
    orders: 'الطلبات',
    revenue: 'الإيرادات',
    visitors: 'الزوّار',
    products: 'المنتجات',
    customers: 'العملاء',
    customer: 'العميل',
    status: 'الحالة',
    total: 'الإجمالي',
    revenueHint: 'إجمالي الطلبات',
    visitorsHint: 'آخر ٣٠ يوماً',
    productsHint: 'منتجات منشورة ومسوّدات',
    customersHint: 'سجلات العملاء',
    revenueTrendAria: 'منحنى الإيرادات خلال آخر ٣٠ يوماً',
    visitorTrendAria: 'منحنى الزوّار خلال آخر ٣٠ يوماً',
    ordersBarAria: 'عدد الطلبات اليومي خلال آخر ٣٠ يوماً',
    topProductsTitle: 'أكثر المنتجات مبيعاً',
    topProductsViewAll: 'عرض الكل',
    topProductsEmpty:
      'لا توجد طلبات مدفوعة بعد. عندما يبدأ الزبائن في الشراء ستظهر هنا أفضل منتجاتك.',
    topProductsEmptyCta: 'إدارة الكتالوج',
    topProductsOrdersSuffix: 'طلبات',
    ordersTrendTitle: 'منحنى الطلبات',
    ordersTrendSuffix: 'طلبات · آخر ٣٠ يوماً',
    thirtyDaysAgo: 'قبل ٣٠ يوماً',
    today: 'اليوم',
    quickActionsTitle: 'إجراءات سريعة',
    quickActionsAddProduct: 'إضافة منتج',
    quickActionsEditStorefront: 'تعديل المتجر',
    quickActionsBrowseApps: 'تصفّح التطبيقات',
    setupAddProducts: 'إضافة منتجات',
    setupConfigureCheckout: 'إعداد الدفع',
    setupPublishStorefront: 'نشر المتجر',
    setupInstallApps: 'تثبيت التطبيقات',
    recentOrdersTitle: 'أحدث الطلبات',
    noOrdersYet: 'لا توجد طلبات بعد',
    noOrdersBody: 'ستظهر الطلبات القادمة من الدفع هنا تلقائياً.',
    recentActivityTitle: 'النشاط الأخير',
    log: 'السجل',
    action: 'الإجراء',
    summary: 'الملخص',
    when: 'الوقت',
    recordedActivity: 'نشاط مسجل',
    noActivityYet: 'لا يوجد نشاط بعد',
    noActivityBody: 'ستظهر التغييرات المحفوظة وتثبيت التطبيقات وإجراءات الطلبات في هذا السجل.',
    setupTitle: 'الإعداد',
    setupProgress: (n: number) => `اكتمل ${n}% من إعداد هذا المتجر.`,
    ready: 'جاهز',
    progress: 'قيد التقدم',
    done: 'مكتمل',
    open: 'مفتوح',
    cartAdds: 'إضافات السلة',
    aov: 'متوسط الطلب',
    pending: 'قيد الانتظار',
    unpaid: 'غير مدفوع',
  },
} as const satisfies Record<Locale, Record<string, string | ((n: number) => string)>>;
