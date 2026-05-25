import Link from 'next/link';

export type AccountTabId =
  | 'overview'
  | 'account'
  | 'products'
  | 'builder'
  | 'orders'
  | 'billing'
  | 'integrations';

type Tab = {
  id: AccountTabId;
  label: string;
  /** Optional count rendered as a small mono badge to the right of the label. */
  count?: number;
};

type Props = {
  active: AccountTabId;
  tabs: Tab[];
  /**
   * Current `?store=` value, if any. Preserved on tab hrefs so picking a
   * different tab keeps the founder's storefront context (e.g. switching
   * from Products to Builder without losing which store they were on).
   */
  store?: string;
};

/**
 * Server-rendered tab strip for `/account`. Each tab is a plain `<Link>`
 * pointing at `?tab=<id>`, so the page stays fully server-rendered, the
 * URL is shareable, and the active tab survives a refresh.
 *
 * The active tab gets a 2-px maroon underline overlay + bold ink. The
 * full strip sits on a hairline so inactive tabs read as quietly muted.
 */
export function AccountTabs({ active, tabs, store }: Props) {
  const buildHref = (id: AccountTabId) => {
    const params = new URLSearchParams();
    params.set('tab', id);
    if (store) params.set('store', store);
    return `?${params.toString()}`;
  };

  return (
    <nav
      role="tablist"
      aria-label="Account sections"
      style={{
        display: 'flex',
        gap: 4,
        borderBottom: '1px solid var(--surface-rule)',
        marginBottom: 28,
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        nav[aria-label="Account sections"]::-webkit-scrollbar { display: none; }
        .souqna-account-tab { transition: color 160ms ease, border-color 160ms ease; }
        .souqna-account-tab:hover { color: var(--ink-strong); }
      `,
        }}
      />
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <Link
            key={t.id}
            href={buildHref(t.id)}
            role="tab"
            aria-selected={isActive}
            className="souqna-account-tab"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              letterSpacing: isActive ? '0.01em' : 0,
              fontWeight: isActive ? 500 : 400,
              padding: '12px 14px',
              marginBottom: -1,
              borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
              color: isActive ? 'var(--ink-strong)' : 'var(--ink-muted)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 6,
            }}
          >
            <span>{t.label}</span>
            {typeof t.count === 'number' ? (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  color: isActive ? 'var(--admin-accent)' : 'var(--ink-faint)',
                }}
              >
                {t.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
