import type { ReactNode } from 'react';
import { ArchMark } from '@/components/primitives/ArchMark';
import type { Storefront } from '@/lib/brief';
import type { PolicyKey } from '@/lib/storefrontSettings';
import { env } from '@/lib/env';
import { CartProvider } from './cart/CartContext';
import { CartDrawer } from './cart/CartDrawer';
import { CartIconButton } from './cart/CartIconButton';

export type ChromeNavPage = { slug: string; title: string };
export type ChromeLegalPolicy = { key: PolicyKey; title: string };

/**
 * Tiny chrome shared by all storefront templates: a Souqna attribution
 * link (with the arch + wordmark) and an expiry note. Uses CSS vars from
 * the parent `<Storefront>` wrapper so the chrome adopts the palette.
 */

type Props = {
  storefront: Storefront;
  align?: 'between' | 'stack';
};

export function StorefrontTopRail({ storefront, align = 'between' }: Props) {
  const isRtl = storefront.locale === 'ar';
  const expiresLabel = new Intl.DateTimeFormat(isRtl ? 'ar-QA' : 'en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(storefront.expiresAt);

  const expiresPrefix = isRtl ? 'هذه الصفحة فعّالة حتى' : 'This page lives until';
  const homeHref = `${env.NEXT_PUBLIC_SITE_URL}${isRtl ? '/ar' : ''}`;

  return (
    <div
      className={
        align === 'between'
          ? 'flex flex-wrap items-center justify-between gap-x-6 gap-y-2'
          : 'flex flex-col gap-3'
      }
      style={{
        paddingBottom: 24,
        marginBottom: 28,
        borderBottom: '1px solid color-mix(in srgb, var(--sf-accent) 22%, transparent)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.06em',
        color: 'color-mix(in srgb, var(--sf-ink) 55%, transparent)',
      }}
    >
      <a
        href={homeHref}
        className="no-underline"
        style={{
          color: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <ArchMark size={20} stroke="var(--sf-accent)" />
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, letterSpacing: '-0.01em' }}>
          {isRtl ? 'متجر سوقنا' : 'a Souqna storefront'}
        </span>
      </a>
      <span style={{ textAlign: isRtl ? 'left' : 'right' }}>
        {expiresPrefix} {expiresLabel}
      </span>
    </div>
  );
}

export function StorefrontFooter({ storefront }: Props) {
  const isRtl = storefront.locale === 'ar';
  const year = new Date().getFullYear();
  return (
    <footer
      className="flex flex-wrap items-center justify-between gap-4"
      style={{
        marginTop: 80,
        paddingTop: 24,
        borderTop: '1px solid color-mix(in srgb, var(--sf-accent) 22%, transparent)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.06em',
        color: 'color-mix(in srgb, var(--sf-ink) 50%, transparent)',
      }}
    >
      <span>© {year} {storefront.businessName.toUpperCase()}</span>
      <a
        href={`${env.NEXT_PUBLIC_SITE_URL}${isRtl ? '/ar/begin' : '/begin'}`}
        className="no-underline"
        style={{ color: 'inherit', borderBottom: '1px solid currentColor', paddingBottom: 1 }}
      >
        {isRtl ? 'صُمّم على سوقنا' : 'Built on Souqna'}
      </a>
    </footer>
  );
}

/**
 * Wraps a storefront tree with the M3 cart provider and mounts the
 * floating cart trigger + slide-in drawer once at the root. The cart
 * is enabled iff the storefront has at least one configured payment
 * method — in that case the icon and drawer are rendered; otherwise
 * the cart context is still installed (so block-level "Add to cart"
 * CTAs can mount safely as no-ops) but neither the trigger nor the
 * drawer are visible.
 *
 * The icon is a fixed-position floating element pinned to the
 * inline-end side of the viewport. It deliberately doesn't get baked
 * into a per-template header because storefront templates render their
 * own headers; floating keeps it consistent across every template,
 * archetype, and the Souqy bundle.
 */
export function StorefrontChrome({
  storefrontSlug,
  storefrontBaseHref,
  enabled,
  currency,
  navPages,
  legalPolicies,
  children,
}: {
  storefrontSlug: string;
  /**
   * Absolute URL of the storefront subdomain (e.g.
   * `https://shop.souqna.qa`). Used to build cross-host links so the
   * chrome navigates correctly from apex (`souqna.qa/brief/...`),
   * dev (`localhost:3000/brief/...`), and the builder preview iframe
   * — not just from the live subdomain.
   */
  storefrontBaseHref: string;
  enabled: boolean;
  currency: string;
  navPages: ChromeNavPage[];
  legalPolicies: ChromeLegalPolicy[];
  children: ReactNode;
}) {
  return (
    <CartProvider storefrontSlug={storefrontSlug} enabled={enabled} currency={currency}>
      {navPages.length > 0 ? (
        <ChromePageNav pages={navPages} storefrontBaseHref={storefrontBaseHref} />
      ) : null}
      {children}
      {legalPolicies.length > 0 ? (
        <ChromeLegalFooter policies={legalPolicies} storefrontBaseHref={storefrontBaseHref} />
      ) : null}
      <CartIconButton />
      <CartDrawer currency={currency} />
    </CartProvider>
  );
}

/**
 * Top nav strip listing the founder's `showInNav` pages. Sits above
 * every template's hero so any storefront design — minimalist, dense,
 * full-bleed — gets a consistent way to reach secondary pages without
 * the chrome fighting the template's typography. Uses logical CSS so
 * the order flips automatically when the parent `<div dir="rtl">` is
 * set by the Storefront wrapper.
 */
function ChromePageNav({
  pages,
  storefrontBaseHref,
}: {
  pages: ChromeNavPage[];
  storefrontBaseHref: string;
}) {
  return (
    <nav
      aria-label="Storefront pages"
      className="flex flex-wrap items-center"
      style={{
        gap: 'clamp(14px, 2vw, 24px)',
        paddingBlock: 'clamp(10px, 1.4vw, 14px)',
        paddingInline: 'clamp(16px, 4vw, 32px)',
        borderBottom: '1px solid color-mix(in srgb, var(--sf-accent) 18%, transparent)',
        background: 'color-mix(in srgb, var(--sf-ground) 92%, transparent)',
        fontFamily: 'var(--font-mono), monospace',
        fontSize: 12.5,
        letterSpacing: '0.04em',
      }}
    >
      {pages.map((p) => (
        <a
          key={p.slug}
          href={`${storefrontBaseHref}/${p.slug}`}
          rel="noopener"
          className="no-underline transition-opacity hover:opacity-100"
          style={{ color: 'var(--sf-ink)', opacity: 0.78 }}
        >
          {p.title}
        </a>
      ))}
    </nav>
  );
}

/**
 * Footer strip with a link per non-empty policy. Mirrors the page nav
 * style so the chrome reads as one coherent layer of meta-navigation
 * around whatever the template renders.
 */
function ChromeLegalFooter({
  policies,
  storefrontBaseHref,
}: {
  policies: ChromeLegalPolicy[];
  storefrontBaseHref: string;
}) {
  return (
    <footer
      className="flex flex-wrap items-center justify-center"
      style={{
        gap: 'clamp(14px, 2vw, 24px)',
        marginTop: 64,
        paddingBlock: 'clamp(20px, 3vw, 28px)',
        paddingInline: 'clamp(16px, 4vw, 32px)',
        borderTop: '1px solid color-mix(in srgb, var(--sf-accent) 18%, transparent)',
        fontFamily: 'var(--font-mono), monospace',
        fontSize: 11.5,
        letterSpacing: '0.06em',
        color: 'color-mix(in srgb, var(--sf-ink) 60%, transparent)',
      }}
    >
      {policies.map((p) => (
        <a
          key={p.key}
          href={`${storefrontBaseHref}/${p.key}`}
          rel="noopener"
          className="no-underline transition-opacity hover:opacity-100"
          style={{ color: 'inherit', opacity: 0.85 }}
        >
          {p.title}
        </a>
      ))}
    </footer>
  );
}

/**
 * Renders an avatar-style logo if one is uploaded, otherwise a soft accent
 * monogram derived from the business name. Templates compose this directly.
 *
 * Hero blocks may pass `overrideUrl` (custom logo image) or `overrideText`
 * (1–4 letters) to swap the default storefront logo for a per-block override
 * without affecting the global brand identity.
 */
export function LogoOrMonogram({
  storefront,
  size = 96,
  overrideUrl,
  overrideText,
}: {
  storefront: Storefront;
  size?: number;
  overrideUrl?: string;
  overrideText?: string;
}) {
  const url = overrideUrl ?? storefront.logoUrl;
  const initial =
    (overrideText && overrideText.trim()) ||
    (storefront.businessName?.trim()[0] ?? '·').toUpperCase();
  if (url && !overrideText) {
    return (
      <img
        src={url}
        alt={storefront.businessName}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1px solid color-mix(in srgb, var(--sf-accent) 30%, transparent)',
          background: 'color-mix(in srgb, var(--sf-ink) 4%, transparent)',
        }}
      />
    );
  }
  const letters = initial.slice(0, 4);
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'color-mix(in srgb, var(--sf-accent) 14%, transparent)',
        color: 'var(--sf-accent)',
        fontFamily: 'var(--font-serif), serif',
        fontStyle: 'italic',
        fontWeight: 400,
        fontSize: letters.length > 1 ? size * 0.32 : size * 0.5,
        lineHeight: 1,
        letterSpacing: letters.length > 1 ? '0.02em' : 0,
      }}
    >
      {letters}
    </div>
  );
}
