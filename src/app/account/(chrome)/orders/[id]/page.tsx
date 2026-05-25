import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { getOrder } from '@/lib/orders';
import { getCustomer } from '@/lib/customers';
import { getStorefrontsForUser } from '@/lib/brief';
import {
  PageHeader,
  Surface,
  StatusBadge,
} from '@/components/admin/primitives';
import { ResendWhatsAppButton } from '@/components/admin/orders/ResendWhatsAppButton';

/**
 * Order detail page. SSR — pulls the order, items, and customer in
 * one render. Status changes (paid / refunded / cancelled) land in
 * Deploy C+ via the existing `setOrderStatus` action; for v1 the
 * detail view is read-mostly so we ship the full visual structure now
 * and wire write actions iteratively.
 */
export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/orders');

  const { id } = await params;
  const orderId = Number.parseInt(id, 10);
  if (!Number.isFinite(orderId) || orderId <= 0) notFound();

  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const storefronts = await getStorefrontsForUser(userId);
  if (storefronts.length === 0) redirect('/account');
  const known = new Set(storefronts.map((s) => s.slug));
  const slug = requested && known.has(requested) ? requested : storefronts[0]!.slug;

  const order = await getOrder(slug, orderId);
  if (!order) notFound();
  const customer = order.customerId
    ? await getCustomer(slug, order.customerId)
    : null;

  return (
    <>
      <PageHeader
        eyebrow={`Orders · ${slug}`}
        title={`Order #${order.orderNumber}`}
        subtitle={`Placed ${order.createdAt.toLocaleString('en-GB')}.`}
        secondaryActions={[{ label: '← Orders', href: `/account/orders?store=${slug}` }]}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 20,
          alignItems: 'flex-start',
        }}
        className="souqna-order-grid"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Surface padding={20}>
            <header
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-serif, var(--font-sans))',
                  fontWeight: 400,
                  fontSize: 18,
                  color: 'var(--ink-strong)',
                }}
              >
                Items
              </h2>
              <StatusBadge tone="neutral">
                {order.items?.length ?? 0} line items
              </StatusBadge>
            </header>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-muted)',
                    textAlign: 'left',
                  }}
                >
                  <th style={{ padding: '8px 0' }}>Title</th>
                  <th style={{ padding: '8px 0', textAlign: 'right' }}>Unit</th>
                  <th style={{ padding: '8px 0', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '8px 0', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(order.items ?? []).map((it) => (
                  <tr
                    key={it.id}
                    style={{
                      borderTop:
                        '1px solid color-mix(in srgb, var(--ink-strong) 7%, transparent)',
                    }}
                  >
                    <td style={{ padding: '12px 0' }}>
                      <span style={{ fontWeight: 500, color: 'var(--ink-strong)' }}>
                        {it.productTitle}
                      </span>
                      {it.variantLabel ? (
                        <span
                          style={{
                            display: 'block',
                            fontSize: 12,
                            color: 'var(--ink-muted)',
                            marginTop: 2,
                          }}
                        >
                          {it.variantLabel}
                        </span>
                      ) : null}
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {it.unitPrice.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {it.quantity}
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {it.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>

          {order.notes ? (
            <Surface padding={20}>
              <h3
                style={{
                  margin: '0 0 8px',
                  fontFamily: 'var(--font-serif, var(--font-sans))',
                  fontWeight: 400,
                  fontSize: 16,
                  color: 'var(--ink-strong)',
                }}
              >
                Notes
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  color: 'var(--ink-strong)',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {order.notes}
              </p>
            </Surface>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Surface padding={20}>
            <h3
              style={{
                margin: '0 0 12px',
                fontFamily: 'var(--font-serif, var(--font-sans))',
                fontWeight: 400,
                fontSize: 16,
                color: 'var(--ink-strong)',
              }}
            >
              Status
            </h3>
            <Row label="Order">
              <StatusBadge tone={statusTone(order.status)}>{order.status}</StatusBadge>
            </Row>
            <Row label="Payment">
              <StatusBadge tone={paymentTone(order.paymentStatus)}>
                {order.paymentStatus}
              </StatusBadge>
            </Row>
            <Row label="Fulfilment">
              <StatusBadge tone="neutral">{order.fulfilmentStatus}</StatusBadge>
            </Row>
            <Row label="Channel">
              <StatusBadge tone="info">{order.channel}</StatusBadge>
            </Row>
          </Surface>

          <Surface padding={20}>
            <h3
              style={{
                margin: '0 0 12px',
                fontFamily: 'var(--font-serif, var(--font-sans))',
                fontWeight: 400,
                fontSize: 16,
                color: 'var(--ink-strong)',
              }}
            >
              Totals
            </h3>
            <Row label="Subtotal" value={`${order.currencyCode} ${order.subtotal.toFixed(2)}`} />
            <Row label="Discount" value={`− ${order.currencyCode} ${order.discountTotal.toFixed(2)}`} />
            <Row label="Shipping" value={`${order.currencyCode} ${order.shippingTotal.toFixed(2)}`} />
            <Row
              label="Total"
              value={`${order.currencyCode} ${order.total.toFixed(2)}`}
              strong
            />
          </Surface>

          <Surface padding={20}>
            <h3
              style={{
                margin: '0 0 12px',
                fontFamily: 'var(--font-serif, var(--font-sans))',
                fontWeight: 400,
                fontSize: 16,
                color: 'var(--ink-strong)',
              }}
            >
              Customer
            </h3>
            {customer ? (
              <>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-strong)' }}>
                  {[customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
                    customer.email ||
                    customer.phone ||
                    '—'}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-muted)' }}>
                  {customer.email ?? customer.phone ?? '—'}
                </p>
                <Link
                  href={`/account/customers/${customer.id}?store=${slug}`}
                  style={{
                    marginTop: 10,
                    fontSize: 12.5,
                    color: 'var(--admin-accent)',
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  View customer →
                </Link>
                <ResendWhatsAppButton
                  storefrontSlug={slug}
                  orderId={order.id}
                  disabled={!customer.phone}
                />
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)' }}>
                No customer attached.
              </p>
            )}
          </Surface>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .souqna-order-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

function Row({
  label,
  value,
  strong,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  strong?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '6px 0',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontSize: strong ? 16 : 13,
          fontWeight: strong ? 500 : 400,
          color: 'var(--ink-strong)',
          fontFamily: strong ? 'var(--font-serif, var(--font-sans))' : 'inherit',
        }}
      >
        {children ?? value}
      </span>
    </div>
  );
}

function statusTone(s: string): 'success' | 'warning' | 'critical' | 'info' | 'neutral' {
  if (s === 'paid') return 'success';
  if (s === 'open' || s === 'partially_paid') return 'info';
  if (s === 'cancelled' || s === 'refunded' || s === 'partially_refunded') return 'critical';
  return 'neutral';
}

function paymentTone(s: string): 'success' | 'warning' | 'critical' | 'info' | 'neutral' {
  if (s === 'paid') return 'success';
  if (s === 'authorized') return 'info';
  if (s === 'pending') return 'warning';
  if (s === 'refunded' || s === 'voided' || s === 'failed') return 'critical';
  return 'neutral';
}
