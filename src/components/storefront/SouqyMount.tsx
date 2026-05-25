import type { ReactNode } from 'react';
import type { Storefront } from '@/lib/brief';
import type { Product } from '@/lib/products';
import { getCopy } from '@/content/copy';
import { getVocabulary } from '@/lib/storefront-vocabulary';
import { storefrontBaseUrl } from '@/lib/storefrontUrl';
import { loadSouqyComponent, renderSouqyComponent } from '@/lib/souqy/load';

/**
 * Async server component that wires the Souqy artifact loader into the
 * storefront render tree. Stays a separate component so the parent
 * `<Storefront>` can be a synchronous function — only the Souqy branch
 * pays the async cost (and only when actually used).
 *
 * On any load failure, falls back to the supplied `fallback` node
 * (usually the legacy block pipeline). Errors are logged but never
 * thrown — the public storefront should not 500 because the AI bundle
 * misbehaves.
 */
export async function SouqyMount({
  data,
  products,
  fallback,
  categoriesBySlug,
}: {
  data: Storefront;
  products: Product[];
  fallback: ReactNode;
  /** Optional category-slug → product-id set; threaded through to the
   * SDK so generated components resolve the new `categorySlug` prop
   * against real categories (defaults to an empty Map). */
  categoriesBySlug?: Map<string, Set<string>>;
}): Promise<ReactNode> {
  if (!data.souqyRevision || !data.souqyBlobUrl) return fallback;

  const result = await loadSouqyComponent({
    slug: data.slug,
    revision: data.souqyRevision,
    blobUrl: data.souqyBlobUrl,
  });
  if (!result.ok) {
    console.error('[souqy/mount] load failed', {
      slug: data.slug,
      revision: data.souqyRevision,
      reason: result.reason,
      message: result.message,
    });
    return fallback;
  }

  const ctx = {
    storefront: data,
    storefrontBaseHref: storefrontBaseUrl(data.slug),
    products,
    theme: data.themeOverrides,
    copy: getCopy(data.locale),
    vocabulary: getVocabulary(data.locale, data.businessType),
    isRtl: data.locale === 'ar',
    categoriesBySlug: categoriesBySlug ?? new Map<string, Set<string>>(),
  };
  return <>{renderSouqyComponent(result.Component, ctx)}</>;
}
