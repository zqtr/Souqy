'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCart } from '../cart/CartContext';
import {
  createOrder,
  previewCheckoutDiscount,
  type PreviewCheckoutDiscountResult,
} from '@/app/actions/checkout';
import type {
  CheckoutSettings,
  PaymentMethod,
  PolicyKey,
  StorefrontPolicies,
} from '@/lib/storefrontSettings';

/**
 * Buyer-facing 4-step checkout. Reads the cart from the storefront
 * `<CartProvider>` mounted by `<StorefrontChrome>`. Step state is held
 * locally; nothing is sent to the server until the buyer hits "Place
 * order" on the review step.
 *
 * Validation is intentionally light client-side — the server action is
 * the source of truth for every business rule (price, policy
 * enforcement, payment-method allow-list). We only block obviously
 * malformed input (empty required fields, non-phone-shaped phones)
 * here so the buyer doesn't waste a roundtrip.
 */

type StepId = 'contact' | 'address' | 'payment' | 'review';
const STEPS: { id: StepId; en: string; ar: string }[] = [
  { id: 'contact', en: 'Contact', ar: 'التواصل' },
  { id: 'address', en: 'Address', ar: 'العنوان' },
  { id: 'payment', en: 'Payment', ar: 'الدفع' },
  { id: 'review', en: 'Review', ar: 'المراجعة' },
];

type Contact = { name: string; phone: string; email: string };
type Address = {
  line1: string;
  line2: string;
  area: string;
  city: string;
  country: string;
  zip: string;
  notes: string;
};
type BuyerConsentState = {
  cookies: boolean;
  marketing: boolean;
};
type AppliedDiscount = Extract<PreviewCheckoutDiscountResult, { status: 'success' }>;

const ALWAYS_REQUIRED_POLICY_KEYS = [
  'terms',
  'privacy',
  'refund',
] as const satisfies readonly PolicyKey[];

const COUNTRIES = [
  'Qatar',
  'Saudi Arabia',
  'United Arab Emirates',
  'Kuwait',
  'Bahrain',
  'Oman',
  'United Kingdom',
  'United States',
  'Other',
] as const;

type Strings = ReturnType<typeof getStrings>;

const PROMO_COPY = {
  codeLabel: 'Promo code',
  placeholder: 'WELCOME10',
  apply: 'Apply',
  remove: 'Remove',
  discount: 'Discount',
  invalid: 'Could not apply code',
  applied: (code: string) => `${code} applied`,
};

function getStrings(locale: 'en' | 'ar') {
  if (locale === 'ar') {
    return {
      stepOf: (i: number, n: number) => `الخطوة ${i} من ${n}`,
      contactTitle: 'معلومات التواصل',
      contactSubtitle: 'كي نتمكن من التواصل بخصوص الطلب.',
      addressTitle: 'عنوان التسليم',
      addressSubtitle: 'العنوان الذي ستصل إليه الطلبية.',
      paymentTitle: 'طريقة الدفع',
      paymentSubtitle: 'اختر الطريقة الأنسب لك.',
      reviewTitle: 'مراجعة الطلب',
      reviewSubtitle: 'تحقق من تفاصيل طلبك قبل التأكيد.',
      back: 'السابق',
      next: 'التالي',
      placeOrder: 'تأكيد الطلب',
      placing: 'جارٍ الإرسال…',
      name: 'الاسم الكامل',
      phone: 'رقم الهاتف',
      email: 'البريد الإلكتروني (اختياري)',
      line1: 'العنوان',
      line2: 'تفاصيل إضافية',
      area: 'المنطقة',
      city: 'المدينة',
      country: 'الدولة',
      zip: 'الرمز البريدي',
      notes: 'ملاحظات للبائع',
      cod: 'الدفع عند الاستلام',
      bank: 'تحويل بنكي',
      payLink: 'الدفع الإلكتروني',
      skipCash: 'الدفع عبر SkipCash',
      sadad: 'الدفع عبر SADAD',
      copy: 'نسخ',
      copied: 'تم النسخ',
      requiredField: 'حقل مطلوب',
      invalidPhone: 'رقم هاتف غير صالح',
      invalidEmail: 'بريد إلكتروني غير صالح',
      acceptedPolicies: 'الموافقات المطلوبة',
      mustAccept: 'يرجى الموافقة على جميع البنود المطلوبة وإذن الرسائل قبل تأكيد الطلب.',
      consentTitle: 'موافقة الشراء',
      consentSubtitle: 'مطلوبة لكل طلب في سوقنا.',
      consentRequired: 'مطلوب',
      consentPolicyIntro: 'أوافق على',
      consentCookies:
        'أقبل استخدام ملفات تعريف الارتباط لحفظ السلة وتفضيلات المتجر وحماية عملية الدفع.',
      consentMarketing:
        'أوافق على استلام تحديثات الطلب وخدمة العملاء وعروض المتجر عبر SMS أو WhatsApp أو RCS.',
      consentFootnote: 'يتم حفظ هذه الموافقات مع الطلب حتى يعرف المتجر كيف يتواصل معك.',
      cartEmpty: 'سلتك فارغة.',
      goShop: 'العودة للمتجر',
      orderSummary: 'ملخص الطلب',
      subtotal: 'المجموع الفرعي',
      shipping: 'الشحن',
      total: 'الإجمالي',
      noShipping: 'مجاني',
      contactSummary: 'العميل',
      addressSummary: 'العنوان',
      paymentSummary: 'الدفع',
      qty: 'الكمية',
    };
  }
  return {
    stepOf: (i: number, n: number) => `Step ${i} of ${n}`,
    contactTitle: 'Contact details',
    contactSubtitle: 'So we can reach you about this order.',
    addressTitle: 'Delivery address',
    addressSubtitle: 'Where the order should arrive.',
    paymentTitle: 'Payment method',
    paymentSubtitle: 'Choose how you’d like to pay.',
    reviewTitle: 'Review your order',
    reviewSubtitle: 'Confirm the details before placing.',
    back: 'Back',
    next: 'Next',
    placeOrder: 'Place order',
    placing: 'Placing order…',
    name: 'Full name',
    phone: 'Phone number',
    email: 'Email (optional)',
    line1: 'Address',
    line2: 'Apartment, suite, etc.',
    area: 'Area / district',
    city: 'City',
    country: 'Country',
    zip: 'Postal code',
    notes: 'Notes for the seller',
    cod: 'Cash on delivery',
    bank: 'Bank transfer',
    payLink: 'Pay online',
    skipCash: 'Pay with SkipCash',
    sadad: 'Pay with SADAD',
    copy: 'Copy',
    copied: 'Copied',
    requiredField: 'Required',
    invalidPhone: 'Enter a valid phone number',
    invalidEmail: 'Enter a valid email',
    acceptedPolicies: 'Required agreements',
    mustAccept:
      'Please accept every required agreement and message opt-in before placing the order.',
    consentTitle: 'Checkout consent',
    consentSubtitle: 'Required for every Souqna order.',
    consentRequired: 'Required',
    consentPolicyIntro: 'I agree to the',
    consentCookies:
      'I accept cookies for cart memory, store preferences, fraud prevention, and checkout continuity.',
    consentMarketing:
      'I agree to receive order updates, customer care, and store offers by SMS, WhatsApp, or RCS.',
    consentFootnote:
      'These choices are saved with the order so the store knows how to contact you.',
    cartEmpty: 'Your cart is empty.',
    goShop: 'Back to the storefront',
    orderSummary: 'Order summary',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    total: 'Total',
    noShipping: 'Free',
    contactSummary: 'Customer',
    addressSummary: 'Address',
    paymentSummary: 'Payment',
    qty: 'Qty',
  };
}

