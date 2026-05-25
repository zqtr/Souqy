'use client';

import Link from 'next/link';
import type { Storefront } from '@/lib/brief';
import type { CategoryWithStorefront } from '@/lib/categories';
import { CategoryDeleteButton } from './CategoryDeleteButton';

/**
 * Categories tab — sister surface to ProductsTab. Per-storefront filter
 * strip on top, then a card grid with cover image / initials, name,
 * slug, product count, and Edit / Delete actions.
 *
 * The "Add category" CTA is rendered by the parent page header; this
 * view only renders the catalogue. Edit links flip the URL to
 * `?view=categories&store=…&edit=ID`, which the parent page reads to
 * mount the centered modal.
 */
type Props = {
  storefronts: Storefront[];
  categories: CategoryWithStorefront[];
  storeFilter?: string;
};

export function CategoriesView({ storefronts, categories, storeFilter }: Props) {
  const known = new Set(storefronts.map((s) => s.slug));
  const activeFilter =
    storeFilter && known.has(storeFilter) ? storeFilter : undefined;
  const visible = activeFilter
    ? categories.filter((c) => c.storefrontSlug === activeFilter)
    : categories;

  if (storefronts.length === 0) {
    return (
      <EmptyCard>
        No storefronts yet — categories live inside storefronts. Open one first.
      </EmptyCard>
    );
  }

  return (
    <>
      <FilterStrip
        storefronts={storefronts}
        categories={categories}
        activeFilter={activeFilter}
      />

      {visible.length === 0 ? (
        <EmptyCard>
          {activeFilter
            ? 'No categories in this storefront yet — group your products to make them easier to browse.'
            : 'No categories yet. Add one to start grouping your products.'}
        </EmptyCard>
      ) : (
        <ul style={gridStyle}>
          {visible.map((c) => (
            <CategoryCard key={c.id} category={c} />
          ))}
        </ul>
      )}
    </>
  );
}

function FilterStrip({
  storefronts,
  categories,
  activeFilter,
}: {
  storefronts: Storefront[];
  categories: CategoryWithStorefront[];
  activeFilter?: string;
}) {
  const counts = new Map<string, number>();
  for (const c of categories) {
    counts.set(c.storefrontSlug, (counts.get(c.storefrontSlug) ?? 0) + 1);
  }
  return (
    <div
      role="tablist"
      aria-label="Filter by storefront"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 22,
      }}
    >
      <Chip
        label="All"
        count={categories.length}
        active={!activeFilter}
        href="/account/products?view=categories"
      />
      {storefronts.map((s) => (
        <Chip
          key={s.slug}
          label={s.businessName}
          count={counts.get(s.slug) ?? 0}
          active={activeFilter === s.slug}
          href={`/account/products?view=categories&store=${encodeURIComponent(s.slug)}`}
        />
      ))}
    </div>
  );
}

function Chip({
  label,
  count,
  active,
  href,
}: {
  label: string;
  count: number;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '6px 12px',
        borderRadius: 999,
        border: `1px solid ${active ? 'var(--accent)' : 'var(--surface-rule-strong)'}`,
        background: active ? 'var(--accent)' : 'var(--surface-elevated)',
        color: active ? 'var(--ink-on-accent)' : 'var(--ink-strong)',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 6,
      }}
    >
      <span>{label}</span>
      <span
        style={{
          fontSize: 10,
          color: active ? 'var(--ink-on-accent)' : 'var(--ink-faint)',
          opacity: active ? 0.85 : 1,
        }}
      >
        {count}
      </span>
    </Link>
  );
}

function CategoryCard({ category }: { category: CategoryWithStorefront }) {
  const editHref = `/account/products?view=categories&store=${encodeURIComponent(category.storefrontSlug)}&edit=${encodeURIComponent(category.id)}`;
  const productsHref = `/account/products?store=${encodeURIComponent(category.storefrontSlug)}&category=${encodeURIComponent(category.name)}`;
  return (
    <li
      style={{
        border: '1px solid var(--surface-rule)',
        borderRadius: 12,
        background: 'var(--surface-elevated)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          aspectRatio: '16 / 9',
          background: 'var(--surface-bg)',
          borderBottom: '1px solid var(--surface-rule)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ink-faint)',
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 36,
          overflow: 'hidden',
        }}
      >
        {category.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={category.imageUrl}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <span aria-hidden>{category.name.slice(0, 1).toUpperCase()}</span>
        )}
      </div>

      <div
        style={{
          padding: '14px 16px 12px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-faint)',
          }}
        >
          {category.storefrontName}
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: 'var(--ink-strong)',
            lineHeight: 1.3,
          }}
        >
          {category.name}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-muted)',
            letterSpacing: '0.04em',
          }}
        >
          /{category.slug} ·{' '}
          <Link
            href={productsHref}
            style={{ color: 'var(--admin-accent)', textDecoration: 'none' }}
          >
            {category.productCount}{' '}
            {category.productCount === 1 ? 'product' : 'products'}
          </Link>
        </div>
        {category.description ? (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 13,
              color: 'var(--ink-muted)',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {category.description}
          </p>
        ) : null}
      </div>

      <div
        style={{
          padding: '10px 16px 14px',
          borderTop: '1px dashed var(--surface-rule)',
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
        }}
      >
        <Link
          href={editHref}
          style={{
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '6px 12px',
            border: '1px solid var(--surface-rule-strong)',
            borderRadius: 999,
            color: 'var(--ink-strong)',
            textDecoration: 'none',
          }}
        >
          Edit
        </Link>
        <CategoryDeleteButton
          storefrontSlug={category.storefrontSlug}
          categoryId={category.id}
          categoryName={category.name}
          productCount={category.productCount}
        />
      </div>
    </li>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: '1px dashed var(--surface-rule-strong)',
        borderRadius: 10,
        padding: '32px 28px',
        textAlign: 'center',
        background: 'var(--surface-elevated)',
        fontSize: 14,
        lineHeight: 1.6,
        color: 'var(--ink-muted)',
      }}
    >
      {children}
    </div>
  );
}

const gridStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: 16,
};
