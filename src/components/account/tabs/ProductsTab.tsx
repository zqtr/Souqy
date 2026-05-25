import Link from 'next/link';
import { Plus, ArrowUpRight, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Storefront } from '@/lib/brief';
import type { ProductWithStorefront } from '@/lib/products';
import { AccountDeleteProductButton } from './AccountDeleteProductButton';
import { ProductImportPanel } from '@/components/admin/products/ProductImportPanel';
import { cn } from '@/lib/utils';
import { adminPhrase } from '@/components/admin/adminLocale';

type Props = {
  /** All storefronts owned by the user — drives the filter chip strip. */
  storefronts: Storefront[];
  /** Cross-storefront product list, already fetched in the page. */
  products: ProductWithStorefront[];
  /**
   * Optional storefront slug to filter the list to. Passed via the URL
   * (`?store=slug`) so filtering is link-shareable and survives refresh.
   */
  storeFilter?: string;
  /**
   * Optional category name to filter the list to. Passed via the URL
   * (`?category=name`). Combines with `storeFilter`.
   */
  categoryFilter?: string;
  importOpen?: boolean;
  dashboardLocale?: string;
};

/**
 * Cross-storefront catalogue. Add / Edit are handled by the page-level
 * <ProductModal> via `?new=1` / `?edit=ID`, so this view only renders.
 */
