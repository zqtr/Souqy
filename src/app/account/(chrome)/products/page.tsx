import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { getStorefront, getStorefrontsForUser } from '@/lib/brief';
import { getProduct, getProductsForUser } from '@/lib/products';
import {
  getCategories,
  getCategoriesForUser,
  getCategory,
  getProductCategoryIds,
} from '@/lib/categories';
import { getCopy } from '@/content/copy';
import { ProductsTab } from '@/components/account/tabs/ProductsTab';
import { ProductModal } from '@/components/admin/products/ProductModal';
import { ProductsSubNav } from '@/components/admin/products/ProductsSubNav';
import { DemoProductsBanner } from '@/components/admin/products/DemoProductsBanner';
import { CategoriesView } from '@/components/admin/categories/CategoriesView';
import { CategoryModal } from '@/components/admin/categories/CategoryModal';
import { PageHeader } from '@/components/admin/primitives';
import { getPlan } from '@/lib/billing';
import { adminPhrase } from '@/components/admin/adminLocale';

/**
 * Products + Categories surface. Two views share this URL — driven by
 * `?view=`:
 *   - `products`   (default) — cross-storefront catalogue list
 *   - `categories` — first-class category records (migration 011)
 *
 * Both views support `?new=1` and `?edit=ID` to mount the matching
 * centered modal on top, so creating / editing never leaves the page.
 */
