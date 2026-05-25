import type { Storefront as StorefrontData } from '@/lib/brief';
import type { Product } from '@/lib/products';
import type { StorefrontPage } from '@/lib/storefrontPages';
import type { Theme } from '@/lib/theme';
import type { ChromeLegalPolicy, ChromeNavPage } from './StorefrontChrome';
import { Storefront } from './Storefront';

/**
 * Renders any non-home builder page (About, Lookbook, Press, etc.)
 * by feeding the page row's `published_blocks` into the same
 * dispatcher the home pipeline uses. `overrideBlocks` shortcuts the
 * Souqy AI bundle path — secondary pages always render from the
 * builder's published JSON, never from the AI artifact (which is
 * scoped to the home revision).
 */
export function BuilderPageRenderer({
  data,
  page,
  products,
  visitorTheme,
  installedApps,
  categoriesBySlug,
  navPages,
  legalPolicies,
  showSouqnaSignature = true,
}: {
  data: StorefrontData;
  page: StorefrontPage;
  products: Product[];
  visitorTheme: Theme;
  installedApps: string[];
  categoriesBySlug: Map<string, Set<string>>;
  navPages: ChromeNavPage[];
  legalPolicies: ChromeLegalPolicy[];
  showSouqnaSignature?: boolean;
}): JSX.Element {
  return (
    <Storefront
      data={data}
      products={products}
      overrideBlocks={page.publishedBlocks ?? []}
      visitorTheme={visitorTheme}
      installedApps={installedApps}
      categoriesBySlug={categoriesBySlug}
      navPages={navPages}
      legalPolicies={legalPolicies}
      showSouqnaSignature={showSouqnaSignature}
    />
  );
}
