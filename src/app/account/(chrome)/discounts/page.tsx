import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';
import { listDiscounts, countDiscounts } from '@/lib/discounts';
import {
  PageHeader,
  Surface,
  EmptyState,
  StatusBadge,
} from '@/components/admin/primitives';
import { DiscountModal } from '@/components/admin/discounts/DiscountModal';
import { adminPhrase } from '@/components/admin/adminLocale';

export default async function DiscountsPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[]; new?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/discounts');
  const locale = (await cookies()).get('NEXT_LOCALE')?.value;
  const t = (text: string) => adminPhrase(locale, text);

  const sp = (await searchParams) ?? {};
  const pick = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const requested = pick(sp.store);
  const isNew = pick(sp.new) === '1' || pick(sp.new) === 'true';
  const storefronts = await getStorefrontsForUser(userId);
  if (storefronts.length === 0) {
    return (
      <>
        <PageHeader title={t('Discounts')} subtitle={t('Set up a storefront to create discount codes.')} />
        <EmptyState
          eyebrow={t('Get started')}
          title={t('Create your store first')}
          body={t("Discount codes apply to your storefront's order flow. Once your store is live, you can create percentage, fixed-amount, or free-shipping codes here.")}
          action={{ label: t('Create your store'), href: '/begin' }}
        />
      </>
    );
  }
  const known = storefronts.map((s) => s.slug);
  const slug =
    requested && known.includes(requested) ? requested : storefronts[0]!.slug;

  const [discounts, total] = await Promise.all([
    listDiscounts(slug, { limit: 50 }),
    countDiscounts(slug),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={t('Discounts')}
        title={t('Discounts')}
        subtitle={
          locale === 'ar'
            ? `${total.toLocaleString('ar-QA')} كود خصم على ${storefronts.find((s) => s.slug === slug)?.businessName ?? slug}.`
            : `${total} discount code${total === 1 ? '' : 's'} on ${storefronts.find((s) => s.slug === slug)?.businessName ?? slug}.`
        }
        primaryAction={{
          label: t('Create discount'),
          href: `/account/discounts?store=${slug}&new=1`,
        }}
      />

      {discounts.length === 0 ? (
        <EmptyState
          eyebrow={t('No codes yet')}
          title={t('Reward your best customers')}
          body={t('Promo codes show up as a discount field on your order entry screen. Soft-launch a code with your VIP customers, run a flash sale, or thank loyal repeat buyers.')}
          action={{
            label: t('Create discount'),
            href: `/account/discounts?store=${slug}&new=1`,
          }}
        />
      ) : (
        <Surface padding={0}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr
                style={{
                  textAlign: 'left',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-muted)',
                }}
              >
                <Th>{t('Code')}</Th>
                <Th>{t('Type')}</Th>
                <Th>{t('Value')}</Th>
                <Th>{t('Status')}</Th>
                <Th align="right">{t('Used')}</Th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => (
                <tr
                  key={d.id}
                  style={{
                    borderTop:
                      '1px solid color-mix(in srgb, var(--ink-strong) 7%, transparent)',
                  }}
                >
                  <Td>
                    <Link
                      href={`/account/discounts/${d.id}?store=${slug}`}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 500,
                        color: 'var(--ink-strong)',
                        textDecoration: 'none',
                      }}
                    >
                      {d.code}
                    </Link>
                    {d.title ? (
                      <span
                        style={{
                          display: 'block',
                          fontSize: 12,
                          color: 'var(--ink-muted)',
                          marginTop: 2,
                        }}
                      >
                        {d.title}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <StatusBadge tone="neutral">{d.kind}</StatusBadge>
                  </Td>
                  <Td>
                    {formatValue(d.valueType, d.value, locale)}
                  </Td>
                  <Td>
                    <StatusBadge tone={statusTone(d.status)}>{t(d.status)}</StatusBadge>
                  </Td>
                  <Td align="right">
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {d.usedCount}
                      {d.usageLimit ? ` / ${d.usageLimit}` : ''}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      )}

      {isNew ? (
        <DiscountModal
          open
          storefrontSlug={slug}
          closeHref={`/account/discounts?store=${slug}`}
        />
      ) : null}
    </>
  );
}

function formatValue(t: string, v: number, locale?: string): string {
  if (t === 'percentage') return `${v}%`;
  if (t === 'fixed_amount') return `QAR ${v.toFixed(2)}`;
  if (t === 'free_shipping') return adminPhrase(locale, 'Free shipping');
  return String(v);
}

function statusTone(
  s: string,
): 'success' | 'warning' | 'critical' | 'info' | 'neutral' {
  if (s === 'active') return 'success';
  if (s === 'scheduled') return 'info';
  if (s === 'expired') return 'neutral';
  if (s === 'disabled') return 'critical';
  return 'neutral';
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th style={{ padding: '12px 16px', textAlign: align, fontWeight: 500 }}>
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <td
      style={{
        padding: '14px 16px',
        textAlign: align,
        verticalAlign: 'middle',
        color: 'var(--ink-strong)',
      }}
    >
      {children}
    </td>
  );
}
