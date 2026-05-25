import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStorefront, type Storefront as StorefrontData } from '@/lib/brief';
import { getPublicProducts } from '@/lib/products';
import { getStorefrontCategoryProductMap } from '@/lib/categories';
import {
  getStorefrontPolicies,
  POLICY_KEYS,
  type PolicyKey,
  type StorefrontPolicies,
} from '@/lib/storefrontSettings';
import { resolvePolicyBody } from '@/lib/storefrontPolicies';
import {
  getPageBySlug,
  listPages,
  type StorefrontPage,
} from '@/lib/storefrontPages';
import { getCopy } from '@/content/copy';
import { Storefront } from '@/components/storefront/Storefront';
import { TrackPageView } from '@/components/storefront/TrackPageView';
import {
  BuilderPageRenderer,
} from '@/components/storefront/BuilderPageRenderer';
import {
  LegalPageRenderer,
  localizedPolicyTitle,
} from '@/components/storefront/LegalPageRenderer';
import type {
  ChromeLegalPolicy,
  ChromeNavPage,
} from '@/components/storefront/StorefrontChrome';
import { listInstalledApps } from '@/lib/apps/installed';
import { normaliseSettings as normaliseWhatsApp, whatsappDigits } from '@/lib/apps/whatsapp';
import { getServerTheme } from '@/components/theme/ServerThemeScript';
import { getPlan, planUnlocksBrandingRemoval } from '@/lib/billing';

