import type { Storefront } from '@/lib/brief';
import type { Product } from '@/lib/products';
import type { ThemeOverrides, Block } from '@/lib/blocks/types';
import type { getCopy } from '@/content/copy';
import type { getVocabulary } from '@/lib/storefront-vocabulary';

/**
 * Read-only context every block component receives. Built once per page
 * render in `BlockRenderer` and passed down by props (no React Context —
 * keeps every block server-renderable).
 *
 * `categoriesBySlug` maps `categorySlug` (a stable handle assigned in the
 * dashboard) to the set of product ids in that category. Product-bearing
 * blocks consult it via `pickProducts` to resolve `categorySlug` first;
 * the legacy free-text `category` match is the fallback. An empty map
 * (the default) is fine — every block degrades gracefully.
 */
export type BlockContext = {
  storefront: Storefront;
  storefrontBaseHref: string;
  products: Product[];
  theme: ThemeOverrides;
  copy: ReturnType<typeof getCopy>;
  vocabulary: ReturnType<typeof getVocabulary>;
  isRtl: boolean;
  /** True for the account builder iframe. Lets app-owned blocks render
   *  helpful setup placeholders without leaking placeholders publicly. */
  isPreview?: boolean;
  categoriesBySlug: Map<string, Set<string>>;
};

export type BlockRenderProps<P> = {
  block: Block & { props: P };
  ctx: BlockContext;
};
