import Link from 'next/link';
import type { Storefront } from '@/lib/brief';
import { env } from '@/lib/env';

type Props = {
  /** All storefronts owned by the user. */
  storefronts: Storefront[];
  /** Optional `?store=` slug — pre-selects that storefront's jump card. */
  storeFilter?: string;
  /** The owning tab id, for chip-strip hrefs. */
  tabId: 'builder' | 'theme';
  /** Big serif headline at the top of the tab. */
  title: string;
  /** Short paragraph under the headline. */
  tagline: string;
  /** Label inside the gold CTA button (e.g. "Open Builder"). */
  ctaLabel: string;
  /** Resolves the dashboard URL for a given storefront slug. */
  dashboardPath: (slug: string) => string;
};

/**
 * Picker shown when the Builder is opened without a `&store=...` pin.
 * Once a store is selected the page swaps to a full-bleed inline
 * BuilderShell and never returns here. The card just steers the
 * founder into the right URL — no new-tab affordance, no dashboard jump.
 */
export function StorefrontJumpTab({
  storefronts,
  storeFilter,
  tabId,
  title,
  tagline,
  ctaLabel,
  dashboardPath,
}: Props) {
  if (storefronts.length === 0) {
    return (
      <section>
        <Header title={title} tagline={tagline} />
        <EmptyCard>
          No storefronts yet — open your first one and the {ctaLabel.toLowerCase()}{' '}
          editor unlocks.{' '}
          <Link
            href="/en/begin"
            style={{
              color: 'var(--admin-accent)',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Open your first storefront →
          </Link>
        </EmptyCard>
      </section>
    );
  }

  // Default pick: requested store if known, else most-recently-created.
  // `getStorefrontsForUser` returns rows ordered by `created_at desc`,
  // so the head of the array is the freshest storefront.
  const known = new Set(storefronts.map((s) => s.slug));
  const activeSlug =
    storeFilter && known.has(storeFilter) ? storeFilter : storefronts[0]!.slug;
  const active = storefronts.find((s) => s.slug === activeSlug)!;

  return (
    <section>
      <Header title={title} tagline={tagline} />

      {storefronts.length > 1 ? (
        <ChipStrip
          storefronts={storefronts}
          activeSlug={activeSlug}
          tabId={tabId}
        />
      ) : null}

      <JumpCard
        storefront={active}
        ctaLabel={ctaLabel}
        href={dashboardPath(active.slug)}
      />
    </section>
  );
}

function Header({ title, tagline }: { title: string; tagline: string }) {
  return (
    <header style={{ marginBottom: 22 }}>
      <h2
        style={{
          fontFamily: 'var(--font-serif)',
          fontWeight: 400,
          fontSize: 'clamp(24px, 3vw, 32px)',
          lineHeight: 1.15,
          margin: '0 0 8px',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.6,
          color: 'var(--ink-muted)',
          margin: 0,
          maxWidth: 620,
        }}
      >
        {tagline}
      </p>
    </header>
  );
}

function ChipStrip({
  storefronts,
  activeSlug,
  tabId,
}: {
  storefronts: Storefront[];
  activeSlug: string;
  tabId: 'builder' | 'theme';
}) {
  return (
    <div
      role="tablist"
      aria-label="Pick a storefront"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 22,
      }}
    >
      {storefronts.map((s) => {
        const active = s.slug === activeSlug;
        return (
          <Link
            key={s.slug}
            href={`?tab=${tabId}&store=${encodeURIComponent(s.slug)}`}
            role="tab"
            aria-selected={active}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '6px 12px',
              borderRadius: 999,
              border: `1px solid ${active ? 'var(--accent)' : 'var(--surface-rule-strong)'}`,
              background: active ? 'var(--accent)' : 'var(--surface-elevated)',
              color: active ? 'var(--ink-on-accent)' : 'var(--ink-strong)',
              textDecoration: 'none',
            }}
          >
            {s.businessName}
          </Link>
        );
      })}
    </div>
  );
}

function JumpCard({
  storefront,
  ctaLabel,
  href,
}: {
  storefront: Storefront;
  ctaLabel: string;
  href: string;
}) {
  const liveHost = `${storefront.slug}.${env.BRIEF_ROOT_DOMAIN}`;
  return (
    <article
      style={{
        border: '1px solid var(--surface-rule)',
        borderRadius: 14,
        padding: 'clamp(20px, 3vw, 32px)',
        background: 'var(--surface-elevated)',
        display: 'grid',
        gap: 18,
      }}
    >
      <div>
        <h3
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 400,
            fontSize: 'clamp(20px, 2.4vw, 26px)',
            lineHeight: 1.2,
            margin: '0 0 6px',
            letterSpacing: '-0.005em',
          }}
        >
          {storefront.businessName}
        </h3>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--ink-faint)',
          }}
        >
          {liveHost}
        </div>
      </div>

      <div
        className="flex items-center"
        style={{ gap: 14, flexWrap: 'wrap' }}
      >
        <Link
          href={href}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--accent)',
            color: 'var(--ink-on-accent)',
            padding: '12px 22px',
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          {ctaLabel} →
        </Link>
      </div>
    </article>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: '1px dashed var(--surface-rule-strong)',
        borderRadius: 10,
        padding: '32px 28px',
        textAlign: 'center',
        background: 'var(--surface-elevated)',
        fontSize: 14,
        lineHeight: 1.6,
        color: 'var(--ink-muted)',
      }}
    >
      {children}
    </div>
  );
}