/**
 * Public storefront catch-all. M4 of the 2026-04 builder rebuild
 * collapses what used to be a single home page into a small router
 * that dispatches between three render paths:
 *
 *   /                       → home page (legacy `<Storefront>` pipeline,
 *                             fed from `briefs.published_blocks` which
 *                             is mirrored from the home `storefront_pages`
 *                             row by `publishPage()`).
 *   /{terms|privacy|...}    → a published custom page when present,
 *                             otherwise `<LegalPageRenderer>` with the
 *                             founder's policy body inside the same chrome.
 *   /{any-other-slug}       → `<BuilderPageRenderer>` if a published
 *                             `storefront_pages` row exists, else 404.
 *
 * The static `/checkout/...` and (future) `/cart/...` segments live
 * as sibling route folders under `[slug]`, so Next routes those
 * before this catch-all and we never see them here. Defensive
 * `notFound()` calls below double-check, in case a future segment is
 * deleted but a buyer still has the URL bookmarked.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = { params: Promise<{ slug: string; path?: string[] }> };

type RouteIntent =
  | { kind: 'home' }
  | { kind: 'legal'; key: PolicyKey }
  | { kind: 'page'; slug: string }
  | { kind: 'reserved' }
  | { kind: 'invalid' };

const LEGAL_KEYS = new Set<string>(POLICY_KEYS as readonly string[]);
const RESERVED_OWN_ROUTES = new Set(['checkout', 'cart']);

function deriveIntent(segments: readonly string[]): RouteIntent {
  if (segments.length === 0) return { kind: 'home' };
  if (segments.length > 1) return { kind: 'invalid' };
  const seg = segments[0]?.toLowerCase() ?? '';
  if (RESERVED_OWN_ROUTES.has(seg)) return { kind: 'reserved' };
  if (LEGAL_KEYS.has(seg)) return { kind: 'legal', key: seg as PolicyKey };
  return { kind: 'page', slug: seg };
}

function deriveNavPages(pages: StorefrontPage[]): ChromeNavPage[] {
  return pages
    .filter((p) => p.showInNav && !p.isHome && p.status === 'published')
    .map((p) => ({ slug: p.slug, title: p.title }));
}

function deriveLegalPolicies(
  policies: StorefrontPolicies,
  locale: StorefrontData['locale'],
  businessName: string,
): ChromeLegalPolicy[] {
  return POLICY_KEYS.filter((key) => {
    const body = resolvePolicyBody({ policies, key, locale, businessName });
    return typeof body === 'string' && body.trim().length > 0;
  }).map((key) => ({ key, title: localizedPolicyTitle(key, locale) }));
}

function summarizeBody(body: string, max = 160): string {
  const collapsed = body.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, max - 1).trimEnd()}…`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, path } = await params;
  const segments = path ?? [];

  let data: StorefrontData | null = null;
  try {
    data = await getStorefront(slug);
  } catch {
    return {};
  }
  if (!data) return { title: 'No storefront · Souqna' };

  const t = getCopy(data.locale);
  const noIndex = { robots: { index: false, follow: false } };
  const baseTitle = `${data.businessName} · ${t.meta.siteName}`;
  const baseDescription = data.tagline ?? data.businessName;

  const intent = deriveIntent(segments);

  if (intent.kind === 'legal') {
    const page = await getPageBySlug(slug, intent.key);
    if (page && page.status === 'published' && page.publishedBlocks) {
      return {
        title: page.seo.title ?? `${page.title} · ${data.businessName}`,
        description: page.seo.description ?? baseDescription,
        ...(page.seo.image ? { openGraph: { images: [page.seo.image] } } : {}),
        ...noIndex,
      };
    }

    const policies = await getStorefrontPolicies(slug);
    const body = resolvePolicyBody({
      policies,
      key: intent.key,
      locale: data.locale,
      businessName: data.businessName,
    });
    if (!body || body.trim() === '') {
      return { title: baseTitle, description: baseDescription, ...noIndex };
    }
    const policyTitle = localizedPolicyTitle(intent.key, data.locale);
    return {
      title: `${policyTitle} · ${data.businessName}`,
      description: summarizeBody(body),
      ...noIndex,
    };
  }

  if (intent.kind === 'page') {
    const page = await getPageBySlug(slug, intent.slug);
    if (!page || !page.publishedBlocks) {
      return { title: baseTitle, description: baseDescription, ...noIndex };
    }
    return {
      title: page.seo.title ?? `${page.title} · ${data.businessName}`,
      description: page.seo.description ?? baseDescription,
      ...(page.seo.image ? { openGraph: { images: [page.seo.image] } } : {}),
      ...noIndex,
    };
  }

  return { title: baseTitle, description: baseDescription, ...noIndex };
}

export default async function StorefrontCatchAllPage({ params }: Props) {
  const { slug, path } = await params;
  const segments = path ?? [];
  const intent = deriveIntent(segments);

  if (intent.kind === 'invalid' || intent.kind === 'reserved') notFound();

  let data: StorefrontData | null = null;
  try {
    data = await getStorefront(slug);
  } catch (err) {
    // Surface DB errors as 404 so we don't leak stack traces to buyers.
    // The brief layout's <body> still renders, so the not-found.tsx
    // sibling shows up cleanly.
    void err;
    notFound();
  }
  if (!data) notFound();
  // Founders can pause a storefront from /account/settings/websites.
  // Unpublished storefronts 404 to buyers — preserves SEO posture and
  // keeps deep links consistent with the homepage state.
  if (!data.isPublished) notFound();

  const [products, visitorTheme, installed, categoriesBySlug, allPages, policies, ownerPlan] =
    await Promise.all([
      getPublicProducts(slug),
      getServerTheme(),
      listInstalledApps(slug).catch(() => []),
      getStorefrontCategoryProductMap(slug).catch(() => new Map<string, Set<string>>()),
      listPages(slug).catch(() => [] as StorefrontPage[]),
      getStorefrontPolicies(slug),
      getPlan(data.clerkUserId),
    ]);
  const showSouqnaSignature = !planUnlocksBrandingRemoval(ownerPlan);
  const installedAppIds = installed.filter((a) => a.enabled).map((a) => a.appId);
  const whatsapp = installed.find(
    (app) => app.enabled && app.appId === 'whatsapp-business',
  );
  const whatsappSettings = whatsapp ? normaliseWhatsApp(whatsapp.settings) : null;
  const whatsappPhone = whatsappSettings?.storefrontInquiryMode === 'whatsapp'
    ? whatsappDigits(whatsapp)
    : null;
  const storefrontData = whatsappPhone ? { ...data, phone: whatsappPhone } : data;
  const navPages = deriveNavPages(allPages);
  const legalPolicies = deriveLegalPolicies(policies, data.locale, data.businessName);

  if (intent.kind === 'home') {
    return (
      <>
        <TrackPageView storefrontSlug={slug} />
        <Storefront
          data={storefrontData}
          products={products}
          visitorTheme={visitorTheme}
          installedApps={installedAppIds}
          categoriesBySlug={categoriesBySlug}
          navPages={navPages}
          legalPolicies={legalPolicies}
          showSouqnaSignature={showSouqnaSignature}
        />
      </>
    );
  }

  if (intent.kind === 'legal') {
    const page = await getPageBySlug(slug, intent.key);
    if (page && page.status === 'published' && page.publishedBlocks) {
      return (
        <>
          <TrackPageView storefrontSlug={slug} />
          <BuilderPageRenderer
            data={storefrontData}
            page={page}
            products={products}
            visitorTheme={visitorTheme}
            installedApps={installedAppIds}
            categoriesBySlug={categoriesBySlug}
            navPages={navPages}
            legalPolicies={legalPolicies}
            showSouqnaSignature={showSouqnaSignature}
          />
        </>
      );
    }

    const body = resolvePolicyBody({
      policies,
      key: intent.key,
      locale: data.locale,
      businessName: data.businessName,
    });
    if (!body || body.trim() === '') notFound();
    return (
      <>
        <TrackPageView storefrontSlug={slug} />
        <LegalPageRenderer
          data={storefrontData}
          products={products}
          visitorTheme={visitorTheme}
          installedApps={installedAppIds}
          navPages={navPages}
          legalPolicies={legalPolicies}
          policyKey={intent.key}
          body={body}
          showSouqnaSignature={showSouqnaSignature}
        />
      </>
    );
  }

  // intent.kind === 'page'
  const page = await getPageBySlug(slug, intent.slug);
  if (!page || page.status !== 'published' || !page.publishedBlocks) notFound();
  return (
    <>
      <TrackPageView storefrontSlug={slug} />
      <BuilderPageRenderer
        data={storefrontData}
        page={page}
        products={products}
        visitorTheme={visitorTheme}
        installedApps={installedAppIds}
        categoriesBySlug={categoriesBySlug}
        navPages={navPages}
        legalPolicies={legalPolicies}
        showSouqnaSignature={showSouqnaSignature}
      />
    </>
  );
}
