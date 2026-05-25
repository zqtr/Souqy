import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { getStorefrontsForUser, getStorefront } from '@/lib/brief';
import { getOrderById, type Order } from '@/lib/checkout-orders';
import { direction } from '@/i18n/locales';
import { fontVariables } from '@/lib/fonts';
import { PrintControls, PrintAutoTrigger } from './PrintControls';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Invoice',
  robots: { index: false, follow: false },
};

export default async function PrintInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ store?: string | string[]; auto?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/orders');

  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const autoFlag = Array.isArray(sp.auto) ? sp.auto[0] : sp.auto;

  const storefronts = await getStorefrontsForUser(userId);
  if (storefronts.length === 0) redirect('/begin');
  const known = new Set(storefronts.map((s) => s.slug));
  const slug = requested && known.has(requested) ? requested : storefronts[0]!.slug;

  const [order, storefront] = await Promise.all([getOrderById(id, slug), getStorefront(slug)]);
  if (!order || !storefront) notFound();

  const issuedAt = new Date(order.createdAt);
  const issuedAtLabel = issuedAt.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const shortId = order.id.slice(0, 8).toUpperCase();
  const autoPrint = autoFlag !== '0';

  return (
    <html lang={storefront.locale} dir={direction[storefront.locale]} className={fontVariables}>
      <head>
        <title>{`Invoice · ${shortId}`}</title>
        <style>{`
          @page { size: A4; margin: 18mm 16mm; }
          html, body {
            background: #ffffff;
            color: #18181b;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: var(--font-inter, var(--font-exo-2), ui-sans-serif, system-ui), sans-serif;
            font-size: 11pt;
            line-height: 1.5;
            padding: 28pt 32pt;
          }
          .stage { max-width: 720px; margin: 0 auto; }
          .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24pt; padding-bottom: 18pt; border-bottom: 1pt solid #d4d4d8; }
          .brand h1 { margin: 0; font-size: 18pt; font-weight: 600; letter-spacing: -0.01em; }
          .brand .tag { font-size: 10pt; color: #71717a; margin-top: 2pt; }
          .meta { text-align: end; font-size: 10pt; color: #52525b; }
          .meta .eyebrow { font-family: var(--font-jetbrains-mono, monospace); font-size: 8.5pt; letter-spacing: 0.14em; text-transform: uppercase; color: #71717a; }
          .meta .num { font-family: var(--font-jetbrains-mono, monospace); font-size: 13pt; color: #18181b; margin: 2pt 0; }
          .section { margin-top: 22pt; }
          .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 32pt; }
          .label { font-family: var(--font-jetbrains-mono, monospace); font-size: 8.5pt; letter-spacing: 0.12em; text-transform: uppercase; color: #71717a; margin-bottom: 4pt; }
          .field { font-size: 10.5pt; line-height: 1.5; }
          table { width: 100%; border-collapse: collapse; margin-top: 6pt; }
          th, td { text-align: start; padding: 8pt 6pt; }
          th { font-family: var(--font-jetbrains-mono, monospace); font-size: 8.5pt; letter-spacing: 0.12em; text-transform: uppercase; color: #71717a; border-bottom: 1pt solid #d4d4d8; font-weight: 500; }
          tbody td { border-bottom: 1pt solid #e4e4e7; font-size: 10.5pt; }
          tbody td.num { font-family: var(--font-jetbrains-mono, monospace); text-align: end; font-variant-numeric: tabular-nums; }
          tfoot td { padding: 6pt; font-size: 10.5pt; }
          tfoot td.num { font-family: var(--font-jetbrains-mono, monospace); text-align: end; font-variant-numeric: tabular-nums; }
          tfoot tr.total td { border-top: 1pt solid #d4d4d8; font-weight: 600; font-size: 12pt; padding-top: 10pt; }
          .badge { display: inline-flex; align-items: center; padding: 2pt 8pt; border-radius: 999pt; font-family: var(--font-jetbrains-mono, monospace); font-size: 8pt; letter-spacing: 0.06em; text-transform: uppercase; border: 0.6pt solid; }
          .badge.paid { color: #047857; border-color: #10b981; background: rgba(209,250,229,0.5); }
          .badge.unpaid { color: #a16207; border-color: #ca8a04; background: rgba(254,243,199,0.5); }
          .badge.failed { color: #b91c1c; border-color: #dc2626; background: rgba(254,226,226,0.5); }
          .badge.refunded { color: #b91c1c; border-color: #dc2626; background: rgba(254,226,226,0.5); }
          footer { margin-top: 26pt; padding-top: 14pt; border-top: 1pt solid #e4e4e7; font-size: 9.5pt; color: #71717a; display: flex; justify-content: space-between; gap: 24pt; }
          .controls { padding-bottom: 16pt; }
          .controls button {
            font-family: inherit;
            font-size: 10pt;
            padding: 6pt 12pt;
            border-radius: 6pt;
            background: #18181b;
            color: #fafafa;
            border: 1pt solid #18181b;
            cursor: pointer;
          }
          @media print {
            .controls { display: none !important; }
            html, body { padding: 0; }
            .stage { max-width: none; }
          }
        `}</style>
      </head>
      <body>
        <div className="stage">
          <PrintControls />

          <header className="head">
            <div className="brand">
              <h1>{storefront.businessName}</h1>
              {storefront.tagline ? <div className="tag">{storefront.tagline}</div> : null}
              {storefront.phone ? <div className="tag">{storefront.phone}</div> : null}
            </div>
            <div className="meta">
              <div className="eyebrow">Invoice</div>
              <div className="num">#{shortId}</div>
              <div>{issuedAtLabel}</div>
              <div style={{ marginTop: 6 }}>
                <PaymentBadge status={order.paymentStatus} />
              </div>
            </div>
          </header>

          <section className="section grid2">
            <div>
              <div className="label">Billed to</div>
              <div className="field">
                {order.customerName}
                <br />
                {order.customerPhone}
                {order.customerEmail ? (
                  <>
                    <br />
                    {order.customerEmail}
                  </>
                ) : null}
              </div>
            </div>
            <div>
              <div className="label">Ship to</div>
              <div className="field">
                {order.address ? (
                  <>
                    {order.address.line1}
                    {order.address.line2 ? (
                      <>
                        <br />
                        {order.address.line2}
                      </>
                    ) : null}
                    <br />
                    {order.address.area ? `${order.address.area}, ` : ''}
                    {order.address.city}
                    {order.address.zip ? ` ${order.address.zip}` : ''}
                    <br />
                    {order.address.country}
                  </>
                ) : (
                  <span style={{ color: '#a1a1aa' }}>—</span>
                )}
              </div>
            </div>
          </section>

          <section className="section">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ textAlign: 'end' }}>Qty</th>
                  <th style={{ textAlign: 'end' }}>Unit</th>
                  <th style={{ textAlign: 'end' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => {
                  const unit = Number(it.priceQarSnapshot);
                  return (
                    <tr key={it.id}>
                      <td>
                        <div>{it.titleSnapshot}</div>
                        {it.variantLabel ? (
                          <div style={{ marginTop: 2, fontSize: '9pt', color: '#71717a' }}>
                            Size: {it.variantLabel}
                          </div>
                        ) : null}
                        {it.customInputs.height ? (
                          <div style={{ marginTop: 2, fontSize: '9pt', color: '#71717a' }}>
                            {it.customInputs.heightLabel || 'Height'}: {it.customInputs.height}
                          </div>
                        ) : null}
                      </td>
                      <td className="num">{it.quantity}</td>
                      <td className="num">
                        {order.currency} {unit.toLocaleString()}
                      </td>
                      <td className="num">
                        {order.currency} {(unit * it.quantity).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ textAlign: 'end', color: '#71717a' }}>
                    Subtotal
                  </td>
                  <td className="num">
                    {order.currency} {Number(order.subtotalQar).toLocaleString()}
                  </td>
                </tr>
                {Number(order.shippingQar) > 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'end', color: '#71717a' }}>
                      Shipping
                    </td>
                    <td className="num">
                      {order.currency} {Number(order.shippingQar).toLocaleString()}
                    </td>
                  </tr>
                ) : null}
                {Number(order.taxQar) > 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'end', color: '#71717a' }}>
                      Tax
                    </td>
                    <td className="num">
                      {order.currency} {Number(order.taxQar).toLocaleString()}
                    </td>
                  </tr>
                ) : null}
                <tr className="total">
                  <td colSpan={3} style={{ textAlign: 'end' }}>
                    Total
                  </td>
                  <td className="num">
                    {order.currency} {Number(order.totalQar).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          {order.notes ? (
            <section className="section">
              <div className="label">Notes</div>
              <div className="field">{order.notes}</div>
            </section>
          ) : null}

          <footer>
            <span>Thank you for shopping with {storefront.businessName}.</span>
            <span>Issued via Souqna · souqna.qa</span>
          </footer>
        </div>
        {autoPrint ? <PrintAutoTrigger /> : null}
      </body>
    </html>
  );
}

function PaymentBadge({ status }: { status: Order['paymentStatus'] }) {
  const className =
    status === 'marked_paid'
      ? 'badge paid'
      : status === 'refunded'
        ? 'badge refunded'
        : status === 'payment_failed'
          ? 'badge failed'
          : 'badge unpaid';
  const label = status === 'marked_paid' ? 'paid' : status === 'payment_failed' ? 'failed' : status;
  return <span className={className}>{label}</span>;
}