export function CheckoutFlow({
  storefrontSlug,
  storefrontBaseHref,
  businessName,
  locale,
  checkout,
  policies,
}: {
  storefrontSlug: string;
  /**
   * Absolute URL of the storefront subdomain (e.g.
   * `https://shop.souqna.qa`). Computed server-side and threaded
   * through so policy-acceptance links resolve from any rendering
   * context (apex, dev, builder preview).
   */
  storefrontBaseHref: string;
  businessName: string;
  locale: 'en' | 'ar';
  checkout: CheckoutSettings;
  policies: StorefrontPolicies;
}) {
  const cart = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const t = getStrings(locale);
  const checkoutRootHref = checkoutRootHrefForPath(pathname, storefrontSlug);
  const policyBaseHref =
    checkoutRootHref === '/checkout' ? storefrontBaseHref : `/brief/${storefrontSlug}`;

  // Step machine. We validate as the buyer attempts to advance (not as
  // they type) so error live-regions only fire on intent.
  const [stepIdx, setStepIdx] = useState(0);
  const [contact, setContact] = useState<Contact>({ name: '', phone: '', email: '' });
  const [address, setAddress] = useState<Address>({
    line1: '',
    line2: '',
    area: '',
    city: '',
    country: 'Qatar',
    zip: '',
    notes: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    checkout.paymentMethods[0] ?? 'cod',
  );
  const [accepted, setAccepted] = useState<Record<PolicyKey, boolean>>({
    terms: false,
    privacy: false,
    refund: false,
    shipping: false,
  });
  const [buyerConsents, setBuyerConsents] = useState<BuyerConsentState>({
    cookies: false,
    marketing: false,
  });
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [pending, start] = useTransition();
  const [discountPending, startDiscount] = useTransition();
  const liveRegionRef = useRef<HTMLDivElement | null>(null);
  const cartSignature = cart.items
    .map((item) => `${item.productId}:${item.quantity}:${item.variantLabel ?? ''}`)
    .join('|');

  // Empty cart: bounce back to the storefront. We do this in an effect
  // so the cart can hydrate first — going off [].length === 0 at first
  // render would always redirect on initial mount.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    if (cart.items.length === 0 && !pending) {
      router.replace('/');
    }
  }, [cart.items.length, pending, router]);

  useEffect(() => {
    setAppliedDiscount(null);
    setDiscountError(null);
  }, [cartSignature]);

  const subtotal = cart.subtotalQar;
  const shipping = cart.items.length > 0 ? (checkout.shippingFlatQar ?? 0) : 0;
  const subtotalDiscount = appliedDiscount?.subtotalDiscountQar ?? 0;
  const shippingDiscount = appliedDiscount?.shippingDiscountQar ?? 0;
  const totalDiscount = appliedDiscount?.totalDiscountQar ?? 0;
  const discountedSubtotal = Math.max(subtotal - subtotalDiscount, 0);
  const discountedShipping = Math.max(shipping - shippingDiscount, 0);
  const total = discountedSubtotal + discountedShipping;

  function go(next: number) {
    setError(null);
    setStepIdx(next);
  }

  function tryAdvance() {
    const id = STEPS[stepIdx]!.id;
    if (id === 'contact') {
      const v = validateContact(contact, t);
      if (v) return setError(v);
    } else if (id === 'address') {
      const v = validateAddress(address, t);
      if (v) return setError(v);
    } else if (id === 'payment') {
      // Always valid: the radio always has one selection.
    }
    go(Math.min(stepIdx + 1, STEPS.length - 1));
  }

  function tryBack() {
    go(Math.max(stepIdx - 1, 0));
  }

  const requiredPolicyKeys = requiredCheckoutPolicies(checkout.requiredPolicies);
  const requiredAccepted =
    requiredPolicyKeys.every((p) => accepted[p]) &&
    buyerConsents.cookies &&
    buyerConsents.marketing;

  function applyPromoCode() {
    const code = promoCode.trim();
    setDiscountError(null);
    if (!code || cart.items.length === 0) {
      setAppliedDiscount(null);
      return;
    }

    startDiscount(async () => {
      const result = await previewCheckoutDiscount({
        slug: storefrontSlug,
        code,
        items: cart.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      });

      if (result.status === 'success') {
        setAppliedDiscount(result);
        setPromoCode(result.code);
        setDiscountError(null);
        return;
      }
      setAppliedDiscount(null);
      setDiscountError(result.message || PROMO_COPY.invalid);
    });
  }

  function removePromoCode() {
    setAppliedDiscount(null);
    setDiscountError(null);
    setPromoCode('');
  }

  function submit() {
    setError(null);
    if (cart.items.length === 0) {
      return setError({ message: t.cartEmpty, field: 'items' });
    }
    if (!requiredAccepted) {
      return setError({ message: t.mustAccept, field: 'acceptedPolicies' });
    }
    const acceptedKeys = requiredPolicyKeys.filter((k) => accepted[k]);
    if (buyerConsents.cookies) {
      document.cookie = 'souqna-checkout-consent=accepted; path=/; max-age=31536000; SameSite=Lax';
    }
    start(async () => {
      const result = await createOrder({
        slug: storefrontSlug,
        items: cart.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          variantLabel: it.variantLabel ?? null,
          customInputs: it.customInputs ?? {},
        })),
        customer: {
          name: contact.name.trim(),
          phone: contact.phone.trim(),
          email: contact.email.trim() === '' ? '' : contact.email.trim(),
        },
        address: {
          line1: address.line1.trim(),
          line2: address.line2.trim() || null,
          area: address.area.trim() || null,
          city: address.city.trim(),
          country: address.country.trim(),
          zip: address.zip.trim() || null,
          notes: address.notes.trim() || null,
        },
        paymentMethod,
        discountCode: appliedDiscount?.code ?? null,
        acceptedPolicies: acceptedKeys,
        consents: {
          terms: accepted.terms,
          privacy: accepted.privacy,
          refund: accepted.refund,
          cookies: buyerConsents.cookies,
          marketing: buyerConsents.marketing,
        },
        notes: address.notes.trim() === '' ? undefined : address.notes.trim(),
      });

      if (result.status === 'success') {
        if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
          return;
        }
        cart.clear();
        router.push(`${checkoutRootHref}/thank-you/${result.orderId}`);
        return;
      }
      setError({ message: result.message, field: result.field });
      const fieldStep = stepForField(result.field);
      if (fieldStep != null) setStepIdx(fieldStep);
    });
  }

  return (
    <div>
      <Stepper stepIdx={stepIdx} stepCount={STEPS.length} t={t} locale={locale} />

      <h1
        style={{
          margin: 0,
          fontFamily: 'var(--font-serif, var(--font-sans))',
          fontWeight: 400,
          fontSize: 'clamp(22px, 3vw, 30px)',
          letterSpacing: '-0.01em',
        }}
      >
        {businessName}
      </h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)',
          gap: 32,
          marginTop: 24,
        }}
        className="souqna-checkout-grid"
      >
        <ResponsiveGridStyle />
        <div>
          {STEPS[stepIdx]!.id === 'contact' && (
            <ContactStep contact={contact} setContact={setContact} t={t} error={error} />
          )}
          {STEPS[stepIdx]!.id === 'address' && (
            <AddressStep address={address} setAddress={setAddress} t={t} error={error} />
          )}
          {STEPS[stepIdx]!.id === 'payment' && (
            <PaymentStep
              checkout={checkout}
              method={paymentMethod}
              setMethod={setPaymentMethod}
              t={t}
              locale={locale}
            />
          )}
          {STEPS[stepIdx]!.id === 'review' && (
            <ReviewStep
              t={t}
              contact={contact}
              address={address}
              paymentMethod={paymentMethod}
              policies={policies}
              locale={locale}
              requiredPolicyKeys={requiredPolicyKeys}
              accepted={accepted}
              setAccepted={setAccepted}
              buyerConsents={buyerConsents}
              setBuyerConsents={setBuyerConsents}
              error={error}
              storefrontBaseHref={policyBaseHref}
            />
          )}

          <div
            ref={liveRegionRef}
            role="status"
            aria-live="polite"
            style={{
              marginTop: 16,
              minHeight: 20,
              fontSize: 13,
              color: 'var(--color-maroon, #8b3a3a)',
            }}
          >
            {error?.message ?? ''}
          </div>

          <nav
            aria-label="Checkout navigation"
            style={{
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={tryBack}
              disabled={stepIdx === 0 || pending}
              style={secondaryBtnStyle(stepIdx === 0 || pending)}
            >
              {t.back}
            </button>
            {STEPS[stepIdx]!.id !== 'review' ? (
              <button type="button" onClick={tryAdvance} style={primaryBtnStyle(false)}>
                {t.next}
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                style={primaryBtnStyle(pending)}
              >
                {pending ? t.placing : t.placeOrder}
              </button>
            )}
          </nav>
        </div>

        <OrderSummary
          t={t}
          items={cart.items}
          currency={checkout.currency}
          subtotal={subtotal}
          shipping={shipping}
          discount={totalDiscount}
          promoCode={promoCode}
          setPromoCode={setPromoCode}
          appliedDiscount={appliedDiscount}
          discountError={discountError}
          discountPending={discountPending}
          onApplyPromo={applyPromoCode}
          onRemovePromo={removePromoCode}
          total={total}
        />
      </div>
    </div>
  );
}

