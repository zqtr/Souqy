import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';
import { listCustomers, countCustomers } from '@/lib/customers';
import {
  PageHeader,
  Surface,
  EmptyState,
  StatusBadge,
} from '@/components/admin/primitives';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CustomerModal } from '@/components/admin/customers/CustomerModal';
import { adminPhrase } from '@/components/admin/adminLocale';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[]; new?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/customers');
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
        <PageHeader title={t('Customers')} subtitle={t('Set up a storefront to start collecting customers.')} />
        <EmptyState
          eyebrow={t('Get started')}
          title={t('Create your store first')}
          body={t('Customers, inquiries, and orders are all per-storefront. Once you have a store, every inquiry from your live page becomes a customer record automatically.')}
          action={{ label: t('Create your store'), href: '/begin' }}
        />
      </>
    );
  }
  const known = storefronts.map((store) => store.slug);
  const slug =
    requested && known.includes(requested) ? requested : storefronts[0]!.slug;

  const [customers, total] = await Promise.all([
    listCustomers(slug, { limit: 50 }),
    countCustomers(slug),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={t('Customers')}
        title={t('Customers')}
        subtitle={
          locale === 'ar'
            ? `${total.toLocaleString('ar-QA')} عميل على ${storefronts.find((store) => store.slug === slug)?.businessName ?? slug}.`
            : `${total} customer${total === 1 ? '' : 's'} on ${storefronts.find((store) => store.slug === slug)?.businessName ?? slug}.`
        }
        primaryAction={{
          label: t('Add customer'),
          href: `/account/customers?store=${slug}&new=1`,
        }}
      />

      {customers.length === 0 ? (
        <EmptyState
          eyebrow={t('No customers yet')}
          title={t('Your customer list is empty')}
          body={t('Customers are created automatically when someone sends an inquiry from your storefront, when you log an order, or when you add one manually. Marketing broadcasts and per-customer order histories all read from this list.')}
          action={{
            label: t('Add a customer'),
            href: `/account/customers?store=${slug}&new=1`,
          }}
        />
      ) : (
        <Surface padding={0} style={{ overflow: 'hidden' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Name')}</TableHead>
                <TableHead>{t('Contact')}</TableHead>
                <TableHead className="text-right">{t('Orders')}</TableHead>
                <TableHead className="text-right">{t('Inquiries')}</TableHead>
                <TableHead className="text-right">{t('Total spent')}</TableHead>
                <TableHead>{t('Tags')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <Link
                      href={`/account/customers/${customer.id}?store=${slug}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {[customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
                        customer.email ||
                        customer.phone ||
                        '-'}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">
                      {customer.email ?? customer.phone ?? '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {customer.orderCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {customer.inquiryCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    QAR {customer.totalSpent.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex flex-wrap gap-1">
                      {customer.tags.length === 0 ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        customer.tags.map((tag) => (
                          <StatusBadge key={tag} tone="neutral">
                            {tag}
                          </StatusBadge>
                        ))
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Surface>
      )}

      {isNew ? (
        <CustomerModal
          open
          storefrontSlug={slug}
          closeHref={`/account/customers?store=${slug}`}
        />
      ) : null}
    </>
  );
}
