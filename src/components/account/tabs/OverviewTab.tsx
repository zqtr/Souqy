import Link from 'next/link';
import type { Storefront } from '@/lib/brief';
import { StorefrontRoster } from '@/components/account/StorefrontRoster';

type Props = {
  storefronts: Storefront[];
  /**
   * Total products across every storefront. Computed in the page so the
   * tab strip and the stats line use the same number without re-querying.
   */
  productCount: number;
};

/**
 * Overview tab — the founder's at-a-glance home for the account. A small
 * stats line summarises the roster, then the existing
 * `<StorefrontRoster>` carries the rest (Live / Offline groups + per-row
 * Manage / View live / Delete).
 */
export function OverviewTab({ storefronts, productCount }: Props) {
  const liveCount = storefronts.filter((s) => s.isPublished).length;
  const offlineCount = storefronts.length - liveCount;

  return (
    <>
      {storefronts.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 18,
            padding: '14px 18px',
            border: '1px solid var(--surface-rule)',
            borderRadius: 10,
            background: 'var(--surface-elevated)',
            marginBottom: 28,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-faint)',
          }}
        >
          <Stat label="Storefronts" value={storefronts.length} />
          <Divider />
          <Stat label="Live" value={liveCount} accent />
          <Divider />
          <Stat label="Offline" value={offlineCount} />
          <Divider />
          <Stat label="Products" value={productCount} />
        </div>
      ) : null}

      <StorefrontRoster storefronts={storefronts} />

      {storefronts.length > 0 ? (
        <div style={{ marginTop: 40 }}>
          <Link
            href="/en/begin"
            style={{
              display: 'inline-block',
              background: 'var(--color-gold)',
              color: 'var(--ink-on-gold)',
              padding: '12px 22px',
              borderRadius: 999,
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            Open another storefront →
          </Link>
        </div>
      ) : null}
    </>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
      <span
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 22,
          letterSpacing: 0,
          textTransform: 'none',
          color: accent ? 'var(--admin-accent)' : 'var(--ink-strong)',
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span>{label}</span>
    </span>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      style={{
        width: 1,
        background: 'var(--surface-rule-strong)',
        alignSelf: 'stretch',
      }}
    />
  );
}
