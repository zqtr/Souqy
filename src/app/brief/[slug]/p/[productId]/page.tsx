import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { getStorefront, type Storefront as StorefrontData } from '@/lib/brief';
import { getProduct, getPublicProducts, type Product } from '@/lib/products';
import { getStorefrontCategoryProductMap } from '@/lib/categories';
import { listInstalledApps } from '@/lib/apps/installed';
import { getServerTheme } from '@/components/theme/ServerThemeScript';
import {
  getStorefrontPolicies,
  POLICY_KEYS,
  type PolicyKey,
  type StorefrontPolicies,
} from '@/lib/storefrontSettings';
import { listPages, type StorefrontPage } from '@/lib/storefrontPages';
import type {
  ChromeLegalPolicy,
  ChromeNavPage,
} from '@/components/storefront/StorefrontChrome';
import { Storefront } from '@/components/storefront/Storefront';
import { TrackPageView } from '@/components/storefront/TrackPageView';
import { AddToCartButton } from '@/components/storefront/cart/AddToCartButton';
import { PriceText, formatMonthlyPrice, formatPrice } from '@/components/storefront/blocks/helpers';
import { normaliseSettings as normaliseWhatsApp, whatsappDigits } from '@/lib/apps/whatsapp';
import { getPlan, planUnlocksBrandingRemoval } from '@/lib/billing';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = { params: Promise<{ slug: string; productId: string }> };

function deriveNavPages(pages: StorefrontPage[]): ChromeNavPage[] {
  return pages
    .filter((p) => p.showInNav && !p.isHome && p.status === 'published')
    .map((p) => ({ slug: p.slug, title: p.title }));
}

function localizedPolicyTitle(key: PolicyKey, locale: StorefrontData['locale']) {
  const en: Record<PolicyKey, string> = {
    terms: 'Terms',
    privacy: 'Privacy',
    refund: 'Refunds',
    shipping: 'Shipping',
  };
  const ar: Record<PolicyKey, string> = {
    terms: 'الشروط',
    privacy: 'الخصوصية',
    refund: 'الاسترجاع',
    shipping: 'الشحن',
  };
  return locale === 'ar' ? ar[key] : en[key];
}

