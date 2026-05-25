'use client';

import Ecommerce1 from '@/components/ecommerce-1';
import Ecommerce2 from '@/components/ecommerce-2';
import Ecommerce3 from '@/components/ecommerce-3';
import Ecommerce4 from '@/components/ecommerce-4';
import Ecommerce5 from '@/components/ecommerce-5';
import Ecommerce6 from '@/components/ecommerce-6';
import Ecommerce7 from '@/components/ecommerce-7';
import type { Product } from '@/lib/products';
import type { BlockRenderProps } from './BlockContext';
import type {
  EcommerceBlockProps,
  EcommerceProduct,
  Ecommerce1Props,
  Ecommerce2Props,
  Ecommerce3Props,
  Ecommerce4Props,
  Ecommerce5Props,
  Ecommerce6Props,
  Ecommerce7Props,
} from '@/lib/blocks/types';

export function Ecommerce1Block({ block, ctx }: BlockRenderProps<Ecommerce1Props>) {
  return <Ecommerce1 {...withResolvedProducts(block.props, ctx.products, ctx.storefrontBaseHref)} dir={ctx.isRtl ? 'rtl' : 'ltr'} />;
}

export function Ecommerce2Block({ block, ctx }: BlockRenderProps<Ecommerce2Props>) {
  return <Ecommerce2 {...withResolvedProducts(block.props, ctx.products, ctx.storefrontBaseHref)} dir={ctx.isRtl ? 'rtl' : 'ltr'} />;
}

export function Ecommerce3Block({ block, ctx }: BlockRenderProps<Ecommerce3Props>) {
  return <Ecommerce3 {...withResolvedProducts(block.props, ctx.products, ctx.storefrontBaseHref)} dir={ctx.isRtl ? 'rtl' : 'ltr'} />;
}

export function Ecommerce4Block({ block, ctx }: BlockRenderProps<Ecommerce4Props>) {
  return <Ecommerce4 {...withResolvedProducts(block.props, ctx.products, ctx.storefrontBaseHref)} dir={ctx.isRtl ? 'rtl' : 'ltr'} />;
}

export function Ecommerce5Block({ block, ctx }: BlockRenderProps<Ecommerce5Props>) {
  return <Ecommerce5 {...withResolvedProducts(block.props, ctx.products, ctx.storefrontBaseHref)} dir={ctx.isRtl ? 'rtl' : 'ltr'} />;
}

export function Ecommerce6Block({ block, ctx }: BlockRenderProps<Ecommerce6Props>) {
  return <Ecommerce6 {...withResolvedProducts(block.props, ctx.products, ctx.storefrontBaseHref)} dir={ctx.isRtl ? 'rtl' : 'ltr'} />;
}

export function Ecommerce7Block({ block, ctx }: BlockRenderProps<Ecommerce7Props>) {
  return <Ecommerce7 {...withResolvedProducts(block.props, ctx.products, ctx.storefrontBaseHref)} dir={ctx.isRtl ? 'rtl' : 'ltr'} />;
}

function withResolvedProducts<T extends EcommerceBlockProps>(
  props: T,
  products: Product[],
  storefrontBaseHref: string,
): T {
  const ids = props.productIds?.filter(Boolean) ?? [];
  if (ids.length === 0) return props;
  const byId = new Map(products.map((product) => [product.id, product]));
  const resolved = ids
    .map((id) => byId.get(id))
    .filter((product): product is Product => Boolean(product))
    .map((product): EcommerceProduct => ({
      id: product.id,
      name: product.title,
      price:
        product.priceQar !== null
          ? `QAR ${product.priceQar % 1 === 0 ? product.priceQar.toFixed(0) : product.priceQar.toFixed(2)}`
          : undefined,
      priceQar: product.priceQar,
      brand: product.category ?? undefined,
      category: product.category ?? undefined,
      imageUrl: product.imageUrl ?? undefined,
      description: product.description ?? undefined,
      href: `${storefrontBaseHref}/p/${product.id}`,
      available: product.status !== 'sold_out',
      status: product.status,
      createdAt: product.createdAt.toISOString(),
      isCustomizable: product.isCustomizable,
      customizationLabel: product.customizationLabel,
      allowCustomSize: product.allowCustomSize,
      requiresHeightInput: product.requiresHeightInput,
      heightInputLabel: product.heightInputLabel,
      heightOptions: product.heightOptions,
      sizes: product.sizeOptions.map((label) => ({ label })),
    }));
  return resolved.length ? ({ ...props, products: resolved } as T) : props;
}
