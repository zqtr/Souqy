import { listListingsByCategory } from '@/lib/apps/souqnasource/listings';
import type { Category, ListingType } from '@/lib/apps/souqnasource/types';
import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/admin/primitives';
import { CategoryTree } from './category-tree';
import { BrowseFilters } from './browse-filters';
import { ListingCard } from './listing-card';

type Props = {
  slug: string;
  locale: 'en' | 'ar';
  searchParams: Record<string, string | string[] | undefined>;
};

function pickStr(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export async function BrowseTab({ slug, locale, searchParams }: Props) {
  const category = (pickStr(searchParams.category) ?? 'perfume-oud') as Category;
  const type = (pickStr(searchParams.type) ?? null) as ListingType | null;
  const items = await listListingsByCategory(category, type, 60);
  const t = await getTranslations({ locale, namespace: 'apps.souqnasource.browse' });
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(searchParams)) flat[k] = pickStr(v);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '200px 200px minmax(0, 1fr)',
        gap: 20,
        alignItems: 'flex-start',
        minWidth: 0,
      }}
      className="souqnasource-browse-grid"
    >
      <aside>
        <SidebarSectionLabel>Categories</SidebarSectionLabel>
        <CategoryTree current={category} locale={locale} />
      </aside>
      <aside>
        <SidebarSectionLabel>Filters</SidebarSectionLabel>
        <BrowseFilters current={flat} locale={locale} />
      </aside>
      <main style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.length === 0 ? (
          <EmptyState
            eyebrow="Catalog"
            title="No suppliers in this slice"
            body={t('empty')}
          />
        ) : (
          items.map((l) => (
            <ListingCard key={l.id} listing={l} slug={slug} locale={locale} />
          ))
        )}
      </main>
      <style>{`
        @media (max-width: 1100px) {
          .souqnasource-browse-grid {
            grid-template-columns: 180px minmax(0, 1fr) !important;
          }
          .souqnasource-browse-grid > aside:nth-of-type(2) {
            grid-column: 1 / -1;
            display: flex;
            gap: 12px;
            align-items: center;
            flex-wrap: wrap;
          }
        }
        @media (max-width: 720px) {
          .souqnasource-browse-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function SidebarSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--ink-muted)',
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}
