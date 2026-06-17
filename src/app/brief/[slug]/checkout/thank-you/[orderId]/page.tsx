import { notFound } from 'next/navigation';
import { getStorefront } from '@/lib/brief';
import { getOrderForThankYou } from '@/lib/checkout-orders';
import { getStorefrontCheckoutSettings, type CheckoutSettings } from '@/lib/storefrontSettings';
import { palettes, paletteCssVars, type PaletteId } from '@/lib/palettes';
import type { Theme } from '@/lib/theme';
import { getServerTheme } from '@/components/theme/ServerThemeScript';
import { checkoutThemeForBackground } from '@/lib/storefrontCheckoutTheme';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
  params: Promise<{ slug: string; orderId: string }>;
  searchParams?: Promise<{ sadad?: string | string[]; skipcash?: string | string[] }>;
};

/**
 * Order confirmation page. Renders the buyer's just-placed order with
 * payment instructions tailored to the chosen method:
 *
 *  - cod: callback promise
 *  - bank_transfer: full bank details + the order short id as reference
 *  - skipcash / sadad: online payment confirmation note
 *  - pay_link: prominent CTA out to the configured URL
 *
 * Public-by-design: `getOrderForThankYou` enforces the (orderId, slug)
 * scope so a guessed id from another tenant cannot leak.
 */
