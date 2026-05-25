'use client';

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from 'react';
import { ArrowRight, Check, Search, SlidersHorizontal } from 'lucide-react';
import type { EcommerceBlockProps, EcommerceCategory, EcommerceProduct } from '@/lib/blocks/types';
import {
  UnifiedProductCard,
  type UnifiedProductCardProduct,
} from './storefront/blocks/UnifiedProductCard';
import { souqnaFxClassName, SouqnaFxStyles } from './souqna-fx-styles';

type Direction = 'ltr' | 'rtl';
type Variant = 'gallery' | 'filters' | 'colorDetail' | 'drop' | 'shelf' | 'categoryShop' | 'tiles';

type Props = EcommerceBlockProps & {
  variant: Variant;
  dir?: Direction;
};

const FALLBACK_PRODUCTS: EcommerceProduct[] = [
  {
    id: 'linen-set',
    name: 'Linen travel set',
    brand: 'Souqna Studio',
    category: 'Travel',
    price: 'QAR 240',
    imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=80',
    description: 'A compact edit for everyday errands, travel days, and giftable bundles.',
    href: '#',
    available: true,
  },
  {
    id: 'ceramic-cup',
    name: 'Ceramic cup pair',
    brand: 'Dohat Clay',
    category: 'Home',
    price: 'QAR 180',
    imageUrl: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=900&q=80',
    description: 'Hand-thrown pair with a soft matte glaze and boxed presentation.',
    href: '#',
    available: true,
  },
  {
    id: 'date-box',
    name: 'Date gift box',
    brand: 'Majlis Pantry',
    category: 'Gifts',
    price: 'QAR 135',
    imageUrl: 'https://images.unsplash.com/photo-1607083206968-13611e3d76db?w=900&q=80',
    description: 'A premium date assortment with Arabic coffee notes and reusable packaging.',
    href: '#',
    available: true,
  },
  {
    id: 'fragrance-oil',
    name: 'Amber fragrance oil',
    brand: 'Bayt Oud',
    category: 'Beauty',
    price: 'QAR 290',
    imageUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900&q=80',
    description: 'A warm amber blend designed for a slow, lasting dry down.',
    href: '#',
    available: false,
  },
];

const FALLBACK_CATEGORIES: EcommerceCategory[] = [
  {
    id: 'new',
    label: 'New arrivals',
    tag: 'Fresh edit',
    imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=80',
    href: '#',
  },
  {
    id: 'gifts',
    label: 'Gifts',
    tag: 'Ready to wrap',
    imageUrl: 'https://images.unsplash.com/photo-1512909006721-3d6018887383?w=900&q=80',
    href: '#',
  },
  {
    id: 'home',
    label: 'Home',
    tag: 'For the table',
    imageUrl: 'https://images.unsplash.com/photo-1513161455079-7dc1de15ef3e?w=900&q=80',
    href: '#',
  },
  {
    id: 'beauty',
    label: 'Beauty',
    tag: 'Daily rituals',
    imageUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900&q=80',
    href: '#',
  },
];

function normalizeProducts(products?: EcommerceProduct[]) {
  const cleaned = (products ?? []).filter((product) => product.name?.trim() || product.imageUrl);
  return cleaned.length ? cleaned : FALLBACK_PRODUCTS;
}

function normalizeCategories(categories?: EcommerceCategory[]) {
  const cleaned = (categories ?? []).filter((category) => category.label?.trim());
  return cleaned.length ? cleaned : FALLBACK_CATEGORIES;
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))));
}

function productImages(product: EcommerceProduct) {
  const images = [product.imageUrl, ...(product.images ?? [])].filter((src): src is string =>
    Boolean(src?.trim()),
  );
  return images.length ? Array.from(new Set(images)) : [FALLBACK_PRODUCTS[0]!.imageUrl!];
}

function sectionTitle(title?: string, fallback = 'Curated products') {
  return title?.trim() || fallback;
}

function toCardProduct(product: EcommerceProduct): UnifiedProductCardProduct {
  return {
    id: product.id ?? product.name,
    title: product.name,
    description: product.description,
    category: product.category ?? product.brand ?? product.tag,
    imageUrl: productImages(product)[0],
    priceQar: product.priceQar,
    priceText: product.price,
    status: product.status ?? (product.available === false ? 'sold_out' : 'active'),
    href: product.href ?? '#',
    createdAt: product.createdAt,
    isCustomizable: product.isCustomizable,
    customizationLabel: product.customizationLabel,
    allowCustomSize: product.allowCustomSize,
    requiresHeightInput: product.requiresHeightInput,
    heightInputLabel: product.heightInputLabel,
    heightOptions: product.heightOptions,
    sizeOptions: product.sizes
      ?.filter((size) => size.available !== false)
      .map((size) => size.label),
  };
}

export function SouqnaEcommerceBlock({
  variant,
  eyebrow = 'Shop',
  title,
  subtitle,
  cta,
  products,
  categories,
  tabs,
  dir = 'ltr',
}: Props) {
  const normalizedProducts = useMemo(() => normalizeProducts(products), [products]);
  const normalizedCategories = useMemo(() => normalizeCategories(categories), [categories]);
  const product = normalizedProducts[0] ?? FALLBACK_PRODUCTS[0]!;
  const isRtl = dir === 'rtl';

  return (
    <section
      dir={dir}
      className={`${souqnaFxClassName} w-full overflow-hidden bg-white px-4 py-8 text-neutral-950 dark:bg-neutral-950 dark:text-white sm:px-6 sm:py-10 lg:px-8`}
    >
      <SouqnaFxStyles />
      <div className="mx-auto w-full max-w-6xl">
        <CommerceHeader
          eyebrow={eyebrow}
          title={sectionTitle(title, headerFallback(variant))}
          subtitle={subtitle}
          cta={cta}
        />
        {variant === 'filters' ? (
          <ProductFilters products={normalizedProducts} isRtl={isRtl} />
        ) : variant === 'shelf' ? (
          <EditorialShelf products={normalizedProducts} isRtl={isRtl} />
        ) : variant === 'categoryShop' ? (
          <CategoryShop products={normalizedProducts} tabs={tabs} isRtl={isRtl} />
        ) : variant === 'tiles' ? (
          <CategoryTiles categories={normalizedCategories} tabs={tabs} />
        ) : (
          <SingleProduct product={product} isRtl={isRtl} />
        )}
      </div>
    </section>
  );
}

