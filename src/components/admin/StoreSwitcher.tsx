'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useStorefronts, type StorefrontSummary } from './StorefrontContext';
import { ChevronDown, CheckGlyph } from './glyphs';
import { PLAN_LIMITS, storefrontCapForPlan } from '@/lib/plans';

/**
 * Active-store popover. Closed state shows the active storefront's
 * business name + a status dot; click opens a list of every store the
 * founder owns plus a "Create new store" CTA.
 *
 * Each option is a plain `<Link>` to the same pathname with
 * `?store=<slug>` flipped — the layout reads that param and updates the
 * StorefrontProvider value. We avoid any client-side router push so a
 * shop switch hits the network exactly once and SSR re-renders the
 * page with the new store's data.
 */
export function StoreSwitcher() {
  const { storefronts, active, plan, atStorefrontCap } = useStorefronts();
  const cap = storefrontCapForPlan(plan);
  const planLabel = PLAN_LIMITS[plan].label;
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname() ?? '/account';
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const buildHref = (slug: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('store', slug);
    return `${pathname}?${params.toString()}`;
  };
  const activeStatus = active?.isPublished ? 'Live' : 'Draft';

  /**
   * Next 14's client-side Router Cache keys layouts/pages by pathname,
   * not by query string — `router.push` + `router.refresh` to the same
   * pathname with a different `?store=` can keep showing the previously
   * active store in some pages because the cached RSC payload wins. A
   * full page navigation guarantees the server re-renders the layout,
   * KPI strip, sidebar, and page body with the picked store as the
   * active one. The trade-off (a single network round trip) is fine
   * because switching stores is rare and the user's complaint was that
   * silent switching wasn't working.
   */
  const handlePick = (slug: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (slug === active?.slug) {
      setOpen(false);
      return;
    }
    e.preventDefault();
    setOpen(false);
    try {
      localStorage.setItem('souqna.activeStore', slug);
    } catch {
      /* ignore quota / privacy */
    }
    window.location.assign(buildHref(slug));
  };

  if (storefronts.length === 0) {
    return (
      <Link
        href="/begin"
        className="souqna-store-switcher souqna-store-switcher--empty"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          borderRadius: 10,
          textDecoration: 'none',
          color: 'var(--ink-strong)',
          background: 'rgba(201,169,97,0.08)',
          border: '1px solid color-mix(in srgb, var(--admin-accent) 35%, transparent)',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 22,
            height: 22,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            background: 'var(--admin-accent)',
            color: '#fff',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}
        >
          +
        </span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>Create your store</span>
      </Link>
    );
  }

  return (
    <div
      ref={popRef}
      className="souqna-store-switcher"
      dir="ltr"
      style={{ position: 'relative', minWidth: 0 }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="souqna-store-switcher-button"
        style={{
          width: '100%',
          minWidth: 0,
          display: 'grid',
          gridTemplateColumns: '34px minmax(0, 1fr) auto',
          alignItems: 'center',
          gap: 10,
          padding: '11px 12px',
          borderRadius: 14,
          background: open
            ? 'color-mix(in srgb, var(--admin-accent) 12%, var(--surface-elevated))'
            : 'color-mix(in srgb, var(--surface-elevated) 72%, transparent)',
          border: '1px solid var(--surface-rule)',
          color: 'var(--ink-strong)',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          textAlign: 'start',
          boxShadow: open ? 'var(--shadow-card)' : 'none',
          transition: 'background 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
        }}
      >
        <StoreInitial active={active} large />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
              marginBottom: 3,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--ink-faint)',
              }}
            >
              Website
            </span>
            {active ? (
              <span
                style={{
                  flexShrink: 0,
                  borderRadius: 999,
                  padding: '2px 6px',
                  background: active.isPublished
                    ? 'color-mix(in srgb, #2f7d5b 16%, transparent)'
                    : 'color-mix(in srgb, var(--ink-muted) 12%, transparent)',
                  color: active.isPublished ? '#67c79a' : 'var(--ink-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  fontWeight: 600,
                  lineHeight: 1,
                  textTransform: 'uppercase',
                }}
              >
                {activeStatus}
              </span>
            ) : null}
          </span>
          <span
            dir="auto"
            style={{
              display: 'block',
              fontSize: 13.5,
              fontWeight: 600,
              color: 'var(--ink-strong)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              unicodeBidi: 'plaintext',
            }}
          >
            {active?.businessName ?? 'No store selected'}
          </span>
          <span
            dir="ltr"
            style={{
              display: 'block',
              fontSize: 11,
              color: 'var(--ink-muted)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: 0,
              textTransform: 'lowercase',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textAlign: 'start',
            }}
          >
            {active ? `${active.slug}.souqna.qa` : '—'}
          </span>
        </span>
        <span
          aria-hidden
          style={{
            width: 24,
            height: 24,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
            background: 'color-mix(in srgb, var(--ink-strong) 7%, transparent)',
            color: 'var(--ink-muted)',
          }}
        >
          <ChevronDown size={14} />
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Switch storefront"
          className="souqna-store-switcher-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            zIndex: 80,
            width: 'min(360px, calc(100vw - 32px))',
            padding: 8,
            borderRadius: 16,
            background: 'var(--surface-overlay, var(--surface-bg))',
            border: '1px solid var(--surface-rule-strong)',
            boxShadow: 'var(--shadow-popover)',
            maxHeight: 420,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div
            style={{
              padding: '8px 10px 10px',
              borderBottom: '1px solid var(--surface-rule)',
              marginBottom: 4,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--ink-faint)',
              }}
            >
              Choose website
            </div>
            <div
              style={{
                marginTop: 4,
                color: 'var(--ink-muted)',
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              Switch the dashboard data, navigation, and builder links.
            </div>
          </div>
          {storefronts.map((s) => (
            <Link
              key={s.slug}
              role="option"
              aria-selected={s.slug === active?.slug}
              href={buildHref(s.slug)}
              onClick={handlePick(s.slug)}
              style={{
                display: 'grid',
                gridTemplateColumns: '32px minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: 10,
                padding: '10px',
                borderRadius: 12,
                textDecoration: 'none',
                color: 'var(--ink-strong)',
                background:
                  s.slug === active?.slug
                    ? 'color-mix(in srgb, var(--admin-accent) 12%, var(--surface-elevated))'
                    : 'transparent',
                border:
                  s.slug === active?.slug
                    ? '1px solid color-mix(in srgb, var(--admin-accent) 28%, transparent)'
                    : '1px solid transparent',
              }}
              className="souqna-store-switcher-item"
            >
              <StoreInitial active={s} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  dir="auto"
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    unicodeBidi: 'plaintext',
                  }}
                >
                  {s.businessName}
                </span>
                <span
                  dir="ltr"
                  style={{
                    display: 'block',
                    fontSize: 11,
                    color: 'var(--ink-muted)',
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textAlign: 'start',
                  }}
                >
                  {s.slug}.souqna.qa
                </span>
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    borderRadius: 999,
                    padding: '3px 7px',
                    background: s.isPublished
                      ? 'color-mix(in srgb, #2f7d5b 16%, transparent)'
                      : 'color-mix(in srgb, var(--ink-muted) 12%, transparent)',
                    color: s.isPublished ? '#67c79a' : 'var(--ink-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9.5,
                    fontWeight: 600,
                    lineHeight: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  {s.isPublished ? 'Live' : 'Draft'}
                </span>
                {s.slug === active?.slug ? <CheckGlyph size={14} /> : null}
              </span>
            </Link>
          ))}
          <div
            style={{
              height: 1,
              margin: '6px 4px',
              background: 'color-mix(in srgb, var(--ink-strong) 12%, transparent)',
            }}
          />
          {atStorefrontCap ? (
            <Link
              href="/account/settings/plan"
              onClick={() => setOpen(false)}
              title={`You're at the ${cap}-storefront limit on ${planLabel}. Upgrade to add more.`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                textDecoration: 'none',
                color: 'var(--ink-muted)',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 22,
                  height: 22,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  background:
                    'color-mix(in srgb, var(--ink-muted) 16%, transparent)',
                  color: 'var(--ink-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                }}
              >
                {/* small lock glyph drawn inline so we don't pull a new icon dep */}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 1 1 8 0v4" />
                </svg>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block' }}>Upgrade to add more</span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-muted)',
                  }}
                >
                  {Number.isFinite(cap)
                    ? cap === 1
                      ? `1 store on ${planLabel}`
                      : `${cap} stores on ${planLabel}`
                    : `Unlimited stores · ${planLabel}`}
                </span>
              </span>
            </Link>
          ) : (
            <Link
              href="/begin"
              onClick={() => setOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                textDecoration: 'none',
                color: 'var(--admin-accent)',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 22,
                  height: 22,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  background: 'color-mix(in srgb, var(--admin-accent) 22%, transparent)',
                  color: 'var(--admin-accent)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                }}
              >
                +
              </span>
              Create another website
            </Link>
          )}
        </div>
      ) : null}

      <style>{`
        .souqna-store-switcher-button:hover {
          border-color: color-mix(in srgb, var(--admin-accent) 24%, transparent) !important;
          background: color-mix(in srgb, var(--admin-accent) 8%, var(--surface-elevated)) !important;
        }
        [dir=ltr] .souqna-store-switcher-popover {
          left: 0;
          right: auto;
        }
        [dir=rtl] .souqna-store-switcher-popover {
          left: auto;
          right: 0;
        }
        .souqna-store-switcher-item:hover {
          background: color-mix(in srgb, var(--admin-accent) 8%, var(--surface-elevated)) !important;
        }
      `}</style>
    </div>
  );
}

function StoreInitial({
  active,
  large = false,
}: {
  active: StorefrontSummary | null;
  large?: boolean;
}) {
  const initial = (active?.businessName ?? '?').trim().slice(0, 1).toUpperCase();
  const size = large ? 34 : 32;
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        border: '1px solid var(--surface-rule)',
        background: 'color-mix(in srgb, var(--admin-accent) 12%, var(--surface-elevated))',
        color: 'var(--ink-strong)',
        fontFamily: 'var(--font-serif, var(--font-sans))',
        fontWeight: 650,
        fontSize: large ? 15 : 14,
      }}
    >
      {initial}
    </span>
  );
}
