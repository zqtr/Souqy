import type { BlockRenderProps } from './BlockContext';
import type { MenuItem, MenuProps } from '@/lib/blocks/types';
import { AddToCartButton } from '../cart/AddToCartButton';
import { formatPrice, pickProducts } from './helpers';

/**
 * Cafe / restaurant menu: category-grouped rows with a dotted leader between
 * the title and the price. The dotted leader uses a flexbox spacer so it
 * works with arbitrary copy lengths without breaking on overflow.
 *
 * Two data sources are supported:
 *   - `props.items` (inline) — used by templates (Maison) that ship a
 *     fully populated bilingual menu before any products exist.
 *   - The storefront's products table — the original behaviour.
 *
 * Inline items win when present and non-empty.
 */
export function MenuBlock({ block, ctx }: BlockRenderProps<MenuProps>) {
  const { products, vocabulary, isRtl, categoriesBySlug } = ctx;
  const props = block.props;
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const serifFamily = isRtl ? 'var(--font-arabic-serif), serif' : 'var(--font-serif), serif';

  const inline = props.items ?? [];
  const useInline = inline.length > 0;
  const rows: NormalizedRow[] = useInline
    ? inline
        .slice(0, props.limit ?? inline.length)
        .map(normalizeFromItem)
    : pickProducts(products, {
        category: props.category,
        categorySlug: props.categorySlug,
        categoriesBySlug,
        limit: props.limit,
      }).map(normalizeFromProduct);

  if (rows.length === 0) {
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
        {isRtl ? 'القائمة قادمة قريباً' : 'menu coming soon'}
      </p>
    );
  }

  const fallback = isRtl ? 'الأطباق' : 'dishes';
  const grouped = (props.groupByCategory ?? true)
    ? groupBy(rows, fallback)
    : [{ key: '', items: rows }];

  const heading = props.heading?.trim() || vocabulary.offerLabel;

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
          textAlign: isRtl ? 'right' : 'left',
        }}
      >
        {heading}
      </div>
      <div className="flex flex-col" style={{ gap: 'clamp(28px, 4vw, 48px)' }}>
        {grouped.map((group) => (
          <div key={group.key || 'all'}>
            {group.key ? (
              <h2
                style={{
                  fontFamily: serifFamily,
                  fontStyle: 'italic',
                  fontWeight: 400,
                  fontSize: 'clamp(20px, 2.4vw, 26px)',
                  margin: '0 0 16px',
                  paddingBottom: 8,
                  borderBottom: '1px solid color-mix(in srgb, var(--sf-accent) 30%, transparent)',
                  textAlign: isRtl ? 'right' : 'left',
                }}
              >
                {group.key}
              </h2>
            ) : null}
            <ul className="m-0 p-0 flex flex-col" style={{ listStyle: 'none', gap: 14 }}>
              {group.items.map((row) => (
                <li
                  key={row.id}
                  className="flex items-baseline gap-3"
                  style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}
                >
                  <div
                    style={{
                      flex: '1 1 auto',
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 10,
                      flexDirection: isRtl ? 'row-reverse' : 'row',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        flex: '0 1 auto',
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          fontFamily,
                          fontSize: 15,
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          opacity: row.soldOut ? 0.5 : 1,
                          textDecoration: row.soldOut ? 'line-through' : 'none',
                        }}
                      >
                        {row.title}
                      </span>
                      {row.titleAlt ? (
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10.5,
                            letterSpacing: '0.04em',
                            color: 'color-mix(in srgb, var(--sf-ink) 55%, transparent)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {row.titleAlt}
                        </span>
                      ) : null}
                    </div>
                    <span
                      aria-hidden
                      style={{
                        flex: '1 1 auto',
                        borderBottom:
                          '1px dotted color-mix(in srgb, var(--sf-accent) 35%, transparent)',
                        transform: 'translateY(-4px)',
                        minWidth: 24,
                      }}
                    />
                    {row.description ? (
                      <span
                        style={{
                          fontFamily,
                          fontSize: 12,
                          color: 'color-mix(in srgb, var(--sf-ink) 60%, transparent)',
                          flex: '0 1 auto',
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.description}
                      </span>
                    ) : null}
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--sf-accent)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.soldOut
                      ? isRtl
                        ? 'نفذ'
                        : 'sold out'
                      : formatPrice(row.priceQar, isRtl)}
                  </span>
                  {row.cartProductId && row.priceQar !== null && !row.soldOut ? (
                    <AddToCartButton
                      productId={row.cartProductId}
                      title={row.title}
                      priceQar={row.priceQar}
                      imageUrl={row.imageUrl}
                      sizeOptions={row.sizeOptions}
                      allowCustomSize={row.allowCustomSize}
                      requiresHeightInput={row.requiresHeightInput}
                      heightInputLabel={row.heightInputLabel}
                      heightOptions={row.heightOptions}
                      variant="icon"
                      isRtl={isRtl}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

type NormalizedRow = {
  id: string;
  title: string;
  titleAlt?: string;
  description: string | null;
  category: string;
  priceQar: number | null;
  soldOut: boolean;
  /**
   * Real DB-backed products carry the fields needed to drop a line into
   * the cart. Inline menu items (Maison-style decorative copy) don't, so
   * the renderer skips the cart affordance for them.
   */
  cartProductId?: string;
  imageUrl?: string | null;
  sizeOptions?: string[];
  allowCustomSize?: boolean;
  requiresHeightInput?: boolean;
  heightInputLabel?: string | null;
  heightOptions?: string[];
};

function normalizeFromItem(item: MenuItem): NormalizedRow {
  return {
    id: item.id,
    title: item.title,
    titleAlt: item.titleAlt,
    description: item.description ?? null,
    category: (item.category ?? '').trim(),
    priceQar: typeof item.priceQar === 'number' ? item.priceQar : null,
    soldOut: item.status === 'sold_out',
  };
}

function normalizeFromProduct(
  p: BlockRenderProps<MenuProps>['ctx']['products'][number],
): NormalizedRow {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    category: (p.category ?? '').trim(),
    priceQar: p.priceQar,
    soldOut: false,
    cartProductId: p.id,
    imageUrl: p.imageUrl,
    sizeOptions: p.sizeOptions,
    allowCustomSize: p.allowCustomSize,
    requiresHeightInput: p.requiresHeightInput,
    heightInputLabel: p.heightInputLabel,
    heightOptions: p.heightOptions,
  };
}

function groupBy(rows: NormalizedRow[], fallback: string) {
  const map = new Map<string, NormalizedRow[]>();
  for (const r of rows) {
    const key = r.category || fallback;
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return Array.from(map.entries()).map(([key, list]) => ({ key, items: list }));
}