export function ProductsTab({
  storefronts,
  products,
  storeFilter,
  categoryFilter,
  importOpen = false,
  dashboardLocale,
}: Props) {
  const t = (text: string) => adminPhrase(dashboardLocale, text);
  const known = new Set(storefronts.map((s) => s.slug));
  const activeFilter = storeFilter && known.has(storeFilter) ? storeFilter : undefined;
  const scoped = activeFilter
    ? products.filter((p) => p.storefrontSlug === activeFilter)
    : products;
  const categories = collectCategories(scoped);
  const activeCategory =
    categoryFilter && categories.includes(categoryFilter) ? categoryFilter : undefined;
  const visible = activeCategory
    ? scoped.filter((p) => (p.category ?? 'Uncategorized') === activeCategory)
    : scoped;
  const activeStorefront = activeFilter
    ? storefronts.find((s) => s.slug === activeFilter)
    : undefined;

  if (storefronts.length === 0) {
    return (
      <EmptyCard>
        {t(
          'No storefronts yet — products live inside storefronts. Open one first and your catalogue will start filling in here.',
        )}
      </EmptyCard>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <FilterStrip
        storefronts={storefronts}
        products={products}
        activeFilter={activeFilter}
        locale={dashboardLocale}
      />

      {categories.length > 0 ? (
        <CategoryStrip
          categories={categories}
          counts={countByCategory(scoped)}
          activeCategory={activeCategory}
          storeFilter={activeFilter}
          locale={dashboardLocale}
        />
      ) : null}

      {activeStorefront ? (
        <PerStorefrontManage
          storefront={activeStorefront}
          products={visible}
          importOpen={importOpen}
          locale={dashboardLocale}
        />
      ) : products.length === 0 ? (
        <EmptyCard>
          {t(
            "No products yet. Open a storefront and add your first one — it'll show up here alongside everything else.",
          )}
        </EmptyCard>
      ) : (
        <ProductGroups products={visible} locale={dashboardLocale} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-storefront management view (active filter selected)
// ---------------------------------------------------------------------------

function PerStorefrontManage({
  storefront,
  products,
  importOpen,
  locale,
}: {
  storefront: Storefront;
  products: ProductWithStorefront[];
  importOpen: boolean;
  locale?: string;
}) {
  const t = (text: string) => adminPhrase(locale, text);
  const newHref = `/account/products?store=${encodeURIComponent(storefront.slug)}&new=1`;
  const dashboardHref = `/account/products?store=${encodeURIComponent(storefront.slug)}`;
  const importHref = `/account/products?store=${encodeURIComponent(storefront.slug)}&import=1`;

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="m-0 text-2xl font-medium leading-tight tracking-tight">
            {storefront.businessName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Drag to reorder. Drafts stay hidden from the live storefront.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant={importOpen ? 'default' : 'secondary'} size="sm">
            <Link href={importHref} className="gap-1.5">
              <FileUp className="h-3.5 w-3.5" />
              {t('Import products')}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={dashboardHref} className="gap-1.5">
              {t('Open products')}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button asChild size="sm">
            <a href={newHref} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {t('Add a product')}
            </a>
          </Button>
        </div>
      </header>

      {importOpen ? <ProductImportPanel slug={storefront.slug} locale={storefront.locale} /> : null}

      {products.length === 0 ? (
        <EmptyCard>
          {locale === 'ar' ? 'لا توجد منتجات في ' : 'No products in '}
          <strong>{storefront.businessName}</strong>
          {locale === 'ar'
            ? ' بعد. '
            : ' yet — add the first one to bring this storefront to life. '}
          <a
            href={newHref}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t('Add the first product')} {locale === 'ar' ? '←' : '→'}
          </a>
        </EmptyCard>
      ) : (
        <ProductGrid products={products} locale={locale} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Cross-storefront grouped grid (no filter selected)
// ---------------------------------------------------------------------------

function ProductGroups({
  products,
  locale,
}: {
  products: ProductWithStorefront[];
  locale?: string;
}) {
  const t = (text: string) => adminPhrase(locale, text);
  const groups = new Map<string, ProductWithStorefront[]>();
  for (const p of products) {
    const arr = groups.get(p.storefrontSlug) ?? [];
    arr.push(p);
    groups.set(p.storefrontSlug, arr);
  }

  return (
    <div className="grid gap-8">
      {Array.from(groups.entries()).map(([slug, items]) => {
        const first = items[0]!;
        return (
          <section key={slug}>
            <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="m-0 text-lg font-medium leading-tight">{first.storefrontName}</h3>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  {items.length.toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-US')}{' '}
                  {locale === 'ar' ? 'منتج' : items.length === 1 ? 'product' : 'products'}
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link
                  href={`/account/products?store=${encodeURIComponent(slug)}`}
                  className="gap-1.5"
                >
                  {t('Manage')}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </header>
            <ProductGrid products={items} locale={locale} />
          </section>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grid + card primitives
// ---------------------------------------------------------------------------

function ProductGrid({ products, locale }: { products: ProductWithStorefront[]; locale?: string }) {
  return (
    <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} locale={locale} />
      ))}
    </ul>
  );
}

function ProductCard({ product: p, locale }: { product: ProductWithStorefront; locale?: string }) {
  const t = (text: string) => adminPhrase(locale, text);
  const editHref = `/account/products?store=${encodeURIComponent(p.storefrontSlug)}&edit=${encodeURIComponent(p.id)}`;
  return (
    <li>
      <Card className="group flex h-full flex-row gap-4 p-3 transition-colors hover:border-foreground/20">
        <Thumb url={p.imageUrl} title={p.title} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <a
              href={editHref}
              className="line-clamp-2 min-w-0 text-[15px] font-medium leading-tight hover:underline"
            >
              {p.title}
            </a>
            <ProductStatusBadge status={p.status} locale={locale} />
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {p.priceQar !== null ? (
              <span className="font-mono tabular-nums text-foreground">
                QAR {p.priceQar.toLocaleString('en-US')}
              </span>
            ) : (
              <span className="italic">{t('No price')}</span>
            )}
            {p.category ? (
              <>
                <Sep />
                <span>{p.category}</span>
              </>
            ) : null}
            {p.sourceUrl ? (
              <>
                <Sep />
                <a
                  href={p.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-4 hover:underline"
                >
                  {t('Source')}
                </a>
              </>
            ) : null}
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 pt-3">
            <span className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              {p.storefrontName}
            </span>
            <div className="flex items-center gap-1">
              <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                <a href={editHref}>{t('Edit')}</a>
              </Button>
              <AccountDeleteProductButton
                slug={p.storefrontSlug}
                locale={p.storefrontLocale}
                productId={p.id}
                productTitle={p.title}
              />
            </div>
          </div>
        </div>
      </Card>
    </li>
  );
}

function Thumb({ url, title }: { url: string | null; title: string }) {
  if (!url) {
    return (
      <span
        aria-hidden
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border bg-muted/40 font-mono text-sm text-muted-foreground"
      >
        {title.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      alt=""
      width={64}
      height={64}
      className="h-16 w-16 shrink-0 rounded-md border bg-muted/40 object-cover"
    />
  );
}

// ---------------------------------------------------------------------------
// Filter strips
// ---------------------------------------------------------------------------

function FilterStrip({
  storefronts,
  products,
  activeFilter,
  locale,
}: {
  storefronts: Storefront[];
  products: ProductWithStorefront[];
  activeFilter?: string;
  locale?: string;
}) {
  const t = (text: string) => adminPhrase(locale, text);
  const counts = new Map<string, number>();
  for (const p of products) {
    counts.set(p.storefrontSlug, (counts.get(p.storefrontSlug) ?? 0) + 1);
  }

  return (
    <div
      role="tablist"
      aria-label={locale === 'ar' ? 'التصفية حسب المتجر' : 'Filter by storefront'}
      className="flex flex-wrap items-center gap-2"
    >
      <Chip
        label={t('All stores')}
        count={products.length}
        active={!activeFilter}
        href="/account/products"
        locale={locale}
      />
      {storefronts.map((s) => (
        <Chip
          key={s.slug}
          label={s.businessName}
          count={counts.get(s.slug) ?? 0}
          active={activeFilter === s.slug}
          href={`/account/products?store=${encodeURIComponent(s.slug)}`}
          locale={locale}
        />
      ))}
    </div>
  );
}

function CategoryStrip({
  categories,
  counts,
  activeCategory,
  storeFilter,
  locale,
}: {
  categories: string[];
  counts: Map<string, number>;
  activeCategory?: string;
  storeFilter?: string;
  locale?: string;
}) {
  const t = (text: string) => adminPhrase(locale, text);
  const baseParams = new URLSearchParams();
  if (storeFilter) baseParams.set('store', storeFilter);
  const baseQs = baseParams.toString();
  const allHref = baseQs ? `/account/products?${baseQs}` : '/account/products';
  const total = Array.from(counts.values()).reduce((s, n) => s + n, 0);

  return (
    <div
      role="tablist"
      aria-label={locale === 'ar' ? 'التصفية حسب التصنيف' : 'Filter by category'}
      className="flex flex-wrap items-center gap-1.5 border-t border-dashed pt-3"
    >
      <span className="me-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {t('Categories')}
      </span>
      <Chip
        label={t('All')}
        count={total}
        active={!activeCategory}
        href={allHref}
        locale={locale}
      />
      {categories.map((c) => {
        const params = new URLSearchParams(baseParams);
        params.set('category', c);
        return (
          <Chip
            key={c}
            label={c}
            count={counts.get(c) ?? 0}
            active={activeCategory === c}
            href={`/account/products?${params.toString()}`}
            locale={locale}
          />
        );
      })}
    </div>
  );
}

function Chip({
  label,
  count,
  active,
  href,
  locale,
}: {
  label: string;
  count: number;
  active: boolean;
  href: string;
  locale?: string;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        'inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-card text-foreground hover:border-foreground/40 hover:bg-muted',
      )}
    >
      <span>{label}</span>
      <span
        className={cn('text-[10px] tabular-nums', active ? 'opacity-70' : 'text-muted-foreground')}
      >
        {count.toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-US')}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Status badge + small bits
// ---------------------------------------------------------------------------

function ProductStatusBadge({
  status,
  locale,
}: {
  status: 'active' | 'draft' | 'sold_out';
  locale?: string;
}) {
  const map: Record<typeof status, { label: string; className: string }> = {
    active: {
      label: 'Active',
      className: 'border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    },
    draft: {
      label: 'Draft',
      className: 'border-border bg-muted/40 text-muted-foreground',
    },
    sold_out: {
      label: 'Sold out',
      className: 'border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    },
  };
  const m = map[status];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]',
        m.className,
      )}
    >
      {adminPhrase(locale, m.label)}
    </span>
  );
}

function Sep() {
  return (
    <span aria-hidden className="text-muted-foreground/60">
      ·
    </span>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="items-center gap-2 border-dashed bg-muted/20 px-7 py-10 text-center text-sm leading-relaxed text-muted-foreground">
      {children}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectCategories(products: ProductWithStorefront[]): string[] {
  const set = new Set<string>();
  for (const p of products) set.add(p.category ?? 'Uncategorized');
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function countByCategory(products: ProductWithStorefront[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of products) {
    const k = p.category ?? 'Uncategorized';
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
