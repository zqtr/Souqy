import Link from 'next/link';
import { adminPhrase } from '@/components/admin/adminLocale';

/**
 * Two-pill segmented control under the products page header. Drives
 * `?view=products|categories` so the products list and the categories
 * list live at the same URL — link-shareable, refresh-survivable, and
 * compatible with a single back stack.
 */
type View = 'products' | 'categories';

export function ProductsSubNav({
  view,
  storeFilter,
  locale,
}: {
  view: View;
  storeFilter?: string;
  locale?: string;
}) {
  const t = (text: string) => adminPhrase(locale, text);
  const productsHref = buildHref('products', storeFilter);
  const categoriesHref = buildHref('categories', storeFilter);
  return (
    <nav
      aria-label="Products sub-navigation"
      style={{
        display: 'inline-flex',
        gap: 4,
        padding: 4,
        background: 'var(--surface-elevated)',
        border: '1px solid var(--surface-rule)',
        borderRadius: 999,
        marginBottom: 22,
      }}
    >
      <Pill href={productsHref} active={view === 'products'} label={t('Products')} />
      <Pill
        href={categoriesHref}
        active={view === 'categories'}
        label={t('Categories')}
      />
    </nav>
  );
}

function Pill({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      style={{
        padding: '8px 16px',
        borderRadius: 999,
        background: active ? 'var(--ink-strong)' : 'transparent',
        color: active ? 'var(--surface-bg)' : 'var(--ink-muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        textDecoration: 'none',
        transition: 'background-color 140ms, color 140ms',
      }}
    >
      {label}
    </Link>
  );
}

function buildHref(view: View, storeFilter?: string): string {
  const params = new URLSearchParams();
  if (view !== 'products') params.set('view', view);
  if (storeFilter) params.set('store', storeFilter);
  const qs = params.toString();
  return qs ? `/account/products?${qs}` : '/account/products';
}