function headerFallback(variant: Variant) {
  switch (variant) {
    case 'gallery':
      return 'Featured product gallery';
    case 'filters':
      return 'Filtered shop edit';
    case 'colorDetail':
      return 'Product color story';
    case 'drop':
      return 'Limited drop';
    case 'shelf':
      return 'Editorial product shelf';
    case 'categoryShop':
      return 'Category shop';
    case 'tiles':
      return 'Shop by category';
  }
}

function CommerceHeader({
  eyebrow,
  title,
  subtitle,
  cta,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  cta?: EcommerceBlockProps['cta'];
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-2 text-2xl font-semibold leading-tight text-neutral-950 dark:text-white sm:text-3xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            {subtitle}
          </p>
        ) : null}
      </div>
      {cta?.label ? (
        <a
          href={cta.href || '#'}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-950 hover:text-white dark:border-neutral-700 dark:text-white dark:hover:bg-white dark:hover:text-neutral-950"
        >
          {cta.label}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </a>
      ) : null}
    </div>
  );
}

function SingleProduct({ product, isRtl }: { product: EcommerceProduct; isRtl: boolean }) {
  return (
    <div className="mx-auto w-full max-w-md">
      <UnifiedProductCard isRtl={isRtl} variant="feature" product={toCardProduct(product)} />
    </div>
  );
}

function ProductFilters({ products, isRtl }: { products: EcommerceProduct[]; isRtl: boolean }) {
  const categories = ['All', ...uniqueStrings(products.map((product) => product.category))];
  const brands = ['All', ...uniqueStrings(products.map((product) => product.brand))];
  const [category, setCategory] = useState('All');
  const [brand, setBrand] = useState('All');
  const visible = products.filter(
    (product) =>
      (category === 'All' || product.category === category) &&
      (brand === 'All' || product.brand === brand),
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </div>
        <FilterGroup
          label="Category"
          value={category}
          options={categories}
          onChange={setCategory}
        />
        <FilterGroup label="Brand" value={brand} options={brands} onChange={setBrand} />
      </aside>
      <ProductGrid products={visible} columns="three" isRtl={isRtl} />
    </div>
  );
}

function EditorialShelf({ products, isRtl }: { products: EcommerceProduct[]; isRtl: boolean }) {
  return <ProductGrid products={products.slice(0, 5)} columns="three" isRtl={isRtl} />;
}

function CategoryShop({
  products,
  tabs,
  isRtl,
}: {
  products: EcommerceProduct[];
  tabs?: string[];
  isRtl: boolean;
}) {
  const labels = tabs?.filter(Boolean).length
    ? tabs!.filter(Boolean)
    : ['All', ...uniqueStrings(products.map((product) => product.category))];
  const [active, setActive] = useState(labels[0] ?? 'All');
  const visible =
    active === 'All' ? products : products.filter((product) => product.category === active);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {labels.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => setActive(label)}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              active === label
                ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                : 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <ProductGrid products={visible.length ? visible : products} columns="three" isRtl={isRtl} />
    </div>
  );
}

function CategoryTiles({ categories, tabs }: { categories: EcommerceCategory[]; tabs?: string[] }) {
  const labels = tabs?.filter(Boolean).length
    ? tabs!.filter(Boolean)
    : ['Featured', 'Seasonal', 'Gifts'];
  const [active, setActive] = useState(labels[0] ?? 'Featured');

  return (
    <div>
      <div className="mb-5 flex items-center gap-2 overflow-x-auto border-b border-neutral-200 pb-2 dark:border-neutral-800">
        {labels.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => setActive(label)}
            className={`relative shrink-0 px-1 py-2 text-sm font-medium ${
              active === label ? 'text-neutral-950 dark:text-white' : 'text-neutral-500'
            }`}
          >
            {label}
            {active === label ? (
              <span className="absolute inset-x-0 -bottom-2 h-0.5 bg-neutral-950 dark:bg-white" />
            ) : null}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {categories.slice(0, 8).map((category) => (
          <a
            key={category.id ?? category.label}
            href={category.href || '#'}
            className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-900"
          >
            {category.imageUrl ? (
              <img
                src={category.imageUrl}
                alt={category.label}
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <p className="text-xs uppercase tracking-[0.16em] text-white/70">{category.tag}</p>
              <h3 className="mt-1 text-xl font-semibold">{category.label}</h3>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function ProductGrid({
  products,
  columns,
  isRtl,
}: {
  products: EcommerceProduct[];
  columns: 'three' | 'four';
  isRtl: boolean;
}) {
  return (
    <div
      className={`grid gap-4 sm:grid-cols-2 ${columns === 'four' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}
    >
      {products.map((product) => (
        <UnifiedProductCard
          key={product.id ?? product.name}
          product={toCardProduct(product)}
          isRtl={isRtl}
          variant={columns === 'four' ? 'compact' : 'standard'}
        />
      ))}
    </div>
  );
}

function FilterGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </p>
      <div className="grid gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
              value === option
                ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'
            }`}
          >
            {option}
            {value === option ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Search className="h-3.5 w-3.5 opacity-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
