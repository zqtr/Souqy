import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';
import {
  eventCountSince,
  uniqueVisitorsSince,
  topProductsSince,
  topReferrersSince,
  dailyEventCounts,
  funnelCountsSince,
  analyticsBreakdownSince,
  type BreakdownRow,
} from '@/lib/analytics';
import {
  PageHeader,
  Stat,
  Surface,
  EmptyState,
} from '@/components/admin/primitives';
import { Sparkline } from '@/components/admin/analytics/Sparkline';
import { adminPhrase } from '@/components/admin/adminLocale';
import {
  UPGRADE_GROWTH_TOOLS_COPY,
  getPlan,
  planUnlocksAnalytics,
} from '@/lib/billing';

/**
 * Analytics overview. Charting widgets land in Deploy C; for now we
 * surface the same numbers as Home but at 30-day window plus the top
 * products and top referrers tables, all SSR.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/analytics');
  const locale = (await cookies()).get('NEXT_LOCALE')?.value;
  const t = (text: string) => adminPhrase(locale, text);

  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const [storefronts, plan] = await Promise.all([
    getStorefrontsForUser(userId),
    getPlan(userId),
  ]);
  if (storefronts.length === 0) {
    return (
      <>
        <PageHeader title={t('Analytics')} subtitle={t('Set up a storefront to start tracking traffic.')} />
        <EmptyState
          eyebrow={t('Get started')}
          title={t('Create your store first')}
          body={t('Souqna writes a privacy-respecting page-view event for every visit to your live storefront. The numbers show up here as soon as your store is published.')}
          action={{ label: t('Create your store'), href: '/begin' }}
        />
      </>
    );
  }
  const known = storefronts.map((s) => s.slug);
  const slug =
    requested && known.includes(requested) ? requested : storefronts[0]!.slug;

  if (!planUnlocksAnalytics(plan)) {
    return (
      <>
        <PageHeader title={t('Analytics')} subtitle={UPGRADE_GROWTH_TOOLS_COPY} />
        <EmptyState
          eyebrow={t('Plan locked')}
          title={t('Analytics unlock on Pro')}
          body={t('Upgrade to Pro or above to see traffic, funnel, product, and referrer analytics.')}
          action={{ label: t('Compare plans'), href: '/account/settings/plan' }}
        />
      </>
    );
  }

  const [
    pageViews30,
    productViews30,
    inquiries30,
    cartAdds30,
    cartRemoves30,
    visitors30,
    topProducts,
    topReferrers,
    pageViewSeries,
    productViewSeries,
    inquirySeries,
    cartAddSeries,
    funnel,
    devices,
    browsers,
    languages,
    screens,
    countries,
  ] = await Promise.all([
    eventCountSince(slug, 'page_view', 30),
    eventCountSince(slug, 'product_view', 30),
    eventCountSince(slug, 'inquire_submit', 30),
    eventCountSince(slug, 'cart_add', 30),
    eventCountSince(slug, 'cart_remove', 30),
    uniqueVisitorsSince(slug, 30),
    topProductsSince(slug, 30, 5),
    topReferrersSince(slug, 30, 5),
    dailyEventCounts(slug, 'page_view', 30),
    dailyEventCounts(slug, 'product_view', 30),
    dailyEventCounts(slug, 'inquire_submit', 30),
    dailyEventCounts(slug, 'cart_add', 30),
    funnelCountsSince(slug, 30),
    analyticsBreakdownSince(slug, 'device', 30),
    analyticsBreakdownSince(slug, 'browser', 30),
    analyticsBreakdownSince(slug, 'language', 30),
    analyticsBreakdownSince(slug, 'screen', 30),
    analyticsBreakdownSince(slug, 'country', 30),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={t('Analytics')}
        title={t('Last 30 days')}
        subtitle={
          locale === 'ar'
            ? `أداء ${storefronts.find((s) => s.slug === slug)?.businessName ?? slug}.`
            : `How ${storefronts.find((s) => s.slug === slug)?.businessName ?? slug} is performing.`
        }
      />

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Stat label={t('Page views · 30d')} value={formatNumber(pageViews30, locale)} />
        <Stat label={t('Unique visitors · 30d')} value={formatNumber(visitors30, locale)} />
        <Stat label={t('Product views · 30d')} value={formatNumber(productViews30, locale)} />
        <Stat label={t('Cart adds · 30d')} value={formatNumber(cartAdds30, locale)} />
        <Stat label={t('Cart removes · 30d')} value={formatNumber(cartRemoves30, locale)} />
        <Stat label={t('Inquiries · 30d')} value={formatNumber(inquiries30, locale)} />
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <Surface padding={20}>
          <Sparkline
            points={pageViewSeries}
            windowDays={30}
            label={t('Page views')}
            locale={locale}
            height={140}
          />
        </Surface>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 16,
          }}
          className="souqna-analytics-grid"
        >
          <Surface padding={20}>
            <Sparkline
              points={productViewSeries}
              windowDays={30}
              label={t('Product views')}
              locale={locale}
            />
          </Surface>
          <Surface padding={20}>
            <Sparkline
              points={inquirySeries}
              windowDays={30}
              label={t('Inquiry submissions')}
              locale={locale}
            />
          </Surface>
        </div>
        <Surface padding={20}>
          <Sparkline
            points={cartAddSeries}
            windowDays={30}
            label={t('Cart adds')}
            locale={locale}
            height={120}
          />
        </Surface>
      </section>

      <Surface padding={20} style={{ marginBottom: 20 }}>
        <h3
          style={{
            margin: '0 0 16px',
            fontFamily: 'var(--font-serif, var(--font-sans))',
            fontWeight: 400,
            fontSize: 17,
            color: 'var(--ink-strong)',
          }}
        >
          {t('Conversion funnel')}
        </h3>
        <Funnel counts={funnel} locale={locale} />
      </Surface>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 16,
        }}
        className="souqna-analytics-grid"
      >
        <Surface padding={20}>
          <h3
            style={{
              margin: '0 0 12px',
              fontFamily: 'var(--font-serif, var(--font-sans))',
              fontWeight: 400,
              fontSize: 17,
              color: 'var(--ink-strong)',
            }}
          >
            {t('Top products')}
          </h3>
          {topProducts.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)' }}>
              {t('No product views yet.')}
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {topProducts.map((p, i) => (
                <li
                  key={p.productId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderTop:
                      i === 0
                        ? 'none'
                        : '1px solid color-mix(in srgb, var(--ink-strong) 7%, transparent)',
                    fontSize: 13.5,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--ink-muted)',
                    }}
                  >
                    {p.title ?? p.productId}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {p.views.toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-US')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Surface>

        <Surface padding={20}>
          <h3
            style={{
              margin: '0 0 12px',
              fontFamily: 'var(--font-serif, var(--font-sans))',
              fontWeight: 400,
              fontSize: 17,
              color: 'var(--ink-strong)',
            }}
          >
            {t('Top referrers')}
          </h3>
          {topReferrers.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)' }}>
              {t('No traffic sources yet.')}
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {topReferrers.map((r, i) => (
                <li
                  key={r.host}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderTop:
                      i === 0
                        ? 'none'
                        : '1px solid color-mix(in srgb, var(--ink-strong) 7%, transparent)',
                    fontSize: 13.5,
                  }}
                >
                  <span style={{ color: 'var(--ink-strong)' }}>{r.host}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {r.count.toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-US')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginTop: 20,
        }}
      >
        <Breakdown title={t('Devices')} rows={devices} locale={locale} empty={t('No device data yet.')} />
        <Breakdown title={t('Browsers')} rows={browsers} locale={locale} empty={t('No browser data yet.')} />
        <Breakdown title={t('Languages')} rows={languages} locale={locale} empty={t('No language data yet.')} />
        <Breakdown title={t('Screen sizes')} rows={screens} locale={locale} empty={t('No screen data yet.')} />
        <Breakdown title={t('Countries')} rows={countries} locale={locale} empty={t('No country data yet.')} />
      </section>

      <style>{`
        @media (max-width: 800px) {
          .souqna-analytics-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

function formatNumber(n: number, locale?: string): string {
  return n.toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-US', { maximumFractionDigits: 0 });
}

function Funnel({
  counts,
  locale,
}: {
  counts: Record<'pageViews' | 'productViews' | 'cartAdds' | 'orders' | 'inquiries', number>;
  locale?: string;
}) {
  const rows = [
    { label: 'Page views', value: counts.pageViews },
    { label: 'Product views', value: counts.productViews },
    { label: 'Cart adds', value: counts.cartAdds },
    { label: 'Orders', value: counts.orders },
    { label: 'Inquiries', value: counts.inquiries },
  ];
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {rows.map((row) => (
        <div key={row.label}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 5,
              fontSize: 12.5,
            }}
          >
            <span style={{ color: 'var(--ink-muted)' }}>{row.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              {formatNumber(row.value, locale)}
            </span>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: 'color-mix(in srgb, var(--ink-strong) 8%, transparent)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.max(4, (row.value / max) * 100)}%`,
                height: '100%',
                borderRadius: 999,
                background: 'var(--admin-accent, var(--ink-strong))',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Breakdown({
  title,
  rows,
  locale,
  empty,
}: {
  title: string;
  rows: BreakdownRow[];
  locale?: string;
  empty: string;
}) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <Surface padding={18}>
      <h3
        style={{
          margin: '0 0 12px',
          fontFamily: 'var(--font-serif, var(--font-sans))',
          fontWeight: 400,
          fontSize: 16,
          color: 'var(--ink-strong)',
        }}
      >
        {title}
      </h3>
      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)' }}>{empty}</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
          {rows.map((row) => (
            <li key={row.label}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 4,
                  fontSize: 12.5,
                }}
              >
                <span style={{ color: 'var(--ink-strong)' }}>{row.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
                  {formatNumber(row.count, locale)}
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: 'color-mix(in srgb, var(--ink-strong) 7%, transparent)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.max(5, (row.count / max) * 100)}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: 'color-mix(in srgb, var(--ink-strong) 72%, transparent)',
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}
