import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getAllProducts } from '@/lib/products';
import { getStorefrontCategoryProductMap } from '@/lib/categories';
import { requireStorefrontOwner } from '@/lib/dashboard-auth';
import { Storefront } from '@/components/storefront/Storefront';
import { DashboardDocument } from '@/components/dashboard/DashboardDocument';
import { PreviewBridge } from '@/components/builder/PreviewBridge';
import { isLocale } from '@/i18n/locales';
import {
  getPageBySlug,
  listPages,
  normalizePageSlug,
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

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ page?: string | string[] }>;
};

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  title: 'Preview · Souqna',
};

/**
 * Owner-gated draft preview, rendered inside the builder's iframe. The
 * Storefront dispatcher is fed `draft_blocks` directly (via `overrideBlocks`)
 * so the founder sees their unsaved edits while the public storefront still
 * shows whatever was last published.
 *
 * Renders a bare document (no dashboard chrome) so the iframe contents look
 * identical to the published page.
 *
 * Note on theming: we pass `visitorTheme="light"` (not the founder's
 * dashboard theme cookie) so the storefront preview reflects what a
 * real visitor would see by default — a dark builder chrome must not
 * silently flip the previewed storefront to dark too. Founders who
 * want to preview their dark variant can lock `themeBehaviour` to
 * "Dark" in the Site inspector, which honours its own override.
 */
export default async function StorefrontPreviewPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const requestedPageSlug = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const auth = await requireStorefrontOwner(slug, `/account/${slug}/preview`);
  if (!auth.ok) return <DashboardDocument>{auth.panel}</DashboardDocument>;

  const storefront = auth.storefront;
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const previewPolicyLocale =
    cookieLocale && isLocale(cookieLocale) ? cookieLocale : storefront.locale;
  const [products, categoriesBySlug, allPages, policies] = await Promise.all([
    getAllProducts(slug),
    getStorefrontCategoryProductMap(slug).catch(() => new Map<string, Set<string>>()),
    listPages(slug).catch(() => [] as StorefrontPage[]),
    getStorefrontPolicies(slug),
  ]);

  // Builder previews mirror the public chrome so the founder sees
  // their nav + legal footer exactly as a buyer would. Both are
  // derived locally; the chrome itself never queries the DB.
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
  }).map((key) => ({ key, title: localizedPolicyTitle(key, previewPolicyLocale) }));

  // Multi-page draft preview: when the builder asks for a specific
  // page, load that page's draft tree out of `storefront_pages` and
  // hand it to the dispatcher via `overrideBlocks`. The home page (and
  // any unknown slug) falls back to `briefs.draft_blocks` — that's
  // the legacy single-page behaviour and is kept for compatibility
  // with anything that still hits `/account/{slug}/preview` without a
  // `?page=` parameter.
  let overrideBlocks = storefront.draftBlocks;
  if (requestedPageSlug) {
    const wanted = normalizePageSlug(requestedPageSlug);
    if (wanted && wanted !== 'home') {
      const page = await getPageBySlug(slug, wanted);
      if (page) overrideBlocks = page.draftBlocks;
    }
  }

  return (
    <DashboardDocument bare lang={storefront.locale}>
      <PreviewBridge />
      <Storefront
        data={storefront}
        products={products}
        overrideBlocks={overrideBlocks}
        selectable
        visitorTheme="light"
        categoriesBySlug={categoriesBySlug}
        navPages={navPages}
        legalPolicies={legalPolicies}
        policyLocale={previewPolicyLocale}
      />
    </DashboardDocument>
  );
}
