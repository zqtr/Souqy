import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/locales';
import type { Storefront as StorefrontData } from '@/lib/brief';
import type { Product } from '@/lib/products';
import type { Theme } from '@/lib/theme';
import type { ChromeLegalPolicy, ChromeNavPage } from './StorefrontChrome';
import type { PolicyKey } from '@/lib/storefrontSettings';
import { Storefront } from './Storefront';

/**
 * Renders one of the founder's policy bodies (terms / privacy /
 * refund / shipping) inside the standard storefront chrome so the
 * cart, page nav, and legal footer stay live.
 *
 * The repo intentionally has no markdown library installed (M4 audit
 * — see the catch-all route's plan), so we render the body verbatim
 * inside an `<article>` with `white-space: pre-wrap`. The text the
 * founder enters in `/account/{slug}/settings/policies` is plain
 * text, so this is faithful — line breaks and double-newline
 * paragraphs survive without any HTML injection surface.
 */
export type LegalTitleMap = Record<PolicyKey, { en: string; ar: string }>;

export const POLICY_TITLES: LegalTitleMap = {
  terms: { en: 'Terms of Service', ar: 'شروط الخدمة' },
  privacy: { en: 'Privacy Policy', ar: 'سياسة الخصوصية' },
  refund: { en: 'Refund Policy', ar: 'سياسة الاسترجاع' },
  shipping: { en: 'Shipping Policy', ar: 'سياسة الشحن' },
};

export function localizedPolicyTitle(key: PolicyKey, locale: Locale): string {
  return POLICY_TITLES[key][locale];
}

export function LegalPageRenderer({
  data,
  products,
  visitorTheme,
  installedApps,
  navPages,
  legalPolicies,
  policyKey,
  body,
  showSouqnaSignature = true,
}: {
  data: StorefrontData;
  products: Product[];
  visitorTheme: Theme;
  installedApps: string[];
  navPages: ChromeNavPage[];
  legalPolicies: ChromeLegalPolicy[];
  policyKey: PolicyKey;
  body: string;
  showSouqnaSignature?: boolean;
}): JSX.Element {
  const isRtl = data.locale === 'ar';
  const title = localizedPolicyTitle(policyKey, data.locale);

  const article: ReactNode = (
    <main
      style={{
        maxWidth: 'min(760px, 92vw)',
        marginInline: 'auto',
        paddingBlock: 'clamp(40px, 6vw, 96px)',
        paddingInline: 'clamp(20px, 4vw, 32px)',
      }}
    >
      <header style={{ marginBottom: 'clamp(24px, 4vw, 40px)' }}>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-serif), serif',
            fontWeight: 400,
            fontSize: 'clamp(28px, 5vw, 44px)',
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
            color: 'var(--sf-ink)',
            textAlign: isRtl ? 'right' : 'left',
          }}
        >
          {title}
        </h1>
      </header>
      <article
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'clamp(15px, 1.4vw, 16.5px)',
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          color: 'color-mix(in srgb, var(--sf-ink) 88%, transparent)',
          textAlign: isRtl ? 'right' : 'left',
        }}
      >
        {body}
      </article>
    </main>
  );

  return (
    <Storefront
      data={data}
      products={products}
      visitorTheme={visitorTheme}
      installedApps={installedApps}
      navPages={navPages}
      legalPolicies={legalPolicies}
      overrideMain={article}
      showSouqnaSignature={showSouqnaSignature}
    />
  );
}
