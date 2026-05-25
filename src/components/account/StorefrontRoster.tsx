import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { env } from '@/lib/env';
import type { Storefront } from '@/lib/brief';
import { storefrontBaseUrl } from '@/lib/storefrontUrl';
import { DeleteStorefrontButton } from '@/components/dashboard/DeleteStorefrontButton';

type Props = {
  storefronts: Storefront[];
  /**
   * Optional slug whose card should be visually pinned (gold/maroon ring +
   * "Editing" chip). Used by the dashboard Settings view to mark which
   * storefront the founder came from. The /account page passes none.
   */
  currentSlug?: string;
  /**
   * Optional override for the empty-live hint. Lets the dashboard Settings
   * view reference the current storefront slug while /account shows a more
   * generic message.
   */
  emptyLiveHint?: ReactNode;
};

/**
 * Shared "your storefronts" surface used by both `/account` and the
 * dashboard Settings tab. Splits the roster into two groups so the
 * founder can tell at a glance what the public web sees vs what's still
 * a private draft, and surfaces the destructive action inline.
 */
export function StorefrontRoster({ storefronts, currentSlug, emptyLiveHint }: Props) {
  if (storefronts.length === 0) {
    return (
      <div
        style={{
          border: '1px dashed var(--surface-rule-strong)',
          borderRadius: 10,
          padding: '40px 28px',
          textAlign: 'center',
          background: 'var(--surface-elevated)',
        }}
      >
        <p style={{ fontSize: 14, color: 'var(--ink-muted)', marginBottom: 18 }}>
          No storefronts yet.
        </p>
        <Link
          href="/en/begin"
          style={{
            display: 'inline-block',
            background: 'var(--color-gold)',
            color: 'var(--color-ink)',
            border: '1px solid var(--color-gold)',
            padding: '12px 22px',
            borderRadius: 999,
            fontSize: 13,
            textDecoration: 'none',
            letterSpacing: '0.01em',
          }}
        >
          Open your first storefront →
        </Link>
      </div>
    );
  }

  const sorted = currentSlug
    ? [...storefronts].sort((a, b) => {
        if (a.slug === currentSlug) return -1;
        if (b.slug === currentSlug) return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
    : [...storefronts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const live = sorted.filter((s) => s.isPublished);
  const offline = sorted.filter((s) => !s.isPublished);

  return (
    <>
      <SectionHeading
        label="Live"
        count={live.length}
        dot="var(--admin-accent)"
        hint={
          live.length === 1
            ? '1 storefront on the public web'
            : `${live.length} storefronts on the public web`
        }
      />
      {live.length === 0 ? (
        <EmptyHint>
          {emptyLiveHint ?? (
            <>
              Nothing published yet. Open the builder, then hit{' '}
              <strong>Publish</strong> to put a storefront on{' '}
              <code style={mono}>*.{env.BRIEF_ROOT_DOMAIN}</code>.
            </>
          )}
        </EmptyHint>
      ) : (
        <Grid storefronts={live} currentSlug={currentSlug} live />
      )}

      <div style={{ height: 36 }} />

      <SectionHeading
        label="Offline"
        count={offline.length}
        dot="var(--ink-faint)"
        hint={offline.length === 1 ? '1 private draft' : `${offline.length} private drafts`}
      />
      {offline.length === 0 ? (
        <EmptyHint>
          No drafts. Every storefront you've started is currently live.
        </EmptyHint>
      ) : (
        <Grid storefronts={offline} currentSlug={currentSlug} live={false} />
      )}
    </>
  );
}

const mono: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  background: 'var(--surface-elevated)',
  padding: '1px 6px',
  borderRadius: 4,
  border: '1px solid var(--surface-rule)',
};

function SectionHeading({
  label,
  count,
  dot,
  hint,
}: {
  label: string;
  count: number;
  dot: string;
  hint: string;
}) {
  return (
    <div
      className="flex items-baseline justify-between"
      style={{ marginBottom: 14, gap: 12, flexWrap: 'wrap' }}
    >
      <div className="flex items-center" style={{ gap: 10 }}>
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: dot,
            display: 'inline-block',
            boxShadow: `0 0 0 3px color-mix(in srgb, ${dot} 18%, transparent)`,
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--ink-strong)',
          }}
        >
          {label} · {count}
        </span>
      </div>
      <span
        style={{
          fontSize: 12,
          color: 'var(--ink-faint)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {hint}
      </span>
    </div>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        border: '1px dashed var(--surface-rule-strong)',
        borderRadius: 10,
        padding: '22px 24px',
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

function Grid({
  storefronts,
  currentSlug,
  live,
}: {
  storefronts: Storefront[];
  currentSlug?: string;
  live: boolean;
}) {
  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'grid',
        gap: 14,
      }}
    >
      {storefronts.map((s) => (
        <Row
          key={s.slug}
          storefront={s}
          isCurrent={s.slug === currentSlug}
          live={live}
        />
      ))}
    </ul>
  );
}

