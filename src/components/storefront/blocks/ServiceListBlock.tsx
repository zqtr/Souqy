import type { BlockRenderProps } from './BlockContext';
import type { ServiceListProps } from '@/lib/blocks/types';
import type { Product } from '@/lib/products';
import { InquireButton } from '../InquireButton';
import { formatPrice, pickProducts } from './helpers';

/**
 * Bordered service rows with a per-row Inquire button. Mirrors the legacy
 * ServiceList template — the seed maps salon / fitness / tailoring etc.
 * to this block.
 *
 * Two data modes:
 *   - `props.items` non-empty → use inline items authored on the block
 *     (turn the founder's products table into an optional dependency).
 *   - otherwise → fall back to the products table, filtered by category.
 */
export function ServiceListBlock({ block, ctx }: BlockRenderProps<ServiceListProps>) {
  const { products, storefront, vocabulary, isRtl } = ctx;
  const props = block.props;
  const inlineItems = (props.items ?? []).filter((it) => it.title?.trim().length);
  const items: Array<{
    id: string;
    title: string;
    description?: string;
    priceQar?: number | null;
    status?: 'active' | 'sold_out';
    backing?: Product;
  }> = inlineItems.length > 0
    ? inlineItems.map((it) => ({
        id: it.id,
        title: it.title,
        description: it.description,
        priceQar: it.priceQar,
        status: it.status,
      }))
    : pickProducts(products, props.category, props.limit).map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description ?? undefined,
        priceQar: p.priceQar,
        status: p.status as 'active' | 'sold_out' | undefined,
        backing: p,
      }));

  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const showInquire = props.showInquire ?? true;
  const heading = props.heading?.trim() || vocabulary.offerLabel;

  if (items.length === 0) {
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
        {isRtl ? 'الخدمات قادمة قريباً' : 'services coming soon'}
      </p>
    );
  }

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
      <ul className="m-0 p-0 flex flex-col" style={{ listStyle: 'none', gap: 18 }}>
        {items.map((p) => (
          <li
            key={p.id}
            style={{
              padding: 'clamp(20px, 2.5vw, 28px)',
              border: '1px solid color-mix(in srgb, var(--sf-accent) 22%, transparent)',
              background: 'color-mix(in srgb, var(--sf-ink) 3%, transparent)',
            }}
          >
            <div
              className="flex flex-wrap items-start justify-between gap-4"
              style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}
            >
              <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                <h3 style={{ margin: 0, fontFamily, fontSize: 18, fontWeight: 500 }}>
                  {p.title}
                  {p.status === 'sold_out' ? (
                    <span
                      style={{
                        marginInlineStart: 10,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'color-mix(in srgb, var(--sf-ink) 50%, transparent)',
                      }}
                    >
                      {isRtl ? 'متوقفة' : 'paused'}
                    </span>
                  ) : null}
                </h3>
                {p.description ? (
                  <p
                    style={{
                      margin: '8px 0 0',
                      fontFamily,
                      fontSize: 14,
                      lineHeight: 1.55,
                      color: 'color-mix(in srgb, var(--sf-ink) 70%, transparent)',
                    }}
                  >
                    {p.description}
                  </p>
                ) : null}
              </div>
              <div
                className="flex items-center gap-4"
                style={{ flex: '0 0 auto', flexDirection: isRtl ? 'row-reverse' : 'row' }}
              >
                {p.priceQar != null ? (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      color: 'var(--sf-accent)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatPrice(p.priceQar, isRtl)}
                  </span>
                ) : null}
                {showInquire && p.backing ? (
                  <InquireButton storefront={storefront} product={p.backing} />
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
