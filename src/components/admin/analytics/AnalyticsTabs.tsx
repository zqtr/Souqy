import Link from 'next/link';

type AnalyticsTab = 'overview';

export function AnalyticsTabs({
  active,
  store,
  locale,
}: {
  active: AnalyticsTab;
  store: string;
  locale?: string;
}) {
  const suffix = store ? `?store=${encodeURIComponent(store)}` : '';
  const ar = locale === 'ar';
  const items: Array<{ id: AnalyticsTab; label: string; href: string }> = [
    {
      id: 'overview',
      label: ar ? 'نظرة عامة' : 'Overview',
      href: `/account/analytics${suffix}`,
    },
  ];

  return (
    <nav
      aria-label={ar ? 'أقسام التحليلات' : 'Analytics sections'}
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        gap: 6,
        padding: 4,
        borderRadius: 999,
        border: '1px solid var(--surface-rule)',
        background: 'color-mix(in srgb, var(--surface-elevated) 72%, transparent)',
        margin: '0 0 22px',
      }}
    >
      {items.map((item) => {
        const selected = active === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={selected ? 'page' : undefined}
            style={{
              minWidth: 104,
              textAlign: 'center',
              borderRadius: 999,
              padding: '9px 14px',
              textDecoration: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: selected ? 'var(--ink-on-gold)' : 'var(--ink-muted)',
              background: selected ? 'var(--admin-accent)' : 'transparent',
              border: selected
                ? '1px solid color-mix(in srgb, var(--admin-accent) 72%, black)'
                : '1px solid transparent',
              boxShadow: selected ? '0 10px 24px rgba(95, 43, 52, 0.18)' : undefined,
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
