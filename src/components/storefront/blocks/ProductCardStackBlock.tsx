import type { BlockRenderProps } from './BlockContext';
import type { ProductCardStackProps } from '@/lib/blocks/types';
import { UnifiedProductCard } from './UnifiedProductCard';

export function ProductCardStackBlock({
  block,
  ctx,
}: BlockRenderProps<ProductCardStackProps>) {
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

  return (
    <section
      style={{
        padding: 'clamp(28px, 4vw, 56px) 0',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 'min(100%, 460px)',
          isolation: 'isolate',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 32,
            transform: `translate(${isRtl ? -18 : 18}px, 18px) rotate(${isRtl ? -3 : 3}deg)`,
            background: 'color-mix(in srgb, var(--sf-ground) 86%, var(--sf-ink) 14%)',
            border: '1px solid color-mix(in srgb, var(--sf-ink) 12%, transparent)',
            zIndex: 0,
          }}
        />
        <UnifiedProductCard
          isRtl={isRtl}
          style={{ position: 'relative', zIndex: 1 }}
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
      </div>
    </section>
  );
}
