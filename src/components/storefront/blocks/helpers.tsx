import type { Product } from '@/lib/products';

export function formatPrice(price: number | null, isRtl: boolean): string {
  if (price === null) return isRtl ? 'عند الطلب' : 'on request';
  const formatted = new Intl.NumberFormat(isRtl ? 'ar-QA' : 'en-QA', {
    minimumFractionDigits: price % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price);
  return `${formatted} QAR`;
}

export function formatMonthlyPrice(price: number | null, isRtl: boolean): string {
  if (price === null) return isRtl ? 'عند الطلب' : 'on request';
  return `${formatPrice(price, isRtl)}${isRtl ? ' / شهر' : ' / mo'}`;
}

/**
 * Inline wrapper that tags a rendered price with the raw QAR amount so
 * the Currency Converter client island can rewrite its text content
 * when the visitor toggles currency. Falls back to a plain span when
 * the price is null (no toggle behaviour for "on request" items).
 */
export function PriceText({
  price,
  isRtl,
  className,
  style,
}: {
  price: number | null;
  isRtl: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const text = formatPrice(price, isRtl);
  if (price === null) {
    return (
      <span className={className} style={style}>
        {text}
      </span>
    );
  }
  return (
    <span
      className={className}
      style={style}
      data-souqna-price={String(price)}
    >
      {text}
    </span>
  );
}

/**
 * Filter + cap helper used by every product block. The empty-string
 * category sentinel means "no filter".
 *
 * Resolution order (first match wins):
 *   1. `categorySlug` is set AND the categories context resolves it to
 *      a non-empty product-id set → filter by membership in that set.
 *   2. `category` (legacy free-text) is set → case-insensitive match
 *      against `product.category`.
 *   3. No filter.
 *
 * The `categorySlug` path silently falls through to (2) when the slug
 * isn't in the context — useful while a storefront has a stored
 * `categorySlug` but the founder hasn't created a matching category
 * row yet.
 *
 * `limit` is always applied last.
 */
export type PickProductsOptions = {
  category?: string;
  categorySlug?: string;
  categoriesBySlug?: Map<string, Set<string>>;
  limit?: number;
};

export function pickProducts(
  products: Product[],
  optsOrCategory?: PickProductsOptions | string,
  limit?: number,
): Product[] {
  // Support the legacy positional form (`pickProducts(products, category, limit)`)
  // so the four storefront block components can adopt the new signature
  // independently. New callers use the options-object form.
  const opts: PickProductsOptions =
    typeof optsOrCategory === 'string' || optsOrCategory == null
      ? { category: optsOrCategory ?? undefined, limit }
      : optsOrCategory;

  let out = products;

  const slug = opts.categorySlug?.trim();
  const slugSet = slug && opts.categoriesBySlug ? opts.categoriesBySlug.get(slug) : undefined;
  if (slugSet && slugSet.size > 0) {
    out = out.filter((p) => slugSet.has(p.id));
  } else {
    const cat = opts.category?.trim();
    if (cat && cat.length > 0) {
      const needle = cat.toLowerCase();
      out = out.filter((p) => (p.category ?? '').toLowerCase() === needle);
    }
  }

  if (typeof opts.limit === 'number' && opts.limit > 0) {
    out = out.slice(0, opts.limit);
  }
  return out;
}

export function emptyEyebrow(): React.CSSProperties {
  return {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'color-mix(in srgb, var(--sf-ink) 50%, transparent)',
    textAlign: 'center',
    padding: 'clamp(24px, 4vw, 48px) 0',
  };
}