export default async function ThankYouPage({ params, searchParams }: Props) {
  const { slug, orderId } = await params;
  const sp = (await searchParams) ?? {};
  const sadadResult = Array.isArray(sp.sadad) ? sp.sadad[0] : sp.sadad;
  const skipcashResult = Array.isArray(sp.skipcash) ? sp.skipcash[0] : sp.skipcash;
  const [storefront, order, checkout, visitorTheme] = await Promise.all([
    getStorefront(slug),
    getOrderForThankYou(orderId, slug),
    getStorefrontCheckoutSettings(slug),
    getServerTheme(),
  ]);
  if (!storefront || !order) notFound();

  const isAr = storefront.locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const paletteId = (storefront.themeOverrides.palette ?? storefront.palette) as PaletteId;
  const palette = palettes[paletteId] ?? palettes.sand_gold;
  const behaviour = storefront.themeOverrides.themeBehaviour ?? 'auto';
  const effectiveTheme: Theme =
    behaviour === 'light' ? 'light' : behaviour === 'dark' ? 'dark' : visitorTheme;
  const checkoutTheme = checkoutThemeForBackground(
    storefront.themeOverrides.pageBg,
    effectiveTheme,
  );

  const wrapperStyle: React.CSSProperties = {
    ...paletteCssVars(palette, checkoutTheme),
    background: storefront.themeOverrides.pageBg ?? 'var(--sf-ground)',
    color: 'var(--sf-ink)',
    minHeight: '100dvh',
    colorScheme: checkoutTheme,
  };

  const shortRef = shortenOrderId(order.id);
  const formatter = new Intl.DateTimeFormat(isAr ? 'ar-QA' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const placedAt = formatter.format(new Date(order.createdAt));
  const onlinePaymentFailed =
    order.paymentStatus === 'payment_failed' ||
    ((order.paymentMethod === 'sadad' || order.paymentMethod === 'skipcash') &&
      (sadadResult === 'failed' ||
        sadadResult === 'unverified' ||
        skipcashResult === 'failed' ||
        skipcashResult === 'cancelled'));
  const onlinePaymentPaid = order.paymentStatus === 'marked_paid';
  const onlinePaymentPending =
    (order.paymentMethod === 'skipcash' || order.paymentMethod === 'sadad') &&
    order.paymentStatus === 'unpaid' &&
    !onlinePaymentFailed;

  return (
    <div style={wrapperStyle} dir={dir}>
      <main
        style={{
          maxWidth: 'min(720px, 92vw)',
          marginInline: 'auto',
          padding: 'clamp(28px, 5vw, 56px) clamp(20px, 4vw, 32px) 96px',
        }}
      >
        <header style={{ marginBottom: 24 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--sf-accent, var(--color-gold-deep))',
            }}
          >
            ◈{' '}
            {onlinePaymentFailed
              ? isAr
                ? 'فشل الدفع'
                : 'Payment failed'
              : onlinePaymentPaid
                ? isAr
                  ? 'تم تأكيد الدفع'
                  : 'Payment confirmed'
                : onlinePaymentPending
                  ? isAr
                    ? 'بانتظار الدفع'
                    : 'Awaiting payment'
                  : isAr
                    ? 'تم استلام الطلب'
                    : 'Order received'}
          </div>
          <h1
            style={{
              margin: '12px 0 0',
              fontFamily: 'var(--font-serif, var(--font-sans))',
              fontWeight: 400,
              fontSize: 'clamp(26px, 4vw, 38px)',
              letterSpacing: '-0.01em',
            }}
          >
            {onlinePaymentFailed
              ? isAr
                ? 'لم يكتمل الدفع.'
                : 'Payment was not completed.'
              : onlinePaymentPending
                ? isAr
                  ? 'الدفع لم يكتمل بعد.'
                  : 'Payment is not complete yet.'
                : `${isAr ? 'شكراً، ' : 'Thank you, '}${order.customerName.split(' ')[0]}.`}
          </h1>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 14.5,
              lineHeight: 1.55,
              color: 'color-mix(in srgb, currentColor 65%, transparent)',
            }}
          >
            {onlinePaymentFailed
              ? isAr
                ? `لم يتم تأكيد طلبك لدى ${storefront.businessName} لأن الدفع لم ينجح. يمكنك المحاولة مرة أخرى أو التواصل مع المتجر.`
                : `Your order with ${storefront.businessName} was not confirmed because the payment did not succeed. You can try again or contact the store.`
              : onlinePaymentPending
                ? isAr
                  ? `طلبك لدى ${storefront.businessName} بانتظار تأكيد الدفع من مزود الخدمة.`
                  : `Your order with ${storefront.businessName} is waiting for payment confirmation from the provider.`
                : isAr
                  ? `تم تسجيل طلبك لدى ${storefront.businessName}. ستجد التفاصيل أدناه.`
                  : `Your order has been placed with ${storefront.businessName}. The details are below.`}
          </p>
        </header>

        <Surface>
          <RefRow label={isAr ? 'رقم الطلب' : 'Order reference'} value={shortRef} mono large />
          <RefRow label={isAr ? 'التاريخ' : 'Placed'} value={placedAt} />
        </Surface>

        <PaymentInstructions
          method={order.paymentMethod}
          paymentStatus={order.paymentStatus}
          paymentResult={
            onlinePaymentFailed
              ? 'failed'
              : onlinePaymentPaid
                ? 'paid'
                : onlinePaymentPending
                  ? 'pending'
                  : null
          }
          checkout={checkout}
          customerPhone={order.customerPhone}
          shortRef={shortRef}
          isAr={isAr}
        />

        <Surface heading={isAr ? 'العناصر' : 'Items'}>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {order.items.map((it) => (
              <li
                key={it.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  fontSize: 14,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{it.titleSnapshot}</div>
                  {it.variantLabel ? (
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                        color: 'color-mix(in srgb, currentColor 58%, transparent)',
                      }}
                    >
                      {isAr ? 'المقاس' : 'Size'}: {it.variantLabel}
                    </div>
                  ) : null}
                  {it.customInputs.height ? (
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                        color: 'color-mix(in srgb, currentColor 58%, transparent)',
                      }}
                    >
                      {it.customInputs.heightLabel || (isAr ? 'الطول' : 'Height')}:{' '}
                      {it.customInputs.height}
                    </div>
                  ) : null}
                  <div
                    style={{
                      marginTop: 2,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'color-mix(in srgb, currentColor 60%, transparent)',
                    }}
                  >
                    {isAr ? 'الكمية' : 'Qty'}: {it.quantity} · {order.currency}{' '}
                    {it.priceQarSnapshot}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {order.currency} {it.priceQarSnapshot * it.quantity}
                </div>
              </li>
            ))}
          </ul>

          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px dashed color-mix(in srgb, currentColor 18%, transparent)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              fontSize: 13,
            }}
          >
            <TotalRow
              label={isAr ? 'المجموع الفرعي' : 'Subtotal'}
              value={`${order.currency} ${order.subtotalQar}`}
            />
            <TotalRow
              label={isAr ? 'الشحن' : 'Shipping'}
              value={
                order.shippingQar === 0
                  ? isAr
                    ? 'مجاني'
                    : 'Free'
                  : `${order.currency} ${order.shippingQar}`
              }
            />
            {order.platformFeeQar > 0 ? (
              <TotalRow
                label={isAr ? 'رسوم سوقنا' : 'Souqna fee'}
                value={`${order.currency} ${order.platformFeeQar}`}
              />
            ) : null}
            <TotalRow
              strong
              label={isAr ? 'الإجمالي' : 'Total'}
              value={`${order.currency} ${order.totalQar}`}
            />
          </div>
        </Surface>

        <Surface heading={isAr ? 'تفاصيل التسليم' : 'Delivery details'}>
          <div style={{ fontSize: 14 }}>{order.customerName}</div>
          <div style={subtleStyle()}>{order.customerPhone}</div>
          {order.customerEmail ? <div style={subtleStyle()}>{order.customerEmail}</div> : null}
          {order.address ? (
            <div style={{ marginTop: 12, fontSize: 14 }}>
              <div>{order.address.line1}</div>
              {order.address.line2 ? <div style={subtleStyle()}>{order.address.line2}</div> : null}
              <div style={subtleStyle()}>
                {[order.address.area, order.address.city, order.address.zip]
                  .filter(Boolean)
                  .join(', ')}
              </div>
              <div style={subtleStyle()}>{order.address.country}</div>
            </div>
          ) : null}
        </Surface>

        <a
          href={onlinePaymentFailed || onlinePaymentPending ? '/checkout' : '/'}
          style={{
            display: 'inline-flex',
            marginTop: 24,
            padding: '11px 18px',
            borderRadius: 999,
            background: 'transparent',
            color: 'inherit',
            border: '1px solid color-mix(in srgb, currentColor 22%, transparent)',
            fontSize: 13.5,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          {onlinePaymentFailed || onlinePaymentPending
            ? onlinePaymentFailed
              ? isAr
                ? 'إعادة محاولة الدفع'
                : 'Retry payment'
              : isAr
                ? 'العودة للدفع'
                : 'Back to checkout'
            : isAr
              ? 'العودة للمتجر'
              : 'Back to the storefront'}
        </a>
      </main>
    </div>
  );
}

