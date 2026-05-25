import { Surface } from '@/components/admin/primitives';
import { getRatesForStore } from '@/lib/apps/currency-converter';

/**
 * Configure-screen widget for the Currency Converter app. Renders the
 * live snapshot pulled by `getRatesForStore` so the founder can see at
 * a glance whether the FX feed is healthy.
 *
 * The fetch happens server-side at render time — no client work, no
 * widget juggling. If the upstream is unreachable we surface the
 * cached snapshot's age and a guidance line.
 */
export async function CurrencyConverterPanel({
  storefrontSlug,
}: {
  storefrontSlug: string;
}) {
  const snap = await getRatesForStore(storefrontSlug).catch(() => null);
  const ageMs = snap ? Date.now() - snap.fetchedAt : null;
  const stale = ageMs !== null && ageMs > 1000 * 60 * 60 * 6;

  return (
    <Surface padding={20}>
      <header style={{ marginBottom: 12 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--admin-accent)',
          }}
        >
          ◈ Live FX feed
        </div>
        <h3
          style={{
            margin: '4px 0 0',
            fontFamily: 'var(--font-serif, var(--font-sans))',
            fontWeight: 400,
            fontSize: 17,
            color: 'var(--ink-strong)',
          }}
        >
          QAR conversion rates
        </h3>
      </header>

      {snap ? (
        <>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13.5,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <tbody>
              {Object.entries(snap.rates)
                .filter(([k]) => k !== 'QAR')
                .map(([code, rate]) => (
                  <tr
                    key={code}
                    style={{
                      borderTop:
                        '1px solid color-mix(in srgb, var(--ink-strong) 7%, transparent)',
                    }}
                  >
                    <td style={{ padding: '8px 0', color: 'var(--ink-strong)' }}>
                      1 QAR =
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'right' }}>
                      {rate.toFixed(code === 'USD' || code === 'EUR' || code === 'GBP' ? 4 : 3)} {code}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p
            style={{
              margin: '12px 0 0',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.06em',
              color: stale ? 'var(--color-maroon, #8b3a3a)' : 'var(--ink-muted)',
            }}
          >
            {stale
              ? 'Showing cached rates — refreshing in the background'
              : `Live · refreshed ${ageMs !== null ? humanAge(ageMs) : ''} ago`}
          </p>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)' }}>
          Loading the latest rates. Visitors stay in QAR until they arrive — usually
          within a few seconds.
        </p>
      )}
    </Surface>
  );
}

function humanAge(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}
