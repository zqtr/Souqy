import type { TemplateId } from '@/lib/brief';

/**
 * Seed-product image resolver.
 *
 * Returns the URL of the stylized SVG that ships under
 * `public/seed-products/<templateId>/<n>.svg`. Generated once by
 * `scripts/generate-seed-product-svgs.mjs`; re-run that script to
 * re-skin or extend the catalogue.
 *
 * The helper is index-stable: seed row `i` always maps to image
 * `(i % 5) + 1`, so a future re-skin keeps the same per-row mapping
 * across the dashboard, builder, and storefront. There are five images
 * per template — anything beyond that wraps modularly so a six- or
 * seven-row demo set still renders correctly.
 *
 * Used by `src/lib/blocks/demoProducts.ts` and
 * `src/lib/blocks/templateIndustrySeed.ts` in place of the old
 * Unsplash CDN dependency. No external network calls on the create-
 * storefront path.
 */
export function getSeedImage(templateId: TemplateId, index: number): string {
  const slot = ((index % 5) + 5) % 5;
  return `/seed-products/${templateId}/${slot + 1}.svg`;
}