function deriveLegalPolicies(
  policies: StorefrontPolicies,
  locale: StorefrontData['locale'],
): ChromeLegalPolicy[] {
  return POLICY_KEYS.filter((key) => {
    const body = policies[key];
    return typeof body === 'string' && body.trim().length > 0;
  }).map((key) => ({ key, title: localizedPolicyTitle(key, locale) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, productId } = await params;
  const [storefront, product] = await Promise.all([
    getStorefront(slug).catch(() => null),
    getProduct(slug, productId).catch(() => null),
  ]);

  if (!storefront || !product || product.status === 'draft') {
    return { title: 'Product · Souqna', robots: { index: false, follow: false } };
  }

  return {
    title: `${product.title} · ${storefront.businessName}`,
    description: product.description ?? storefront.tagline ?? storefront.businessName,
    ...(product.imageUrl ? { openGraph: { images: [product.imageUrl] } } : {}),
    robots: { index: false, follow: false },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug, productId } = await params;
  const storefront = await getStorefront(slug).catch(() => null);
  if (!storefront || !storefront.isPublished) notFound();

  const [product, products, visitorTheme, installed, categoriesBySlug, allPages, policies, ownerPlan] =
    await Promise.all([
      getProduct(slug, productId).catch(() => null),
      getPublicProducts(slug),
      getServerTheme(),
      listInstalledApps(slug).catch(() => []),
      getStorefrontCategoryProductMap(slug).catch(() => new Map<string, Set<string>>()),
      listPages(slug).catch(() => [] as StorefrontPage[]),
      getStorefrontPolicies(slug),
      getPlan(storefront.clerkUserId),
    ]);

  if (!product || product.status === 'draft') notFound();

  const installedAppIds = installed.filter((a) => a.enabled).map((a) => a.appId);
  const whatsapp = installed.find(
    (app) => app.enabled && app.appId === 'whatsapp-business',
  );
  const whatsappSettings = whatsapp ? normaliseWhatsApp(whatsapp.settings) : null;
  const whatsappPhone = whatsappSettings?.storefrontInquiryMode === 'whatsapp'
    ? whatsappDigits(whatsapp)
    : null;
  const storefrontData = whatsappPhone ? { ...storefront, phone: whatsappPhone } : storefront;

  return (
    <>
      <TrackPageView storefrontSlug={slug} />
      <TrackPageView storefrontSlug={slug} kind="product_view" productId={product.id} />
      <Storefront
        data={storefrontData}
        products={products}
        visitorTheme={visitorTheme}
        installedApps={installedAppIds}
        categoriesBySlug={categoriesBySlug}
        navPages={deriveNavPages(allPages)}
        legalPolicies={deriveLegalPolicies(policies, storefront.locale)}
        overrideMain={<ProductDetail storefront={storefrontData} product={product} />}
        showSouqnaSignature={!planUnlocksBrandingRemoval(ownerPlan)}
      />
    </>
  );
}

function ProductDetail({
  storefront,
  product,
}: {
  storefront: StorefrontData;
  product: Product;
}) {
  const isRtl = storefront.locale === 'ar';
  const isSoldOut = product.status === 'sold_out';
  const isMonthly =
    product.pricingMode === 'monthly_payment' && typeof product.monthlyPriceQar === 'number';
  const displayPrice = isMonthly ? product.monthlyPriceQar : product.priceQar;
  const hasPrice = typeof displayPrice === 'number';
  const canCart = !isSoldOut && hasPrice;
  const priceText =
    hasPrice && isMonthly
      ? formatMonthlyPrice(displayPrice, isRtl)
      : hasPrice
        ? formatPrice(displayPrice, isRtl)
        : isRtl
          ? 'حسب الطلب'
          : 'On request';

  return (
    <main
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        width: 'min(1180px, 92vw)',
        marginInline: 'auto',
        paddingBlock: 'clamp(34px, 6vw, 92px)',
      }}
    >
      <a
        href="/"
        style={{
          display: 'inline-flex',
          marginBottom: 28,
          color: 'color-mix(in srgb, var(--sf-ink) 62%, transparent)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          textDecoration: 'none',
        }}
      >
        {isRtl ? 'العودة للمتجر' : 'Back to storefront'}
      </a>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: 'clamp(28px, 5vw, 72px)',
          alignItems: 'start',
        }}
      >
        <div
          style={{
            overflow: 'hidden',
            borderRadius: 32,
            border: '1px solid color-mix(in srgb, var(--sf-ink) 10%, transparent)',
            background: 'color-mix(in srgb, var(--sf-ink) 6%, transparent)',
          }}
        >
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.title}
              style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div
              style={{
                aspectRatio: '4 / 5',
                display: 'grid',
                placeItems: 'center',
                color: 'color-mix(in srgb, var(--sf-ink) 52%, transparent)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              {isRtl ? 'بدون صورة' : 'No image'}
            </div>
          )}
        </div>

        <div style={{ paddingBlock: 'clamp(4px, 2vw, 26px)' }}>
          {product.category ? (
            <p
              style={{
                margin: '0 0 14px',
                color: 'var(--sf-accent)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              {product.category}
            </p>
          ) : null}

          <h1
            style={{
              margin: 0,
              color: 'var(--sf-ink)',
              fontFamily: isRtl
                ? 'var(--font-arabic-serif), var(--font-serif), serif'
                : 'var(--font-serif), serif',
              fontSize: 'clamp(42px, 8vw, 92px)',
              lineHeight: 0.98,
              fontWeight: 700,
              letterSpacing: 0,
            }}
          >
            {product.title}
          </h1>

          {product.description ? (
            <p
              style={{
                margin: 'clamp(22px, 4vw, 38px) 0 0',
                color: 'color-mix(in srgb, var(--sf-ink) 70%, transparent)',
                fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
                fontSize: 'clamp(18px, 2.4vw, 25px)',
                lineHeight: 1.55,
              }}
            >
              {product.description}
            </p>
          ) : null}

          <div
            style={{
              marginTop: 'clamp(28px, 5vw, 52px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20,
              flexWrap: 'wrap',
              paddingTop: 28,
              borderTop: '1px solid color-mix(in srgb, var(--sf-ink) 12%, transparent)',
            }}
          >
            {hasPrice && !isMonthly ? (
              <PriceText
                price={displayPrice}
                isRtl={isRtl}
                style={{
                  color: 'var(--sf-ink)',
                  fontFamily: 'var(--font-serif), serif',
                  fontWeight: 700,
                  fontSize: 'clamp(34px, 5vw, 64px)',
                  whiteSpace: 'nowrap',
                }}
              />
            ) : (
              <strong
                style={{
                  color: 'var(--sf-ink)',
                  fontFamily: 'var(--font-serif), serif',
                  fontWeight: 700,
                  fontSize: 'clamp(34px, 5vw, 64px)',
                  whiteSpace: 'nowrap',
                }}
              >
                {priceText}
              </strong>
            )}

            {canCart ? (
              <AddToCartButton
                productId={product.id}
                title={product.title}
                priceQar={displayPrice}
                imageUrl={product.imageUrl}
                sizeOptions={product.sizeOptions}
                allowCustomSize={product.allowCustomSize}
                requiresHeightInput={product.requiresHeightInput}
                heightInputLabel={product.heightInputLabel}
                heightOptions={product.heightOptions}
                isRtl={isRtl}
                icon={<ShoppingBag size={20} aria-hidden />}
                style={{
                  minHeight: 56,
                  paddingInline: 24,
                  border: 0,
                  background: 'color-mix(in srgb, var(--sf-accent) 82%, #d6ad57)',
                  color: 'var(--sf-ground)',
                }}
              />
            ) : (
              <span
                style={{
                  borderRadius: 999,
                  padding: '14px 20px',
                  background: 'color-mix(in srgb, var(--sf-ink) 10%, transparent)',
                  color: 'color-mix(in srgb, var(--sf-ink) 70%, transparent)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                {isSoldOut ? (isRtl ? 'نفد' : 'Sold out') : priceText}
              </span>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
