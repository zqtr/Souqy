import type { BlockRenderProps } from './BlockContext';
import type { ProductPromoCardProps } from '@/lib/blocks/types';
import { UnifiedProductCard } from './UnifiedProductCard';

const WIDTH_CLAMP: Record<NonNullable<ProductPromoCardProps['width']>, string> = {
  narrow: 'min(100%, 320px)',
  wide: 'min(100%, 420px)',
  full: '100%',
};

export function ProductPromoCardBlock({
  block,
  ctx,
}: BlockRenderProps<ProductPromoCardProps>) {
  const { products, storefrontBaseHref, isRtl, categoriesBySlug } = ctx;
  const props = block.props;

  const slug = props.categorySlug?.trim();
  const slugSet = slug ? categoriesBySlug.get(slug) : undefined;
  const scope =
    slugSet && slugSet.size > 0 ? products.filter((p) => slugSet.has(p.id)) : products;

  const product =
    products.find((p) => p.id === props.productId) ??
    scope.find((p) => p.status === 'active') ??
    scope[0] ??
    products.find((p) => p.status === 'active') ??
    products[0];

  if (!product) return null;

  const width = props.width ?? 'wide';

  return (
    <section
      style={{
        padding: 'clamp(28px, 4vw, 56px) 0',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <UnifiedProductCard
        isRtl={isRtl}
        showAddToCart={props.showAddToCart ?? true}
        style={{ maxWidth: WIDTH_CLAMP[width] }}
        product={{
          id: product.id,
          title: product.title,
          description: product.description,
          category: product.category,
          imageUrl: product.imageUrl,
          priceQar: product.priceQar,
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
    </section>
  );
}