function ResponsiveGridStyle() {
  return (
    <style>{`
      @media (max-width: 760px) {
        .souqna-checkout-grid {
          grid-template-columns: minmax(0, 1fr) !important;
        }
      }
    `}</style>
  );
}

function Stepper({
  stepIdx,
  stepCount,
  t,
  locale,
}: {
  stepIdx: number;
  stepCount: number;
  t: Strings;
  locale: 'en' | 'ar';
}) {
  const pct = ((stepIdx + 1) / stepCount) * 100;
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        aria-hidden
        style={{
          height: 4,
          borderRadius: 999,
          background: 'color-mix(in srgb, var(--sf-ink, currentColor) 10%, transparent)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: 'var(--sf-accent, var(--color-gold-deep))',
            transition: 'width 240ms ease',
          }}
        />
      </div>
      <div
        style={{
          marginTop: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'color-mix(in srgb, currentColor 60%, transparent)',
        }}
      >
        <span>{t.stepOf(stepIdx + 1, stepCount)}</span>
        <span>
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              style={{
                marginInlineEnd: i < STEPS.length - 1 ? 6 : 0,
                color:
                  i === stepIdx
                    ? 'var(--sf-accent, var(--color-gold-deep))'
                    : i < stepIdx
                      ? 'color-mix(in srgb, currentColor 80%, transparent)'
                      : 'color-mix(in srgb, currentColor 40%, transparent)',
              }}
            >
              {locale === 'ar' ? s.ar : s.en}
              {i < STEPS.length - 1 ? <span aria-hidden> · </span> : null}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

function StepHeader({ id, title, subtitle }: { id: string; title: string; subtitle: string }) {
  return (
    <header style={{ marginBottom: 16 }}>
      <h2
        id={id}
        style={{
          margin: 0,
          fontFamily: 'var(--font-serif, var(--font-sans))',
          fontWeight: 400,
          fontSize: 22,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: '6px 0 0',
          fontSize: 13.5,
          color: 'color-mix(in srgb, currentColor 60%, transparent)',
        }}
      >
        {subtitle}
      </p>
    </header>
  );
}

function ContactStep({
  contact,
  setContact,
  t,
  error,
}: {
  contact: Contact;
  setContact: (c: Contact) => void;
  t: Strings;
  error: { message: string; field?: string } | null;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId}>
      <StepHeader id={titleId} title={t.contactTitle} subtitle={t.contactSubtitle} />
      <div style={fieldStackStyle()}>
        <Field
          label={t.name}
          value={contact.name}
          onChange={(v) => setContact({ ...contact, name: v })}
          required
          autoComplete="name"
          error={error?.field === 'customer.name' ? error.message : undefined}
        />
        <Field
          label={t.phone}
          value={contact.phone}
          onChange={(v) => setContact({ ...contact, phone: v })}
          required
          autoComplete="tel"
          inputMode="tel"
          error={error?.field === 'customer.phone' ? error.message : undefined}
        />
        <Field
          label={t.email}
          value={contact.email}
          onChange={(v) => setContact({ ...contact, email: v })}
          autoComplete="email"
          inputMode="email"
          error={error?.field === 'customer.email' ? error.message : undefined}
        />
      </div>
    </section>
  );
}