function Surface({ heading, children }: { heading?: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        marginTop: 16,
        padding: 18,
        borderRadius: 12,
        border: '1px solid color-mix(in srgb, currentColor 12%, transparent)',
        background: 'color-mix(in srgb, var(--sf-ink, currentColor) 3%, transparent)',
      }}
    >
      {heading ? (
        <h2
          style={{
            margin: '0 0 12px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 500,
            color: 'color-mix(in srgb, currentColor 60%, transparent)',
          }}
        >
          {heading}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

function RefRow({
  label,
  value,
  mono,
  large,
}: {
  label: string;
  value: string;
  mono?: boolean;
  large?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        padding: '6px 0',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'color-mix(in srgb, currentColor 60%, transparent)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: mono ? 'var(--font-mono)' : 'inherit',
          fontSize: large ? 18 : 13.5,
          fontWeight: large ? 600 : 500,
          letterSpacing: large ? '0.04em' : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        fontWeight: strong ? 600 : 400,
      }}
    >
      <span
        style={{
          color: strong ? undefined : 'color-mix(in srgb, currentColor 65%, transparent)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: strong ? 14 : 13,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function PaymentInstructions({
  method,
  paymentStatus,
  paymentResult,
  checkout,
  customerPhone,
  shortRef,
  isAr,
}: {
  method: 'cod' | 'bank_transfer' | 'skipcash' | 'sadad' | 'pay_link';
  paymentStatus: 'unpaid' | 'marked_paid' | 'payment_failed' | 'refunded';
  paymentResult: 'failed' | 'paid' | 'pending' | null;
  checkout: CheckoutSettings;
  customerPhone: string;
  shortRef: string;
  isAr: boolean;
}) {
  if (method === 'cod') {
    return (
      <Surface heading={isAr ? 'تعليمات الدفع' : 'Payment instructions'}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
          {isAr
            ? `سنتواصل معك على ${customerPhone} لتنسيق التسليم وتأكيد المبلغ.`
            : `We'll contact you on ${customerPhone} to arrange delivery and confirm the amount.`}
        </p>
      </Surface>
    );
  }
  if (method === 'bank_transfer' && checkout.bankDetails) {
    const b = checkout.bankDetails;
    return (
      <Surface heading={isAr ? 'تفاصيل الدفع' : 'Bank transfer details'}>
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 13.5,
            lineHeight: 1.55,
            color: 'color-mix(in srgb, currentColor 70%, transparent)',
          }}
        >
          {isAr
            ? 'يرجى استخدام رقم الطلب أدناه كمرجع للتحويل.'
            : 'Please include the order reference below in your transfer.'}
        </p>
        <dl
          style={{
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '6px 14px',
            fontSize: 13,
          }}
        >
          <Dt>Account</Dt>
          <Dd>{b.accountName}</Dd>
          <Dt>Bank</Dt>
          <Dd>{b.bankName}</Dd>
          <Dt>IBAN</Dt>
          <Dd mono>{b.iban}</Dd>
          {b.swift ? (
            <>
              <Dt>SWIFT</Dt>
              <Dd mono>{b.swift}</Dd>
            </>
          ) : null}
          <Dt>{isAr ? 'المرجع' : 'Reference'}</Dt>
          <Dd mono>{shortRef}</Dd>
          {b.notes ? (
            <>
              <Dt>{isAr ? 'ملاحظات' : 'Notes'}</Dt>
              <Dd>{b.notes}</Dd>
            </>
          ) : null}
        </dl>
      </Surface>
    );
  }
  if (method === 'pay_link' && checkout.payLink) {
    return (
      <Surface heading={isAr ? 'الدفع الإلكتروني' : 'Pay online'}>
        <p
          style={{
            margin: '0 0 14px',
            fontSize: 13.5,
            lineHeight: 1.55,
            color: 'color-mix(in srgb, currentColor 70%, transparent)',
          }}
        >
          {isAr
            ? 'سنقوم بتعليم طلبك كمدفوع بمجرد تأكيد عملية الدفع.'
            : "We'll mark your order as paid once we confirm payment."}
        </p>
        <a
          href={checkout.payLink.url}
          target="_blank"
          rel="noopener"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '12px 20px',
            borderRadius: 999,
            background: 'var(--sf-accent, var(--color-gold-deep))',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          {checkout.payLink.label}
        </a>
      </Surface>
    );
  }
  if (method === 'skipcash') {
    return (
      <Surface heading={isAr ? 'الدفع الإلكتروني' : 'Online payment'}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
          {paymentResult === 'failed' || paymentStatus === 'payment_failed'
            ? isAr
              ? 'لم تنجح عملية الدفع عبر SkipCash، لذلك لم يتم تأكيد الطلب.'
              : 'SkipCash did not complete the payment, so the order was not confirmed.'
            : paymentResult === 'paid' || paymentStatus === 'marked_paid'
              ? isAr
                ? 'تم تأكيد الدفع عبر SkipCash.'
                : 'Payment was confirmed through SkipCash.'
              : isAr
                ? 'تم إرسال الطلب عبر SkipCash. سنحدّث حالة الدفع بعد التأكيد.'
                : 'This order was sent through SkipCash. Payment status updates after confirmation.'}
        </p>
      </Surface>
    );
  }
  if (method === 'sadad') {
    return (
      <Surface heading={isAr ? 'الدفع الإلكتروني' : 'Online payment'}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
          {paymentResult === 'failed' || paymentStatus === 'payment_failed'
            ? isAr
              ? 'لم تنجح عملية الدفع عبر SADAD، لذلك لم يتم تأكيد الطلب.'
              : 'SADAD did not complete the payment, so the order was not confirmed.'
            : paymentResult === 'paid' || paymentStatus === 'marked_paid'
              ? isAr
                ? 'تم تأكيد الدفع عبر SADAD.'
                : 'Payment was confirmed through SADAD.'
              : isAr
                ? 'تم إرسال الطلب عبر SADAD. سنحدّث حالة الدفع بعد التأكيد.'
                : 'This order was sent through SADAD. Payment status updates after confirmation.'}
        </p>
      </Surface>
    );
  }
  return null;
}

function Dt({ children }: { children: React.ReactNode }) {
  return (
    <dt
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'color-mix(in srgb, currentColor 55%, transparent)',
      }}
    >
      {children}
    </dt>
  );
}

function Dd({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <dd
      style={{
        margin: 0,
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        fontSize: mono ? 12.5 : 13.5,
        wordBreak: mono ? 'break-all' : 'normal',
      }}
    >
      {children}
    </dd>
  );
}

function subtleStyle(): React.CSSProperties {
  return {
    fontSize: 13,
    color: 'color-mix(in srgb, currentColor 65%, transparent)',
  };
}

function shortenOrderId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}
