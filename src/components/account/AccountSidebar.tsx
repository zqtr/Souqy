import Link from 'next/link';
import { palette } from '@/lib/tokens';
import { ArchMark } from '@/components/primitives/ArchMark';
import type { AccountTabId } from './AccountTabs';

type Item = {
  id: AccountTabId;
  label: string;
};

type Group = {
  /** Order in the rail: 'primary' (top) or 'secondary' (bottom of the rail). */
  position: 'primary' | 'secondary';
  items: Item[];
};

type Props = {
  active: AccountTabId;
  groups: Group[];
  /** Preserved on every tab href so storefront context follows the founder. */
  store?: string;
};

/**
 * Slim icon rail for `/account`. Mirrors the dashboard `MiniRail`
 * exactly so navigation feels uniform across both surfaces:
 *   - 60px wide, dark gradient on a light page
 *   - ArchMark at the top, links back to /en (home)
 *   - Primary group up top, secondary pushed to the bottom with a hairline
 *   - 38x38 icon buttons, gold indicator bar on the rail edge for active
 *
 * Icon-only with `title` tooltips. Each row is a plain `<Link>` to
 * `?tab=<id>` and the active state is computed from props. The
 * `?store=` value is preserved across tab switches so a storefront
 * picked in Products follows you to Builder.
 */
export function AccountSidebar({ active, groups, store }: Props) {
  const buildHref = (id: AccountTabId) => {
    const params = new URLSearchParams();
    params.set('tab', id);
    if (store) params.set('store', store);
    return `?${params.toString()}`;
  };

  const primary = groups.find((g) => g.position === 'primary')?.items ?? [];
  const secondary = groups.find((g) => g.position === 'secondary')?.items ?? [];

  return (
    <nav
      aria-label="Account sections"
      className="souqna-account-rail"
      style={{
        width: 60,
        flex: '0 0 60px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        paddingTop: 14,
        paddingBottom: 14,
        borderRight: `1px solid ${palette.gold}1f`,
        background:
          'linear-gradient(180deg, rgba(31,28,25,0.72) 0%, rgba(20,17,14,0.78) 100%)',
        position: 'sticky',
        top: 0,
        height: '100dvh',
        boxShadow: 'inset -1px 0 0 rgba(201,169,97,0.06)',
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media (max-width: 767px) {
          .souqna-account-rail { width: 48px !important; flex-basis: 48px !important; padding-top: 10px !important; padding-bottom: 10px !important; }
          .souqna-account-rail a, .souqna-account-rail span[aria-disabled] { width: 34px !important; height: 34px !important; }
          .souqna-account-rail .souqna-account-rail-brand { margin-bottom: 8px !important; padding-bottom: 8px !important; }
        }
        .souqna-account-rail-item { transition: background 160ms ease, color 160ms ease, border-color 160ms ease, transform 160ms ease; }
        .souqna-account-rail-item:hover {
          background: rgba(201,169,97,0.08) !important;
          color: var(--color-sand-pale) !important;
        }
        .souqna-account-rail-item:active { transform: scale(0.96); }
      `,
        }}
      />

      <Link
        href="/en"
        title="Souqna · home"
        aria-label="Souqna home"
        className="souqna-account-rail-brand"
        style={{
          width: 40,
          height: 40,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
          marginBottom: 10,
          paddingBottom: 12,
          borderBottom: `1px solid ${palette.gold}1a`,
          textDecoration: 'none',
        }}
      >
        <ArchMark size={26} stroke={palette.gold} ariaLabel="Souqna" />
      </Link>

      {primary.map((it) => (
        <RailButton
          key={it.id}
          id={it.id}
          label={it.label}
          href={buildHref(it.id)}
          isActive={it.id === active}
        />
      ))}

      <div style={{ flex: 1 }} aria-hidden />

      {secondary.length > 0 ? (
        <div
          aria-hidden
          style={{
            width: 24,
            height: 1,
            background: `${palette.gold}26`,
            margin: '6px 0 8px',
          }}
        />
      ) : null}

      {secondary.map((it) => (
        <RailButton
          key={it.id}
          id={it.id}
          label={it.label}
          href={buildHref(it.id)}
          isActive={it.id === active}
        />
      ))}
    </nav>
  );
}

function RailButton({
  id,
  label,
  href,
  isActive,
}: {
  id: AccountTabId;
  label: string;
  href: string;
  isActive: boolean;
}) {
  const sharedStyle: React.CSSProperties = {
    width: 38,
    height: 38,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    border: `1px solid ${isActive ? palette.gold + '44' : 'transparent'}`,
    background: isActive
      ? 'linear-gradient(180deg, rgba(201,169,97,0.16), rgba(139,58,58,0.12))'
      : 'transparent',
    color: isActive
      ? 'var(--color-sand-pale)'
      : 'rgba(232,220,196,0.6)',
    textDecoration: 'none',
    cursor: 'pointer',
    position: 'relative',
  };

  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className="souqna-account-rail-item"
      style={sharedStyle}
    >
      {isActive ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: -11,
            top: 8,
            bottom: 8,
            width: 2,
            borderRadius: 2,
            background: palette.gold,
            boxShadow: `0 0 8px ${palette.gold}66`,
          }}
        />
      ) : null}
      <RailGlyph id={id} />
    </Link>
  );
}

function RailGlyph({ id }: { id: AccountTabId }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (id) {
    case 'overview':
      return (
        <svg {...common}>
          <path d="M3 12l9-8 9 8" />
          <path d="M5 10v10h14V10" />
          <path d="M10 20v-6h4v6" />
        </svg>
      );
    case 'account':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 20.5c1.5-3.6 4.4-5.5 7.5-5.5s6 1.9 7.5 5.5" />
        </svg>
      );
    case 'products':
      return (
        <svg {...common}>
          <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" />
          <path d="M3 7l9 4 9-4M12 21V11" />
        </svg>
      );
    case 'orders':
      return (
        <svg {...common}>
          <path d="M5 7h14l-1.4 9.4a2 2 0 0 1-2 1.6H8.4a2 2 0 0 1-2-1.6L5 7z" />
          <path d="M9 7V5a3 3 0 1 1 6 0v2" />
        </svg>
      );
    case 'billing':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 10h18" />
          <path d="M7 15h4" />
        </svg>
      );
    case 'builder':
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
        </svg>
      );
    case 'integrations':
      return (
        <svg {...common}>
          <path d="M10 3v4a3 3 0 0 1-3 3H3" />
          <path d="M14 3v4a3 3 0 0 0 3 3h4" />
          <path d="M10 21v-4a3 3 0 0 0-3-3H3" />
          <path d="M14 21v-4a3 3 0 0 1 3-3h4" />
        </svg>
      );
  }
}