function AddressStep({
  address,
  setAddress,
  t,
  error,
}: {
  address: Address;
  setAddress: (a: Address) => void;
  t: Strings;
  error: { message: string; field?: string } | null;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId}>
      <StepHeader id={titleId} title={t.addressTitle} subtitle={t.addressSubtitle} />
      <div style={fieldStackStyle()}>
        <Field
          label={t.line1}
          value={address.line1}
          onChange={(v) => setAddress({ ...address, line1: v })}
          required
          autoComplete="address-line1"
          error={error?.field === 'address.line1' ? error.message : undefined}
        />
        <Field
          label={t.line2}
          value={address.line2}
          onChange={(v) => setAddress({ ...address, line2: v })}
          autoComplete="address-line2"
        />
        <div style={twoColStyle()}>
          <Field
            label={t.area}
            value={address.area}
            onChange={(v) => setAddress({ ...address, area: v })}
          />
          <Field
            label={t.city}
            value={address.city}
            onChange={(v) => setAddress({ ...address, city: v })}
            required
            autoComplete="address-level2"
            error={error?.field === 'address.city' ? error.message : undefined}
          />
        </div>
        <div style={twoColStyle()}>
          <SelectField
            label={t.country}
            value={address.country}
            onChange={(v) => setAddress({ ...address, country: v })}
            options={COUNTRIES.map((c) => ({ value: c, label: c }))}
            required
          />
          <Field
            label={t.zip}
            value={address.zip}
            onChange={(v) => setAddress({ ...address, zip: v })}
            autoComplete="postal-code"
          />
        </div>
        <Field
          label={t.notes}
          value={address.notes}
          onChange={(v) => setAddress({ ...address, notes: v })}
          textarea
        />
      </div>
    </section>
  );
}

function PaymentStep({
  checkout,
  method,
  setMethod,
  t,
  locale,
}: {
  checkout: CheckoutSettings;
  method: PaymentMethod;
  setMethod: (m: PaymentMethod) => void;
  t: Strings;
  locale: 'en' | 'ar';
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId}>
      <StepHeader id={titleId} title={t.paymentTitle} subtitle={t.paymentSubtitle} />
      <div role="radiogroup" aria-labelledby={titleId} style={fieldStackStyle()}>
        {checkout.paymentMethods.includes('cod') && (
          <PaymentCard
            id="cod"
            checked={method === 'cod'}
            onSelect={() => setMethod('cod')}
            title={t.cod}
          >
            <p style={paymentBodyStyle()}>
              {locale === 'ar'
                ? 'سنتواصل معك لتنسيق التسليم وتأكيد المبلغ.'
                : "We'll get in touch to arrange delivery and confirm the amount."}
            </p>
          </PaymentCard>
        )}
        {checkout.paymentMethods.includes('bank_transfer') && (
          <PaymentCard
            id="bank_transfer"
            checked={method === 'bank_transfer'}
            onSelect={() => setMethod('bank_transfer')}
            title={t.bank}
          >
            {checkout.bankDetails ? (
              <BankDetailsCard details={checkout.bankDetails} t={t} />
            ) : (
              <p style={paymentBodyStyle()}>—</p>
            )}
          </PaymentCard>
        )}
        {checkout.paymentMethods.includes('pay_link') && (
          <PaymentCard
            id="pay_link"
            checked={method === 'pay_link'}
            onSelect={() => setMethod('pay_link')}
            title={t.payLink}
          >
            {checkout.payLink ? (
              <div
                style={{
                  ...paymentBodyStyle(),
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: '1px solid color-mix(in srgb, currentColor 18%, transparent)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {checkout.payLink.label}
              </div>
            ) : null}
          </PaymentCard>
        )}
        {checkout.paymentMethods.includes('skipcash') && (
          <PaymentCard
            id="skipcash"
            checked={method === 'skipcash'}
            onSelect={() => setMethod('skipcash')}
            title={t.skipCash}
          >
            <p style={paymentBodyStyle()}>
              {locale === 'ar'
                ? 'سيتم تحويلك إلى SkipCash لإتمام الدفع بأمان.'
                : 'You will be redirected to SkipCash to complete payment securely.'}
            </p>
          </PaymentCard>
        )}
        {checkout.paymentMethods.includes('sadad') && (
          <PaymentCard
            id="sadad"
            checked={method === 'sadad'}
            onSelect={() => setMethod('sadad')}
            title={t.sadad}
          >
            <p style={paymentBodyStyle()}>
              {locale === 'ar'
                ? 'سيتم تحويلك إلى SADAD لإتمام الدفع بأمان.'
                : 'You will be redirected to SADAD to complete payment securely.'}
            </p>
          </PaymentCard>
        )}
      </div>
    </section>
  );
}

function PaymentCard({
  id,
  checked,
  onSelect,
  title,
  children,
}: {
  id: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: 16,
        borderRadius: 12,
        border: checked
          ? '1.5px solid var(--sf-accent, var(--color-gold-deep))'
          : '1px solid color-mix(in srgb, currentColor 14%, transparent)',
        background: checked
          ? 'color-mix(in srgb, var(--sf-accent, var(--color-gold-deep)) 6%, transparent)'
          : 'transparent',
        cursor: 'pointer',
      }}
    >
      <input
        type="radio"
        name="payment-method"
        value={id}
        checked={checked}
        onChange={onSelect}
        style={{ marginTop: 4 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>{title}</div>
        {children}
      </div>
    </label>
  );
}

function paymentBodyStyle(): React.CSSProperties {
  return {
    margin: 0,
    fontSize: 13.5,
    lineHeight: 1.55,
    color: 'color-mix(in srgb, currentColor 70%, transparent)',
  };
}

function BankDetailsCard({
  details,
  t,
}: {
  details: NonNullable<CheckoutSettings['bankDetails']>;
  t: Strings;
}) {
  return (
    <dl
      style={{
        margin: 0,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: '6px 12px',
        fontSize: 13,
      }}
    >
      <Detail label="Account" value={details.accountName} />
      <Detail label="Bank" value={details.bankName} />
      <Detail label="IBAN" value={details.iban} copyable t={t} />
      {details.swift ? <Detail label="SWIFT" value={details.swift} copyable t={t} /> : null}
      {details.notes ? <Detail label="Notes" value={details.notes} /> : null}
    </dl>
  );
}

function Detail({
  label,
  value,
  copyable,
  t,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  t?: Strings;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <dt
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'color-mix(in srgb, currentColor 55%, transparent)',
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 12.5,
          wordBreak: 'break-all',
        }}
      >
        {value}
      </dd>
      {copyable && t ? (
        <button
          type="button"
          onClick={() => {
            try {
              void navigator.clipboard?.writeText(value);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            } catch {
              setCopied(false);
            }
          }}
          aria-label={`${t.copy} ${label}`}
          style={{
            justifySelf: 'end',
            padding: '2px 8px',
            borderRadius: 6,
            background: 'transparent',
            border: '1px solid color-mix(in srgb, currentColor 18%, transparent)',
            color: 'inherit',
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            cursor: 'pointer',
          }}
        >
          {copied ? t.copied : t.copy}
        </button>
      ) : (
        <span />
      )}
    </>
  );
}

