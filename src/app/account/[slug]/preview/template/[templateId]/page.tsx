import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getAllProducts } from '@/lib/products';
import { getStorefrontCategoryProductMap } from '@/lib/categories';
import { requireStorefrontOwner } from '@/lib/dashboard-auth';
import { Storefront } from '@/components/storefront/Storefront';
import { DashboardDocument } from '@/components/dashboard/DashboardDocument';
import { isLocale } from '@/i18n/locales';
import {
  listPages,
  type StorefrontPage,
} from '@/lib/storefrontPages';
import {
  getStorefrontPolicies,
  POLICY_KEYS,
} from '@/lib/storefrontSettings';
import { resolvePolicyBody } from '@/lib/storefrontPolicies';
import { localizedPolicyTitle } from '@/components/storefront/LegalPageRenderer';
import type {
  ChromeLegalPolicy,
  ChromeNavPage,
} from '@/components/storefront/StorefrontChrome';
import { TEMPLATE_IDS, type TemplateId } from '@/lib/brief';
import { templatePresets } from '@/lib/templates';
import { bootBlocksFromStorefront } from '@/lib/blocks/boot';
import type { ThemeOverrides } from '@/lib/blocks/types';

type Props = {
  params: Promise<{ slug: string; templateId: string }>;
};

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  title: 'Template preview · Souqna',
};

/**
 * Owner-gated **ephemeral** template preview, mounted inside the Site
 * inspector's "Browse all templates" modal as a same-origin iframe.
 *
 * The route renders what `/account/{slug}` would look like if the
 * founder switched to `templateId` — without persisting anything. We
 * synthesize an in-memory storefront variant whose `templateId` and
 * `themeOverrides` are overlaid with the requested template's preset,
 * boot a fresh block tree from `bootBlocksFromStorefront`, then feed
 * the result to the same `Storefront` dispatcher the regular preview
 * uses. The founder's real products, categories, policies and nav
 * pages are loaded too so each preview reads with their actual catalogue
 * instead of a generic gradient swatch.
 *
 * `force-dynamic` keeps each preview keyed off the latest catalogue —
 * never cached at the CDN. `noindex` mirrors the regular preview route.
 */
export default async function TemplatePreviewPage({ params }: Props) {
  const { slug, templateId: rawTemplateId } = await params;
  if (!(TEMPLATE_IDS as readonly string[]).includes(rawTemplateId)) {
    notFound();
  }
  const templateId = rawTemplateId as TemplateId;

  const auth = await requireStorefrontOwner(
    slug,
    `/account/${slug}/preview/template/${templateId}`,
  );
  if (!auth.ok) return <DashboardDocument>{auth.panel}</DashboardDocument>;

  const storefront = auth.storefront;
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const previewPolicyLocale =
    cookieLocale && isLocale(cookieLocale) ? cookieLocale : storefront.locale;

  const [products, categoriesBySlug, allPages, policies] = await Promise.all([
    getAllProducts(slug),
    getStorefrontCategoryProductMap(slug).catch(
      () => new Map<string, Set<string>>(),
    ),
    listPages(slug).catch(() => [] as StorefrontPage[]),
    getStorefrontPolicies(slug),
  ]);

  // Overlay the template's preset on top of any existing overrides so
  // palette, heading weight and section rhythm match the picker preview
  // — but keep founder-set fields (page bg, SEO, theme behaviour lock)
  // wherever the preset doesn't speak.
  const previewTheme: ThemeOverrides = {
    ...storefront.themeOverrides,
    ...templatePresets[templateId].theme,
  };
  const previewData = {
    ...storefront,
    templateId,
    themeOverrides: previewTheme,
  };
  const previewBlocks = bootBlocksFromStorefront(previewData);

  const navPages: ChromeNavPage[] = allPages
    .filter((p) => p.showInNav && !p.isHome && p.status === 'published')
    .map((p) => ({ slug: p.slug, title: p.title }));
  const legalPolicies: ChromeLegalPolicy[] = POLICY_KEYS.filter((key) => {
    const body = resolvePolicyBody({
      policies,
      key,
      locale: previewPolicyLocale,
      businessName: storefront.businessName,
    });
    return typeof body === 'string' && body.trim().length > 0;
  }).map((key) => ({
    key,
    title: localizedPolicyTitle(key, previewPolicyLocale),
  }));

  return (
    <DashboardDocument bare lang={storefront.locale}>
      <Storefront
        data={previewData}
        products={products}
        overrideBlocks={previewBlocks}
        visitorTheme="light"
        categoriesBySlug={categoriesBySlug}
        navPages={navPages}
        legalPolicies={legalPolicies}
        policyLocale={previewPolicyLocale}
        showcaseOnly
      />
    </DashboardDocument>
  );
}
