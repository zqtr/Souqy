import Link from 'next/link';
import type { Locale } from '@/i18n/locales';
import { getCopy } from '@/content/copy';
import { palette } from '@/lib/tokens';

type Props = {
  locale: Locale;
  /** `forbidden` = signed in but not the owner. `missing` = no such storefront. */
  reason: 'forbidden' | 'missing';
};

/**
 * Soft auth-failure surface for the dashboard. Rendered when the signed-in
 * Clerk user is not the storefront owner, or when a stale slug is requested.
 * Always offers a path back: account dashboard for forbidden, /begin for
 * missing.
 */
export function DashboardAuthPanel({ locale, reason }: Props) {
  const copy = getCopy(locale);
  const isRtl = locale === 'ar';
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const t = copy.dashboard;
  const message = reason === 'missing' ? t.notFound : t.forbidden;
  const ctaHref = reason === 'missing' ? `/${locale}/begin` : '/account';
  const ctaLabel = reason === 'missing' ? t.startStore : t.backToAccount;

  return (
    <main
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-dvh flex items-center justify-center"
      style={{
        background: 'var(--surface-contrast)',
        color: 'var(--ink-on-contrast)',
        padding: 24,
        fontFamily,
      }}
    >
      <div
        className="rounded-[4px] text-center"
        style={{
          maxWidth: 480,
          background: 'rgba(232,220,196,0.04)',
          border: `1px solid ${palette.gold}33`,
          padding: '40px 32px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            color: palette.gold,
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          ◈ {t.eyebrow}
        </div>
        <p style={{ fontSize: 16, lineHeight: 1.55, margin: '0 0 24px' }}>{message}</p>
        <Link
          href={ctaHref}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
          background: palette.gold,
          color: 'var(--ink-on-gold)',
            padding: '12px 22px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 500,
            textDecoration: 'none',
            fontFamily,
          }}
        >
          {ctaLabel} <span aria-hidden>→</span>
        </Link>
      </div>
    </main>
  );
}