function ReviewStep({
  t,
  contact,
  address,
  paymentMethod,
  policies,
  locale,
  requiredPolicyKeys,
  accepted,
  setAccepted,
  buyerConsents,
  setBuyerConsents,
  error,
  storefrontBaseHref,
}: {
  t: Strings;
  contact: Contact;
  address: Address;
  paymentMethod: PaymentMethod;
  policies: StorefrontPolicies;
  locale: 'en' | 'ar';
  requiredPolicyKeys: PolicyKey[];
  accepted: Record<PolicyKey, boolean>;
  setAccepted: (a: Record<PolicyKey, boolean>) => void;
  buyerConsents: BuyerConsentState;
  setBuyerConsents: (a: BuyerConsentState) => void;
  error: { message: string; field?: string } | null;
  storefrontBaseHref: string;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId}>
      <StepHeader id={titleId} title={t.reviewTitle} subtitle={t.reviewSubtitle} />

      <ReviewBlock label={t.contactSummary}>
        <div>{contact.name}</div>
        <div style={subtleStyle()}>{contact.phone}</div>
        {contact.email ? <div style={subtleStyle()}>{contact.email}</div> : null}
      </ReviewBlock>

      <ReviewBlock label={t.addressSummary}>
        <div>{address.line1}</div>
        {address.line2 ? <div style={subtleStyle()}>{address.line2}</div> : null}
        <div style={subtleStyle()}>
          {[address.area, address.city, address.zip].filter(Boolean).join(', ')}
        </div>
        <div style={subtleStyle()}>{address.country}</div>
      </ReviewBlock>

      <ReviewBlock label={t.paymentSummary}>
        <div>
          {paymentMethod === 'cod'
            ? t.cod
            : paymentMethod === 'bank_transfer'
              ? t.bank
              : paymentMethod === 'skipcash'
                ? t.skipCash
                : paymentMethod === 'sadad'
                  ? t.sadad
                  : t.payLink}
        </div>
      </ReviewBlock>

      <BuyerConsentCard
        t={t}
        locale={locale}
        policies={policies}
        policyKeys={requiredPolicyKeys}
        accepted={accepted}
        setAccepted={setAccepted}
        buyerConsents={buyerConsents}
        setBuyerConsents={setBuyerConsents}
        storefrontBaseHref={storefrontBaseHref}
        invalid={error?.field === 'acceptedPolicies'}
      />
    </section>
  );
}

