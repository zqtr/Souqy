import { listQuoteRequestsForStore } from '@/lib/apps/souqnasource/quotes';
import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/admin/primitives';

export async function QuotesTab({
  slug,
  locale,
}: {
  slug: string;
  locale: 'en' | 'ar';
}) {
  const list = await listQuoteRequestsForStore(slug, 100);
  const t = await getTranslations({ locale, namespace: 'apps.souqnasource.quotes' });

  if (list.length === 0) {
    return (
      <EmptyState
        eyebrow="Quote requests"
        title="No quotes sent yet"
        body={t('empty')}
        action={{ label: 'Find a supplier', href: '?tab=browse' }}
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
            {['Date', 'Listing', 'Supplier', ''].map((h, i) => (
              <th
                key={i}
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
          {list.map((q) => (
            <tr key={q.id}>
              <td style={{ ...cellStyle, color: 'var(--ink-muted)' }}>
                {new Date(q.createdAt).toLocaleString()}
              </td>
              <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                {q.listingId}
              </td>
              <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                {q.supplierId}
              </td>
              <td style={cellStyle}>
                <a
                  href={`?tab=quotes&import=${q.id}`}
                  style={{
                    color: 'var(--ink-strong)',
                    fontSize: 12.5,
                    fontWeight: 500,
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  {t('importManually')}
                </a>
              </td>
            </tr>
          ))}
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
