import type { ReactNode } from 'react';

type Props = {
  /** Display name — first name, then username, then email local-part. */
  displayName: string;
  /** Primary email shown verbatim. */
  email: string | null;
  /** Optional avatar URL from Clerk. */
  imageUrl: string | null;
  /** When the Clerk user was created. */
  memberSince: Date | null;
  /** OAuth provider names (e.g. ["google", "github"]). */
  providers: string[];
  /** Total storefronts in this account — surfaced on the profile card. */
  storefrontCount: number;
  /** Total live (published, non-expired) storefronts. */
  liveStorefrontCount: number;
  /** Total products across all storefronts. */
  productCount: number;
};

/**
 * Account information tab. Read-only profile card pulled from Clerk +
 * a quick stats line so the founder lands on something useful when they
 * click "Account" in the sidebar.
 *
 * Profile *editing* (changing email, password, connected accounts) lives
 * in the Clerk `<UserButton>` modal in the page header — duplicating that
 * surface here would just create two sources of truth. We tell the user
 * where to find it instead.
 */
export function AccountInfoTab({
  displayName,
  email,
  imageUrl,
  memberSince,
  providers,
  storefrontCount,
  liveStorefrontCount,
  productCount,
}: Props) {
  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <header>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--ink-faint)',
            marginBottom: 8,
          }}
        >
          Account
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 400,
            fontSize: 'clamp(26px, 3.4vw, 36px)',
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          Your profile.
        </h2>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--ink-muted)',
            margin: '8px 0 0',
            maxWidth: 580,
          }}
        >
          Identity used across every storefront under this account. To change
          any of it, open the avatar in the top-right.
        </p>
      </header>

      <section
        style={{
          border: '1px solid var(--surface-rule)',
          borderRadius: 14,
          padding: 'clamp(20px, 3vw, 28px)',
          background: 'var(--surface-elevated)',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: 20,
          alignItems: 'center',
        }}
      >
        <Avatar imageUrl={imageUrl} fallback={displayName} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 400,
              fontSize: 'clamp(20px, 2.4vw, 26px)',
              lineHeight: 1.15,
              letterSpacing: '-0.005em',
            }}
          >
            {displayName}
          </div>
          {email ? (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                letterSpacing: '0.04em',
                color: 'var(--ink-muted)',
                marginTop: 4,
                wordBreak: 'break-all',
              }}
            >
              {email}
            </div>
          ) : null}
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 12,
        }}
      >
        <Detail label="Storefronts" value={storefrontCount.toString()} />
        <Detail
          label="Live"
          value={`${liveStorefrontCount} of ${storefrontCount}`}
        />
        <Detail label="Products" value={productCount.toString()} />
        <Detail
          label="Member since"
          value={memberSince ? formatDate(memberSince) : '—'}
        />
        <Detail
          label="Signed in via"
          value={providers.length > 0 ? providers.join(' · ') : 'Email'}
        />
      </section>

      <p
        style={{
          fontSize: 12,
          color: 'var(--ink-faint)',
          margin: 0,
          lineHeight: 1.55,
        }}
      >
        Souqna never stores your password. Authentication runs through Clerk.
      </p>
    </div>
  );
}

function Avatar({
  imageUrl,
  fallback,
}: {
  imageUrl: string | null;
  fallback: string;
}) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={imageUrl}
        alt=""
        width={72}
        height={72}
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1px solid var(--surface-rule)',
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: 72,
        height: 72,
        borderRadius: '50%',
        background: 'var(--surface-bg)',
        border: '1px solid var(--surface-rule)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-serif)',
        fontSize: 28,
        color: 'var(--ink-muted)',
      }}
    >
      {fallback.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid var(--surface-rule)',
        borderRadius: 10,
        padding: '14px 16px',
        background: 'var(--surface-elevated)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--ink-faint)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 15,
          color: 'var(--ink-strong)',
          lineHeight: 1.3,
          fontWeight: 500,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