type View = 'products' | 'categories';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    view?: string | string[];
    store?: string | string[];
    category?: string | string[];
    new?: string | string[];
    edit?: string | string[];
    import?: string | string[];
  }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/products');
  const locale = (await cookies()).get('NEXT_LOCALE')?.value;
  const t = (text: string) => adminPhrase(locale, text);

  const sp = (await searchParams) ?? {};
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const viewRaw = pick(sp.view);
  const view: View = viewRaw === 'categories' ? 'categories' : 'products';
  const storeFilter = pick(sp.store);
  const categoryFilter = pick(sp.category);
  const isNew = pick(sp.new) === '1' || pick(sp.new) === 'true';
  const editId = pick(sp.edit);
  const importOpen = pick(sp.import) === '1' || pick(sp.import) === 'true';

  const [storefronts, products, categoriesAcrossUser, currentPlan] = await Promise.all([
    getStorefrontsForUser(userId),
    getProductsForUser(userId),
    getCategoriesForUser(userId),
    getPlan(userId),
  ]);

  const known = new Set(storefronts.map((s) => s.slug));
  const requestedSlug = storeFilter && known.has(storeFilter) ? storeFilter : undefined;
  const resolvedSlug = requestedSlug ?? storefronts[0]?.slug;
  const ownedStoreSlug = resolvedSlug && known.has(resolvedSlug) ? resolvedSlug : undefined;

  const activeStorefront = ownedStoreSlug ? await getStorefront(ownedStoreSlug) : null;

  // ---------------------------------------------------------------------
  // Modal data — fetched lazily depending on which view + which row
  // (if any) the founder is editing. Centralised here so the client
  // components never have to round-trip the DB themselves.
  // ---------------------------------------------------------------------
  const editingProduct =
    view === 'products' && editId && activeStorefront
      ? await getProduct(activeStorefront.slug, editId)
      : null;
  if (view === 'products' && editId && activeStorefront && !editingProduct) {
    notFound();
  }

  const editingProductCategoryIds =
    view === 'products' && editingProduct ? await getProductCategoryIds(editingProduct.id) : [];

  const editingCategory =
    view === 'categories' && editId && activeStorefront
      ? await getCategory(activeStorefront.slug, editId)
      : null;
  if (view === 'categories' && editId && activeStorefront && !editingCategory) {
    notFound();
  }

  const activeStoreCategories = activeStorefront ? await getCategories(activeStorefront.slug) : [];
  const modalLocale = locale === 'ar' ? 'ar' : activeStorefront?.locale;

  const productModalOpen = view === 'products' && !!activeStorefront && (isNew || !!editingProduct);
  const categoryModalOpen =
    view === 'categories' && !!activeStorefront && (isNew || !!editingCategory);

  const headerSubtitle =
    view === 'categories'
      ? locale === 'ar'
        ? `${categoriesAcrossUser.length.toLocaleString('ar-QA')} تصنيف عبر كل متاجرك.`
        : `${categoriesAcrossUser.length} categor${categoriesAcrossUser.length === 1 ? 'y' : 'ies'} across all your storefronts.`
      : activeStorefront
        ? locale === 'ar'
          ? `${products.length.toLocaleString('ar-QA')} منتج عبر كل متاجرك.`
          : `${products.length} product${products.length === 1 ? '' : 's'} across all your storefronts.`
        : locale === 'ar'
          ? `${products.length.toLocaleString('ar-QA')} منتج محفوظ.`
          : `${products.length} product${products.length === 1 ? '' : 's'} on file.`;

  const closeBase =
    view === 'categories'
      ? `/account/products?view=categories${activeStorefront ? `&store=${activeStorefront.slug}` : ''}`
      : `/account/products${activeStorefront ? `?store=${activeStorefront.slug}` : ''}`;

  return (
    <>
      <PageHeader
        eyebrow={t('Catalogue')}
        title={t('Products')}
        subtitle={headerSubtitle}
        primaryAction={
          activeStorefront
            ? {
                label: view === 'categories' ? t('Add category') : t('Add product'),
                href:
                  view === 'categories'
                    ? `/account/products?view=categories&new=1&store=${activeStorefront.slug}`
                    : `/account/products?new=1&store=${activeStorefront.slug}`,
              }
            : undefined
        }
        secondaryActions={
          activeStorefront && view === 'products'
            ? [
                {
                  label: t('Import products'),
                  href: `/account/products?store=${activeStorefront.slug}&import=1`,
                },
                {
                  label: t('Export CSV'),
                  href: `/api/products/export?store=${activeStorefront.slug}`,
                },
              ]
            : undefined
        }
      />

      <ProductsSubNav view={view} storeFilter={storeFilter} locale={locale} />

      {view === 'products' && activeStorefront
        ? (() => {
            const slugForBanner = activeStorefront.slug;
            const demoCount = products.filter(
              (p) => p.storefrontSlug === slugForBanner && p.isDemo,
            ).length;
            const isAr = activeStorefront.locale === 'ar';
            const bannerLabels = isAr
              ? {
                  title: 'منتجات تجريبية',
                  body: 'هذه المنتجات أُضيفت تلقائياً عند اختيار قالبك. عدّلها لتصبح ملكك، أو احذفها كلها للبدء بكتالوج فارغ.',
                  cta: 'حذف المنتجات التجريبية',
                  busy: 'جارٍ الحذف…',
                  confirm: 'تأكيد — حذف الكل',
                  successSuffix: 'منتجات تجريبية تم حذفها',
                }
              : {
                  title: 'Sample products',
                  body: 'These products were seeded when you picked your template. Edit them to make them yours, or remove the whole set to start with an empty catalogue.',
                  cta: 'Remove sample products',
                  busy: 'Removing…',
                  confirm: 'Confirm — remove all',
                  successSuffix: 'sample products removed',
                };
            return demoCount > 0 ? (
              <DemoProductsBanner slug={slugForBanner} count={demoCount} labels={bannerLabels} />
            ) : null;
          })()
        : null}

      {view === 'categories' ? (
        <CategoriesView
          storefronts={storefronts}
          categories={categoriesAcrossUser}
          storeFilter={storeFilter}
        />
      ) : (
        <ProductsTab
          storefronts={storefronts}
          products={products}
          storeFilter={storeFilter}
          categoryFilter={categoryFilter}
          importOpen={importOpen}
          dashboardLocale={locale}
        />
      )}

      {productModalOpen && activeStorefront ? (
        <ProductModal
          open
          mode={editingProduct ? 'edit' : 'create'}
          storefrontSlug={activeStorefront.slug}
          storefrontName={activeStorefront.businessName}
          locale={modalLocale ?? activeStorefront.locale}
          copy={getCopy(modalLocale ?? activeStorefront.locale)}
          initial={editingProduct ?? undefined}
          categories={activeStoreCategories}
          initialCategoryIds={editingProductCategoryIds}
          currentPlan={currentPlan}
          closeHref={closeBase}
        />
      ) : null}

      {categoryModalOpen && activeStorefront ? (
        <CategoryModal
          open
          mode={editingCategory ? 'edit' : 'create'}
          storefrontSlug={activeStorefront.slug}
          storefrontName={activeStorefront.businessName}
          initial={editingCategory ?? undefined}
          closeHref={closeBase}
        />
      ) : null}
    </>
  );
}
