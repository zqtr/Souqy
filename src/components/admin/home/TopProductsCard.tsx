import Link from 'next/link';
import { Surface } from '@/components/admin/primitives';
import { topProductsByOrders } from '@/lib/products';

/**
 * "Top products" panel on the dashboard home. Renders the three
 * best-selling rows over the last 30 days for the active storefront —
 * a quick read on what's driving revenue without leaving the home
 * surface. Empty state nudges toward adding products or opening the
 * builder if the founder hasn't shipped yet.
 *
 * Server component: data fetch happens inline. The parent passes
 * `storeParam` so the row link lands on the same storefront context.
 */
type Props = {
  slug: string;
  storeParam: string;
  currency: string;
  labels: {
    title: string;
    viewAll: string;
    empty: string;
    emptyCta: string;
    ordersSuffix: string;
  };
};

export async function TopProductsCard({ slug, storeParam, currency, labels }: Props) {
  const rows = await topProductsByOrders(slug, 30, 3).catch(() => []);

  return (
    <Surface padding={0} style={{ overflow: 'hidden' }}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2
          className="m-0 font-serif text-lg font-medium"
          style={{ color: 'var(--ink-strong)' }}
        >
          {labels.title}
        </h2>
        <Link
          href={`/account/products${storeParam}`}
          className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          {labels.viewAll}
        </Link>
      </div>
      {rows.length > 0 ? (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li key={row.product.id} className="border-b border-border last:border-b-0">
              <Link
                href={`/account/products/${row.product.id}${storeParam}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-accent"
              >
                <Thumb url={row.product.imageUrl} title={row.product.title} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-foreground">
                    {row.product.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.ordersCount} {labels.ordersSuffix}
                  </span>
                </span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {`${currency} ${Intl.NumberFormat('en-GB').format(row.revenueQar)}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-2 px-4 py-8">
          <p
            className="m-0 text-sm"
            style={{ color: 'var(--ink-muted)' }}
          >
            {labels.empty}
          </p>
          <Link
            href={`/account/products${storeParam}`}
            className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            {labels.emptyCta}
          </Link>
        </div>
      )}
    </Surface>
  );
}

function Thumb({ url, title }: { url: string | null; title: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt=""
        width={40}
        height={40}
        loading="lazy"
        style={{
          width: 40,
          height: 40,
          objectFit: 'cover',
          borderRadius: 6,
          background: 'var(--surface-bg)',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={{
        width: 40,
        height: 40,
        borderRadius: 6,
        background: 'color-mix(in srgb, var(--ink-strong) 6%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: 14,
        color: 'var(--ink-muted)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {title.slice(0, 1).toUpperCase()}
    </div>
  );
}
