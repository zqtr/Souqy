import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';
import { getCustomer } from '@/lib/customers';
import { listOrders } from '@/lib/orders';
import { listInquiries } from '@/lib/inquiries';
import {
  PageHeader,
  Surface,
  Stat,
  StatusBadge,
} from '@/components/admin/primitives';
import { CustomerForm } from '@/components/admin/customers/CustomerForm';

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/customers');

  const { id } = await params;
  const customerId = Number.parseInt(id, 10);
  if (!Number.isFinite(customerId) || customerId <= 0) notFound();

  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const storefronts = await getStorefrontsForUser(userId);
  if (storefronts.length === 0) redirect('/account');
  const known = new Set(storefronts.map((s) => s.slug));
  const slug = requested && known.has(requested) ? requested : storefronts[0]!.slug;

  const customer = await getCustomer(slug, customerId);
  if (!customer) notFound();

  const [allOrders, allInquiries] = await Promise.all([
    listOrders(slug, { limit: 200 }),
    listInquiries(slug, { limit: 200 }),
  ]);
  const myOrders = allOrders.filter((o) => o.customerId === customerId).slice(0, 12);
  const myInquiries = allInquiries.filter((q) => q.customerId === customerId).slice(0, 12);

  const display =
    [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
    customer.email ||
    customer.phone ||
    'Unnamed customer';

  return (
    <>
      <PageHeader
        eyebrow="Customer"
        title={display}
        subtitle={customer.email ?? customer.phone ?? '—'}
        secondaryActions={[
          { label: '← Customers', href: `/account/customers?store=${slug}` },
        ]}
      />

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Stat label="Orders" value={customer.orderCount} />
        <Stat label="Inquiries" value={customer.inquiryCount} />
        <Stat
          label="Total spent"
          value={`QAR ${customer.totalSpent.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <Stat
          label="Last seen"
          value={
            customer.lastSeenAt
              ? customer.lastSeenAt.toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '—'
          }
        />
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          gap: 20,
          alignItems: 'flex-start',
        }}
        className="souqna-customer-grid"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Surface padding={20}>
            <h2
              style={{
                margin: '0 0 12px',
                fontFamily: 'var(--font-serif, var(--font-sans))',
                fontWeight: 400,
                fontSize: 18,
                color: 'var(--ink-strong)',
              }}
            >
              Recent orders
            </h2>
            {myOrders.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)' }}>
                No orders yet for this customer.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {myOrders.map((o, i) => (
                  <li
                    key={o.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 0',
                      gap: 12,
                      borderTop:
                        i === 0
                          ? 'none'
                          : '1px solid color-mix(in srgb, var(--ink-strong) 7%, transparent)',
                      fontSize: 13.5,
                    }}
                  >
                    <Link
                      href={`/account/orders/${o.id}?store=${slug}`}
                      style={{
                        color: 'var(--ink-strong)',
                        textDecoration: 'none',
                        fontWeight: 500,
                      }}
                    >
                      #{o.orderNumber}
                    </Link>
                    <span style={{ flex: 1, color: 'var(--ink-muted)' }}>
                      {o.createdAt.toLocaleDateString('en-GB')}
                    </span>
                    <StatusBadge tone="neutral">{o.status}</StatusBadge>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {o.currencyCode} {o.total.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Surface>

          <Surface padding={20}>
            <h2
              style={{
                margin: '0 0 12px',
                fontFamily: 'var(--font-serif, var(--font-sans))',
                fontWeight: 400,
                fontSize: 18,
                color: 'var(--ink-strong)',
              }}
            >
              Inquiries
            </h2>
            {myInquiries.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)' }}>
                No inquiries from this customer.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {myInquiries.map((q, i) => (
                  <li
                    key={q.id}
                    style={{
                      padding: '10px 0',
                      borderTop:
                        i === 0
                          ? 'none'
                          : '1px solid color-mix(in srgb, var(--ink-strong) 7%, transparent)',
                      fontSize: 13.5,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <Link
                        href={`/account/inquiries/${q.id}?store=${slug}`}
                        style={{
                          color: 'var(--ink-strong)',
                          textDecoration: 'none',
                          fontWeight: 500,
                        }}
                      >
                        {q.productTitle ?? 'General'}
                      </Link>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted)' }}>
                        {q.createdAt.toLocaleDateString('en-GB')}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: '4px 0 0',
                        fontSize: 12.5,
                        color: 'var(--ink-muted)',
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2,
                        overflow: 'hidden',
                      }}
                    >
                      {q.message}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Surface>
        </div>

        <Surface padding={20}>
          <h2
            style={{
              margin: '0 0 12px',
              fontFamily: 'var(--font-serif, var(--font-sans))',
              fontWeight: 400,
              fontSize: 18,
              color: 'var(--ink-strong)',
            }}
          >
            Edit profile
          </h2>
          <CustomerForm
            storefrontSlug={slug}
            mode="edit"
            initial={{
              firstName: customer.firstName,
              lastName: customer.lastName,
              email: customer.email,
              phone: customer.phone,
              tags: customer.tags,
              marketingConsent: customer.marketingConsent,
            }}
          />
        </Surface>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .souqna-customer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