function BuyerConsentCard({
  t,
  locale,
  policies,
  policyKeys,
  accepted,
  setAccepted,
  buyerConsents,
  setBuyerConsents,
  storefrontBaseHref,
  invalid,
}: {
  t: Strings;
  locale: 'en' | 'ar';
  policies: StorefrontPolicies;
  policyKeys: PolicyKey[];
  accepted: Record<PolicyKey, boolean>;
  setAccepted: (a: Record<PolicyKey, boolean>) => void;
  buyerConsents: BuyerConsentState;
  setBuyerConsents: (a: BuyerConsentState) => void;
  storefrontBaseHref: string;
  invalid: boolean;
}) {
  return (
    <fieldset
      aria-invalid={invalid ? true : undefined}
      className="sq-checkout-consent-card"
      style={{
        marginTop: 24,
        padding: 0,
        border: invalid
          ? '1.5px solid var(--color-maroon, #8b3a3a)'
          : '1px solid color-mix(in srgb, var(--sf-accent, var(--color-gold-deep)) 35%, transparent)',
        borderRadius: 18,
        overflow: 'hidden',
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--sf-accent, #b8892d) 16%, var(--sf-ground, #f7efe2)), color-mix(in srgb, var(--sf-ground, #f7efe2) 92%, transparent))',
        boxShadow: '0 18px 44px color-mix(in srgb, var(--sf-ink, #23170f) 12%, transparent)',
      }}
    >
      <legend className="sr-only">{t.acceptedPolicies}</legend>
      <div
        style={{
          padding: '18px 18px 14px',
          borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div className="sq-consent-glow" aria-hidden />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'flex-start',
            position: 'relative',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'color-mix(in srgb, var(--sf-accent, #b8892d) 84%, currentColor)',
              }}
            >
              {t.consentRequired}
            </div>
            <h3
              style={{
                margin: '6px 0 0',
                fontFamily: 'var(--font-serif, var(--font-sans))',
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              {t.consentTitle}
            </h3>
            <p style={{ margin: '6px 0 0', ...subtleStyle() }}>{t.consentSubtitle}</p>
          </div>
          <div className="sq-consent-orbit" aria-hidden>
            <span />
            <span />
          </div>
        </div>
      </div>
      <div style={{ padding: 14, display: 'grid', gap: 10 }}>
        {policyKeys.map((policyKey) => (
          <PolicyCheckbox
            key={policyKey}
            policyKey={policyKey}
            checked={accepted[policyKey]}
            policyLabel={humanPolicyLabel(policyKey, locale)}
            hasContent={Boolean(policies[policyKey])}
            intro={t.consentPolicyIntro}
            storefrontBaseHref={storefrontBaseHref}
            onToggle={(v) =>
              setAccepted({ ...accepted, [policyKey]: v } as Record<PolicyKey, boolean>)
            }
          />
        ))}
        <ConsentCheckbox
          checked={buyerConsents.cookies}
          label={t.consentCookies}
          onToggle={(v) => setBuyerConsents({ ...buyerConsents, cookies: v })}
        />
        <ConsentCheckbox
          checked={buyerConsents.marketing}
          label={t.consentMarketing}
          onToggle={(v) => setBuyerConsents({ ...buyerConsents, marketing: v })}
        />
        <p
          style={{
            margin: '4px 4px 0',
            fontSize: 12.5,
            lineHeight: 1.5,
            color: 'color-mix(in srgb, currentColor 62%, transparent)',
          }}
        >
          {t.consentFootnote}
        </p>
      </div>
      <ConsentStyles />
    </fieldset>
  );
}

function PolicyCheckbox({
  policyKey,
  checked,
  policyLabel,
  hasContent,
  intro,
  storefrontBaseHref,
  onToggle,
}: {
  policyKey: PolicyKey;
  checked: boolean;
  policyLabel: string;
  hasContent: boolean;
  intro: string;
  storefrontBaseHref: string;
  onToggle: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <ConsentCheckboxShell id={id} checked={checked} onToggle={onToggle}>
      <span>
        {intro}{' '}
        <a
          href={`${storefrontBaseHref}/${policyKey}`}
          target="_blank"
          rel="noopener"
          style={{
            color: 'inherit',
            textDecoration: 'underline',
            textDecorationThickness: 1,
            textUnderlineOffset: 3,
          }}
        >
          {policyLabel}
        </a>
        .
        {!hasContent ? (
          <span style={{ color: 'color-mix(in srgb, currentColor 55%, transparent)' }}> </span>
        ) : null}
      </span>
    </ConsentCheckboxShell>
  );
}

function ConsentCheckbox({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <ConsentCheckboxShell id={id} checked={checked} onToggle={onToggle}>
      <span>{label}</span>
    </ConsentCheckboxShell>
  );
}

function ConsentCheckboxShell({
  id,
  checked,
  onToggle,
  children,
}: {
  id: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="sq-consent-row">
      <input
        id={id}
        className="sq-consent-input"
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <span className="sq-consent-box" aria-hidden />
      <span className="sq-consent-copy">{children}</span>
    </label>
  );
}

function ConsentStyles() {
  return (
    <style>{`
      .sq-consent-row {
        position: relative;
        display: grid;
        grid-template-columns: 30px minmax(0, 1fr);
        gap: 12px;
        align-items: flex-start;
        padding: 12px;
        border-radius: 14px;
        border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        background: color-mix(in srgb, var(--sf-ground, #fff7ec) 62%, transparent);
        cursor: pointer;
        transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
      }
      .sq-consent-row:hover {
        transform: translateY(-1px);
        border-color: color-mix(in srgb, var(--sf-accent, #b8892d) 48%, transparent);
      }
      .sq-consent-input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }
      .sq-consent-box {
        width: 26px;
        height: 26px;
        border-radius: 9px;
        border: 1.5px solid color-mix(in srgb, currentColor 28%, transparent);
        background:
          radial-gradient(circle at 34% 30%, rgba(255,255,255,.72), transparent 30%),
          color-mix(in srgb, var(--sf-ground, #f8ead4) 86%, transparent);
        box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--sf-ground, #fff) 70%, transparent);
        position: relative;
        transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
      }
      .sq-consent-box::after {
        content: "";
        position: absolute;
        left: 8px;
        top: 4px;
        width: 7px;
        height: 14px;
        border: solid var(--sf-ground, #fff7ec);
        border-width: 0 2px 2px 0;
        transform: rotate(42deg) scale(0);
        transform-origin: center;
        opacity: 0;
        transition: transform 180ms cubic-bezier(.2,1.4,.38,1), opacity 140ms ease;
      }
      .sq-consent-input:checked + .sq-consent-box {
        border-color: color-mix(in srgb, var(--sf-accent, #b8892d) 88%, currentColor);
        background:
          linear-gradient(135deg, var(--sf-accent, #b8892d), color-mix(in srgb, var(--sf-accent, #b8892d) 64%, #4b1f2a));
        transform: scale(1.04);
        animation: sqConsentPop 260ms ease;
      }
      .sq-consent-input:checked + .sq-consent-box::after {
        opacity: 1;
        transform: rotate(42deg) scale(1);
      }
      .sq-consent-input:focus-visible + .sq-consent-box {
        outline: 2px solid color-mix(in srgb, var(--sf-accent, #b8892d) 62%, transparent);
        outline-offset: 3px;
      }
      .sq-consent-copy {
        font-size: 13.5px;
        line-height: 1.5;
        min-width: 0;
      }
      .sq-consent-glow {
        position: absolute;
        inset: -60px -80px auto auto;
        width: 180px;
        height: 180px;
        border-radius: 999px;
        background: radial-gradient(circle, color-mix(in srgb, var(--sf-accent, #b8892d) 30%, transparent), transparent 64%);
        animation: sqConsentGlow 4.8s ease-in-out infinite;
        pointer-events: none;
      }
      .sq-consent-orbit {
        width: 48px;
        height: 48px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--sf-accent, #b8892d) 42%, transparent);
        position: relative;
        flex: 0 0 auto;
      }
      .sq-consent-orbit span {
        position: absolute;
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: var(--sf-accent, #b8892d);
        top: 19px;
        left: 19px;
        transform-origin: 5px 5px;
        animation: sqConsentOrbit 3.2s linear infinite;
      }
      .sq-consent-orbit span + span {
        animation-delay: -1.6s;
        opacity: .55;
      }
      @keyframes sqConsentPop {
        0% { transform: scale(.86); }
        70% { transform: scale(1.1); }
        100% { transform: scale(1.04); }
      }
      @keyframes sqConsentGlow {
        0%, 100% { opacity: .45; transform: translate3d(0,0,0); }
        50% { opacity: .9; transform: translate3d(-12px, 10px, 0); }
      }
      @keyframes sqConsentOrbit {
        from { transform: rotate(0deg) translateX(22px) rotate(0deg); }
        to { transform: rotate(360deg) translateX(22px) rotate(-360deg); }
      }
      @media (prefers-reduced-motion: reduce) {
        .sq-consent-row,
        .sq-consent-box,
        .sq-consent-box::after,
        .sq-consent-glow,
        .sq-consent-orbit span {
          animation: none !important;
          transition: none !important;
        }
      }
    `}</style>
  );
}

function humanPolicyLabel(k: PolicyKey, locale: 'en' | 'ar'): string {
  if (locale === 'ar') {
    switch (k) {
      case 'terms':
        return 'شروط الخدمة';
      case 'privacy':
        return 'سياسة الخصوصية';
      case 'refund':
        return 'سياسة الاسترجاع';
      case 'shipping':
        return 'سياسة الشحن';
    }
  }
  switch (k) {
    case 'terms':
      return 'Terms of service';
    case 'privacy':
      return 'Privacy policy';
    case 'refund':
      return 'Refund policy';
    case 'shipping':
      return 'Shipping policy';
  }
}

function requiredCheckoutPolicies(configured: PolicyKey[]): PolicyKey[] {
  const merged = [...ALWAYS_REQUIRED_POLICY_KEYS, ...configured];
  return merged.filter((policy, index) => merged.indexOf(policy) === index);
}

function ReviewBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        border: '1px solid color-mix(in srgb, currentColor 12%, transparent)',
        marginBottom: 10,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'color-mix(in srgb, currentColor 60%, transparent)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

function PromoCodeControl({
  currency,
  promoCode,
  setPromoCode,
  appliedDiscount,
  discountError,
  discountPending,
  disabled,
  onApplyPromo,
  onRemovePromo,
}: {
  currency: string;
  promoCode: string;
  setPromoCode: (code: string) => void;
  appliedDiscount: AppliedDiscount | null;
  discountError: string | null;
  discountPending: boolean;
  disabled: boolean;
  onApplyPromo: () => void;
  onRemovePromo: () => void;
}) {
  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 12,
        borderTop: '1px dashed color-mix(in srgb, currentColor 14%, transparent)',
      }}
    >
      <label
        htmlFor="souqna-promo-code"
        style={{
          display: 'block',
          marginBottom: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'color-mix(in srgb, currentColor 58%, transparent)',
        }}
      >
        {PROMO_COPY.codeLabel}
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          id="souqna-promo-code"
          value={promoCode}
          onChange={(event) => {
            setPromoCode(event.target.value.toUpperCase().replace(/\s+/g, ''));
          }}
          placeholder={PROMO_COPY.placeholder}
          disabled={disabled || discountPending || appliedDiscount !== null}
          style={{
            minWidth: 0,
            flex: 1,
            height: 38,
            borderRadius: 10,
            border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
            background: 'color-mix(in srgb, var(--sf-ground, transparent) 86%, white 14%)',
            color: 'inherit',
            padding: '0 10px',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            textTransform: 'uppercase',
            outline: 'none',
          }}
        />
        {appliedDiscount ? (
          <button type="button" onClick={onRemovePromo} style={promoButtonStyle(false)}>
            {PROMO_COPY.remove}
          </button>
        ) : (
          <button
            type="button"
            onClick={onApplyPromo}
            disabled={disabled || discountPending || !promoCode.trim()}
            style={promoButtonStyle(disabled || discountPending || !promoCode.trim())}
          >
            {discountPending ? '...' : PROMO_COPY.apply}
          </button>
        )}
      </div>
      {appliedDiscount ? (
        <p style={promoMessageStyle('success')}>
          {PROMO_COPY.applied(appliedDiscount.code)} · - {currency}{' '}
          {appliedDiscount.totalDiscountQar}
        </p>
      ) : discountError ? (
        <p style={promoMessageStyle('error')}>{discountError}</p>
      ) : null}
    </div>
  );
}

