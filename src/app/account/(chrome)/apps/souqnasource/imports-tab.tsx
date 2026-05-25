import { listLinksForStore } from '@/lib/apps/souqnasource/links';
import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/admin/primitives';

export async function ImportsTab({
  slug,
  locale,
}: {
  slug: string;
  locale: 'en' | 'ar';
}) {
  const links = await listLinksForStore(slug);
  const t = await getTranslations({ locale, namespace: 'apps.souqnasource.imports' });

  if (links.length === 0) {
    return (
      <EmptyState
        eyebrow="Imports"
        title="No imported products yet"
        body={t('empty')}
        action={{ label: 'Browse the catalog', href: '?tab=browse' }}
      />
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          fontSize: 13,
        }}
      >
        <thead>
          <tr>
            {['Product', 'Supplier', 'Cost', 'Drift', 'Last sync'].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'start',
                  padding: '10px 12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-muted)',
                  borderBottom: '1px solid var(--surface-rule)',
                  fontWeight: 500,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {links.map((l) => {
            const driftAbs = l.priceDriftPct === null ? null : Math.abs(l.priceDriftPct);
            const driftTone =
              driftAbs === null
                ? 'var(--ink-muted)'
                : driftAbs >= 10
                  ? '#a4761c'
                  : 'var(--ink-strong)';
            return (
              <tr key={l.productId}>
                <td style={cellStyle}>
                  <a
                    href={`/account/products/${l.productId}`}
                    style={{
                      color: 'var(--ink-strong)',
                      textDecoration: 'underline',
                      textUnderlineOffset: 3,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                    }}
                  >
                    {l.productId.slice(0, 8)}…
                  </a>
                </td>
                <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {l.supplierId}
                </td>
                <td style={cellStyle}>
                  {l.supplierCost} {l.supplierCurrency}
                </td>
                <td style={{ ...cellStyle, color: driftTone }}>
                  {l.priceDriftPct === null ? '—' : `${l.priceDriftPct}%`}
                </td>
                <td style={{ ...cellStyle, color: 'var(--ink-muted)' }}>
                  {new Date(l.lastSyncedAt).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: '12px',
  borderBottom: '1px solid color-mix(in srgb, var(--ink-strong) 5%, transparent)',
  color: 'var(--ink-strong)',
};
