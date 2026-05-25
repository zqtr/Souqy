import type { BlockRenderProps } from './BlockContext';
import type { ProductListProps } from '@/lib/blocks/types';
import { pickProducts } from './helpers';
import { UnifiedProductCard } from './UnifiedProductCard';

export function ProductListBlock({ block, ctx }: BlockRenderProps<ProductListProps>) {
  const { storefrontBaseHref, products, vocabulary, isRtl, categoriesBySlug } = ctx;
  const props = block.props;
  const items = pickProducts(products, {
    category: props.category,
    categorySlug: props.categorySlug,
    categoriesBySlug,
    limit: props.limit,
  });
  const serifFamily = isRtl ? 'var(--font-arabic-serif), serif' : 'var(--font-serif), serif';
  const showPrices = props.showPrices ?? true;

  if (items.length === 0) {
    return (
      <p
        style={{
          marginTop: 'clamp(24px, 4vw, 48px)',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'color-mix(in srgb, var(--sf-ink) 50%, transparent)',
        }}
      >
        {isRtl ? 'المنتجات قادمة قريباً' : 'products coming soon'}
      </p>
    );
  }

  const grouped = props.groupByCategory ? groupByCategory(items, isRtl) : [{ key: '', items }];

  return (
    <section style={{ padding: 'clamp(20px, 3vw, 40px) 0' }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--sf-accent)',
          marginBottom: 24,
          textAlign: isRtl ? 'right' : 'left',
        }}
      >
        {vocabulary.offerLabel}
      </div>
      <div className="flex flex-col" style={{ gap: 'clamp(28px, 4vw, 48px)' }}>
        {grouped.map((group) => (
          <div key={group.key || 'all'}>
            {group.key ? (
              <h2
                style={{
                  fontFamily: serifFamily,
                  fontStyle: 'italic',
                  fontWeight: 400,
                  fontSize: 'clamp(20px, 2.4vw, 26px)',
                  margin: '0 0 16px',
                  paddingBottom: 8,
                  borderBottom: '1px solid color-mix(in srgb, var(--sf-accent) 30%, transparent)',
                  textAlign: isRtl ? 'right' : 'left',
                }}
              >
                {group.key}
              </h2>
            ) : null}
            <div
              className="grid"
              style={{
                gap: 'clamp(18px, 2.4vw, 28px)',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))',
              }}
            >
              {group.items.map((product) => (
                <UnifiedProductCard
                  key={product.id}
                  isRtl={isRtl}
                  showPrice={showPrices}
                  product={{
                    id: product.id,
                    title: product.title,
                    description: product.description,
                    category: product.category,
                    imageUrl: product.imageUrl,
                    priceQar: product.priceQar,
                    pricingMode: product.pricingMode,
                    monthlyPriceQar: product.monthlyPriceQar,
                    status: product.status,
                    href: `${storefrontBaseHref}/p/${product.id}`,
                    createdAt: product.createdAt.toISOString(),
                    isCustomizable: product.isCustomizable,
                    customizationLabel: product.customizationLabel,
                    sizeOptions: product.sizeOptions,
                    allowCustomSize: product.allowCustomSize,
                    requiresHeightInput: product.requiresHeightInput,
                    heightInputLabel: product.heightInputLabel,
                    heightOptions: product.heightOptions,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function groupByCategory(
  items: BlockRenderProps<ProductListProps>['ctx']['products'],
  isRtl: boolean,
) {
  const fallback = isRtl ? 'عام' : 'general';
  const map = new Map<string, typeof items>();
  for (const p of items) {
    const key = (p.category ?? '').trim() || fallback;
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  return Array.from(map.entries()).map(([key, list]) => ({ key, items: list }));
}
