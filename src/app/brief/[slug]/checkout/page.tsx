import { notFound } from 'next/navigation';
import { getStorefront } from '@/lib/brief';
import {
  getStorefrontCheckoutSettings,
  getStorefrontPolicies,
} from '@/lib/storefrontSettings';
import { palettes, paletteCssVars, type PaletteId } from '@/lib/palettes';
import type { Theme } from '@/lib/theme';
import { getServerTheme } from '@/components/theme/ServerThemeScript';
import { CheckoutFlow } from '@/components/storefront/checkout/CheckoutFlow';
import { CartProvider } from '@/components/storefront/cart/CartContext';
import { storefrontBaseUrl } from '@/lib/storefrontUrl';
import { getPlan, platformFeeBpsForPlan } from '@/lib/billing';
import { checkoutThemeForBackground } from '@/lib/storefrontCheckoutTheme';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = { params: Promise<{ slug: string }> };

/**
 * Buyer checkout page rendered under the storefront subdomain
 * (`{slug}.souqna.qa/checkout`). Loads the storefront row + checkout
 * settings + policy snapshot server-side, then hands the rest to the
 * 4-step `<CheckoutFlow>` client component which reads the cart from
 * the provider mounted by `<StorefrontChrome>`.
 *
 * If checkout is disabled (no payment methods configured) we render a
 * graceful "not available yet" notice instead of a broken stepper.
 */
export default async function CheckoutPage({ params }: Props) {
  const { slug } = await params;
  const storefront = await getStorefront(slug);
  if (!storefront) notFound();
  if (!storefront.isPublished) notFound();

  const [rawCheckout, policies, visitorTheme, ownerPlan] = await Promise.all([
    getStorefrontCheckoutSettings(slug),
    getStorefrontPolicies(slug),
    getServerTheme(),
    getPlan(storefront.clerkUserId),
  ]);
  const checkout = {
    ...rawCheckout,
    paymentMethods: rawCheckout.paymentMethods.filter(
      (m) =>
        m !== 'pay_link' &&
        (m !== 'skipcash' || rawCheckout.skipCash?.enabled) &&
        (m !== 'sadad' || rawCheckout.sadad?.enabled),
    ),
    payLink: null,
  };

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

  const dir = storefront.locale === 'ar' ? 'rtl' : 'ltr';
  const isAr = storefront.locale === 'ar';

  if (checkout.paymentMethods.length === 0) {
    return (
      <div style={wrapperStyle} dir={dir}>
        <main
          style={{
            maxWidth: 640,
            marginInline: 'auto',
            padding: 'clamp(40px, 8vw, 96px) clamp(20px, 4vw, 32px)',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif, var(--font-sans))',
              fontWeight: 400,
              fontSize: 'clamp(24px, 4vw, 36px)',
              letterSpacing: '-0.01em',
            }}
          >
            {isAr ? 'الدفع غير متاح بعد' : 'Checkout not available yet'}
          </h1>
          <p
            style={{
              marginTop: 14,
              fontSize: 15,
              lineHeight: 1.6,
              color: 'color-mix(in srgb, currentColor 65%, transparent)',
            }}
          >
            {isAr
              ? `${storefront.businessName} لم يفعّل خيارات الدفع حتى الآن. يمكنك التواصل معنا مباشرة للطلب.`
              : `${storefront.businessName} hasn't switched on a payment method yet. You can still get in touch directly to place your order.`}
          </p>
          <a
            href="/"
            style={{
              display: 'inline-flex',
              marginTop: 24,
              padding: '11px 18px',
              borderRadius: 999,
              background: 'var(--sf-ink)',
              color: 'var(--sf-ground)',
              fontSize: 13.5,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            {isAr ? 'العودة للمتجر' : 'Back to the storefront'}
          </a>
        </main>
      </div>
    );
  }

  return (
    <div style={wrapperStyle} dir={dir}>
      <main
        style={{
          maxWidth: 'min(960px, 92vw)',
          marginInline: 'auto',
          padding: 'clamp(28px, 5vw, 56px) clamp(20px, 4vw, 32px) 96px',
        }}
      >
        <CartProvider
          storefrontSlug={slug}
          enabled={checkout.paymentMethods.length > 0}
          currency={checkout.currency}
        >
          <CheckoutFlow
            storefrontSlug={slug}
            storefrontBaseHref={storefrontBaseUrl(slug)}
            businessName={storefront.businessName}
            locale={storefront.locale}
            checkout={checkout}
            policies={policies}
            platformFeeBps={platformFeeBpsForPlan(ownerPlan)}
          />
        </CartProvider>
      </main>
    </div>
  );
}