function OrderSummary({
  t,
  items,
  currency,
  subtotal,
  shipping,
  discount,
  promoCode,
  setPromoCode,
  appliedDiscount,
  discountError,
  discountPending,
  onApplyPromo,
  onRemovePromo,
  total,
}: {
  t: Strings;
  items: ReturnType<typeof useCart>['items'];
  currency: string;
  subtotal: number;
  shipping: number;
  discount: number;
  promoCode: string;
  setPromoCode: (code: string) => void;
  appliedDiscount: AppliedDiscount | null;
  discountError: string | null;
  discountPending: boolean;
  onApplyPromo: () => void;
  onRemovePromo: () => void;
  total: number;
}) {
  return (
    <aside
      aria-label={t.orderSummary}
      style={{
        padding: 18,
        borderRadius: 12,
        border: '1px solid color-mix(in srgb, currentColor 12%, transparent)',
        background: 'color-mix(in srgb, var(--sf-ink, currentColor) 3%, transparent)',
        height: 'fit-content',
        position: 'sticky',
        top: 24,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'color-mix(in srgb, currentColor 60%, transparent)',
        }}
      >
        {t.orderSummary}
      </h2>

      <ul
        style={{
          listStyle: 'none',
          margin: '12px 0 0',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {items.length === 0 ? (
          <li style={{ margin: 0, fontSize: 13, ...subtleStyle() }}>{t.cartEmpty}</li>
        ) : null}
        {items.map((it) => (
          <li
            key={it.lineId}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13 }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={it.title}
              >
                {it.title}
              </div>
              {it.variantLabel ? (
                <div
                  style={{
                    marginTop: 2,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'color-mix(in srgb, currentColor 58%, transparent)',
                  }}
                >
                  Size: {it.variantLabel}
                </div>
              ) : null}
              {it.customInputs?.height ? (
                <div
                  style={{
                    marginTop: 2,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'color-mix(in srgb, currentColor 58%, transparent)',
                  }}
                >
                  {it.customInputs.heightLabel || 'Height'}: {it.customInputs.height}
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
                {t.qty}: {it.quantity} · {currency} {it.priceQar}
              </div>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12.5,
                fontWeight: 500,
              }}
            >
              {currency} {it.priceQar * it.quantity}
            </div>
          </li>
        ))}
      </ul>

      <PromoCodeControl
        currency={currency}
        promoCode={promoCode}
        setPromoCode={setPromoCode}
        appliedDiscount={appliedDiscount}
        discountError={discountError}
        discountPending={discountPending}
        disabled={items.length === 0}
        onApplyPromo={onApplyPromo}
        onRemovePromo={onRemovePromo}
      />

      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: '1px dashed color-mix(in srgb, currentColor 18%, transparent)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontSize: 13,
        }}
      >
        <Row label={t.subtotal} value={`${currency} ${subtotal}`} />
        <Row label={t.shipping} value={shipping === 0 ? t.noShipping : `${currency} ${shipping}`} />
        {discount > 0 ? (
          <Row label={PROMO_COPY.discount} value={`- ${currency} ${discount}`} />
        ) : null}
        <Row strong label={t.total} value={`${currency} ${total}`} />
      </div>
    </aside>
  );
}

function promoButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 76,
    height: 38,
    borderRadius: 10,
    border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
    background: disabled
      ? 'color-mix(in srgb, currentColor 8%, transparent)'
      : 'var(--sf-ink, #111)',
    color: disabled
      ? 'color-mix(in srgb, currentColor 45%, transparent)'
      : 'var(--sf-ground, #fff)',
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function promoMessageStyle(kind: 'success' | 'error'): React.CSSProperties {
  return {
    margin: '7px 0 0',
    fontSize: 12,
    color:
      kind === 'success'
        ? 'color-mix(in srgb, currentColor 68%, transparent)'
        : 'var(--color-maroon, #8b3a3a)',
  };
}

function checkoutRootHrefForPath(pathname: string | null, storefrontSlug: string): string {
  const localRoot = `/brief/${storefrontSlug}/checkout`;
  const path = pathname ?? '';
  return path === localRoot || path.startsWith(`${localRoot}/`) ? localRoot : '/checkout';
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
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

function Field({
  label,
  value,
  onChange,
  required,
  autoComplete,
  inputMode,
  textarea,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric';
  textarea?: boolean;
  error?: string;
}) {
  const id = useId();
  const errorId = error ? `${id}-err` : undefined;
  const Tag = textarea ? 'textarea' : 'input';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label htmlFor={id} style={labelStyle()}>
        {label}
        {required ? (
          <span
            aria-hidden
            style={{
              marginInlineStart: 4,
              color: 'var(--color-maroon, #8b3a3a)',
            }}
          >
            ●
          </span>
        ) : null}
      </label>
      <Tag
        id={id}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          onChange(e.target.value)
        }
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        rows={textarea ? 3 : undefined}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={errorId}
        style={inputStyle(Boolean(error))}
      />
      {error ? (
        <span
          id={errorId}
          role="alert"
          style={{ fontSize: 12, color: 'var(--color-maroon, #8b3a3a)' }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  const id = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label htmlFor={id} style={labelStyle()}>
        {label}
        {required ? (
          <span
            aria-hidden
            style={{
              marginInlineStart: 4,
              color: 'var(--color-maroon, #8b3a3a)',
            }}
          >
            ●
          </span>
        ) : null}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle(false)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function labelStyle(): React.CSSProperties {
  return {
    fontSize: 12.5,
    fontWeight: 500,
    color: 'color-mix(in srgb, currentColor 75%, transparent)',
  };
}

function inputStyle(invalid: boolean): React.CSSProperties {
  return {
    appearance: 'none',
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: invalid
      ? '1.5px solid var(--color-maroon, #8b3a3a)'
      : '1px solid color-mix(in srgb, currentColor 18%, transparent)',
    background: 'var(--sf-ground, var(--surface-bg))',
    color: 'inherit',
    fontFamily: 'inherit',
    fontSize: 14,
    boxSizing: 'border-box',
  };
}

function fieldStackStyle(): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  };
}

function twoColStyle(): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  };
}

function subtleStyle(): React.CSSProperties {
  return { color: 'color-mix(in srgb, currentColor 65%, transparent)', fontSize: 13 };
}

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '11px 20px',
    borderRadius: 999,
    background: 'var(--sf-ink, var(--ink-strong))',
    color: 'var(--sf-ground, var(--surface-bg))',
    border: 'none',
    fontSize: 13.5,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

function secondaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '10px 16px',
    borderRadius: 999,
    background: 'transparent',
    color: 'inherit',
    border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

function validateContact(c: Contact, t: Strings) {
  if (!c.name.trim()) return { message: t.requiredField, field: 'customer.name' };
  if (!c.phone.trim()) return { message: t.requiredField, field: 'customer.phone' };
  if (!/^[+\d][\d\s\-()]{2,}$/.test(c.phone.trim())) {
    return { message: t.invalidPhone, field: 'customer.phone' };
  }
  if (c.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) {
    return { message: t.invalidEmail, field: 'customer.email' };
  }
  return null;
}

function validateAddress(a: Address, t: Strings) {
  if (!a.line1.trim()) return { message: t.requiredField, field: 'address.line1' };
  if (!a.city.trim()) return { message: t.requiredField, field: 'address.city' };
  if (!a.country.trim()) return { message: t.requiredField, field: 'address.country' };
  return null;
}

function stepForField(field?: string): number | null {
  if (!field) return null;
  if (field.startsWith('customer.')) return 0;
  if (field.startsWith('address.')) return 1;
  if (field === 'paymentMethod') return 2;
  if (field === 'acceptedPolicies' || field === 'items') return 3;
  return null;
}
