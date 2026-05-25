import type { BlockRenderProps } from './BlockContext';
import type { ProductGridProps } from '@/lib/blocks/types';
import { pickProducts } from './helpers';
import { UnifiedProductCard } from './UnifiedProductCard';

export function ProductGridBlock({ block, ctx }: BlockRenderProps<ProductGridProps>) {
  const { storefrontBaseHref, products, vocabulary, isRtl, categoriesBySlug } = ctx;
  const props = block.props;
  const items = pickProducts(products, {
    category: props.category,
    categorySlug: props.categorySlug,
    categoriesBySlug,
    limit: props.limit,
  });

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
        {isRtl ? 'الكتالوج قادم قريباً' : 'catalogue coming soon'}
      </p>
    );
  }

  const minColumnWidth = props.layout === 'lookbook' ? 300 : 260;

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
          textAlign: props.layout === 'lookbook' ? (isRtl ? 'right' : 'left') : 'center',
        }}
      >
        {vocabulary.offerLabel}
      </div>
      <div
        className="grid"
        style={{
          gap: 'clamp(20px, 2.4vw, 32px)',
          gridTemplateColumns: `repeat(auto-fill, minmax(min(${minColumnWidth}px, 100%), 1fr))`,
        }}
      >
        {items.map((product) => (
          <UnifiedProductCard
            key={product.id}
            isRtl={isRtl}
            showDescription={props.layout !== 'minimal'}
            showAddToCart={props.showInquire ?? true}
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
    </section>
  );
}
