import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Storefront } from '@/lib/brief';
import type { Product } from '@/lib/products';
import type { ThemeOverrides } from '@/lib/blocks/types';
import type { getCopy } from '@/content/copy';
import type { getVocabulary } from '@/lib/storefront-vocabulary';

/**
 * SouqyContext is the request-scoped bundle every SDK component needs:
 * the storefront row, its products, theme overrides, the bilingual copy
 * dictionary, the business-type vocabulary table, and an `isRtl` flag.
 *
 * It mirrors `BlockContext` deliberately so the SDK wrappers can delegate
 * to the existing storefront block components without re-resolving any
 * derived data.
 */
export type SouqyContext = {
  storefront: Storefront;
  storefrontBaseHref: string;
  products: Product[];
  theme: ThemeOverrides;
  copy: ReturnType<typeof getCopy>;
  vocabulary: ReturnType<typeof getVocabulary>;
  isRtl: boolean;
  /**
   * First-class category slug → product-id set (mirrors `BlockContext`
   * — see `src/components/storefront/blocks/BlockContext.ts`). Empty
   * `Map` is fine; product-bearing blocks degrade to the legacy
   * free-text category match.
   */
  categoriesBySlug: Map<string, Set<string>>;
};

/**
 * AsyncLocalStorage is the only React-server-component-safe way to share
 * read-only per-request state without prop drilling. React Context does
 * not propagate across server components in Next.js App Router, but
 * AsyncLocalStorage does — Next itself uses it internally for cookies(),
 * headers(), etc.
 *
 * We deliberately export the runtime via two seams:
 *   - `withSouqyContext(ctx, fn)` — the only legal way to enter the
 *     scope. Called by the dynamic loader before invoking the founder's
 *     compiled component.
 *   - `useSouqyContext()` — read access for SDK components. Throws if
 *     called outside an active scope so a misuse fails loudly in
 *     development instead of rendering a half-broken page in prod.
 */
const als = new AsyncLocalStorage<SouqyContext>();

export function withSouqyContext<T>(ctx: SouqyContext, fn: () => T): T {
  return als.run(ctx, fn);
}

export function useSouqyContext(): SouqyContext {
  const ctx = als.getStore();
  if (!ctx) {
    throw new Error(
      '[souqna/sdk] component used outside SouqyContext — wrap with withSouqyContext()',
    );
  }
  return ctx;
}

/**
 * Convenience hooks. Each is a thin slice of the full context so the
 * generated TSX reads naturally — `const products = useProducts()`
 * instead of `useSouqyContext().products`.
 */
export function useStorefront(): Storefront {
  return useSouqyContext().storefront;
}

export function useProducts(): Product[] {
  return useSouqyContext().products;
}

export function useTheme(): ThemeOverrides {
  return useSouqyContext().theme;
}

export function useLocale(): 'en' | 'ar' {
  return useSouqyContext().storefront.locale;
}

export function useIsRtl(): boolean {
  return useSouqyContext().isRtl;
}