function Row({
  storefront: s,
  isCurrent,
  live,
}: {
  storefront: Storefront;
  isCurrent: boolean;
  live: boolean;
}) {
  const url = storefrontBaseUrl(s.slug);
  return (
    <li
      style={{
        border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--surface-rule)'}`,
        borderRadius: 10,
        padding: '20px 22px',
        background: 'var(--surface-elevated)',
        display: 'grid',
        gap: 14,
        boxShadow: isCurrent
          ? '0 0 0 3px var(--accent-soft)'
          : '0 1px 2px color-mix(in srgb, #1f1b16 4%, transparent)',
      }}
    >
      <div
        className="flex items-baseline justify-between"
        style={{ gap: 16, flexWrap: 'wrap' }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            className="flex items-center"
            style={{ gap: 10, marginBottom: 4, flexWrap: 'wrap' }}
          >
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 24,
                lineHeight: 1.15,
              }}
            >
              {s.businessName}
            </div>
            {isCurrent ? (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-on-accent)',
                  background: 'var(--accent)',
                  padding: '3px 8px',
                  borderRadius: 999,
                }}
              >
                Editing
              </span>
            ) : null}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.08em',
              color: 'var(--ink-faint)',
              textTransform: 'uppercase',
            }}
          >
            {s.slug}.{env.BRIEF_ROOT_DOMAIN}
          </div>
        </div>
        <div className="flex items-center" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: live ? 'var(--admin-accent)' : 'var(--ink-faint)',
              border: `1px solid ${live ? 'var(--admin-accent)' : 'var(--surface-rule-strong)'}`,
              padding: '3px 8px',
              borderRadius: 999,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: live ? 'var(--admin-accent)' : 'var(--ink-faint)',
                display: 'inline-block',
              }}
            />
            {live ? 'Live' : 'Offline'}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.1em',
              color: 'var(--admin-accent)',
              textTransform: 'uppercase',
            }}
          >
            {s.locale === 'ar' ? 'العربية' : 'English'}
          </span>
        </div>
      </div>
      <div
        className="flex flex-wrap items-center justify-between"
        style={{ gap: 10 }}
      >
        <div className="flex flex-wrap items-center" style={{ gap: 10 }}>
          {live ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 13,
                padding: '8px 14px',
                border: '1px solid var(--surface-rule-strong)',
                borderRadius: 999,
                color: 'var(--ink-strong)',
                textDecoration: 'none',
              }}
            >
              View live ↗
            </a>
          ) : null}
          <Link
            href={`/account/builder?store=${encodeURIComponent(s.slug)}`}
            style={{
              fontSize: 13,
              padding: '8px 14px',
              background: 'var(--accent)',
              color: 'var(--ink-on-accent)',
              borderRadius: 999,
              textDecoration: 'none',
            }}
          >
            {isCurrent ? 'Open builder' : 'Manage'}
          </Link>
          <Link
            href={`/account?tab=products&store=${encodeURIComponent(s.slug)}`}
            style={{
              fontSize: 13,
              padding: '8px 14px',
              border: '1px solid var(--surface-rule-strong)',
              borderRadius: 999,
              color: 'var(--ink-strong)',
              textDecoration: 'none',
            }}
          >
            Products
          </Link>
        </div>
        <DeleteStorefrontButton
          slug={s.slug}
          businessName={s.businessName}
          briefRootDomain={env.BRIEF_ROOT_DOMAIN}
        />
      </div>
    </li>
  );
}
