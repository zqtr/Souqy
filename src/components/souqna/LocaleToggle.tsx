'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';
import type { Locale } from '@/i18n/locales';

type Props = {
  locale: Locale;
  mode: 'public' | 'account';
  className?: string;
  style?: CSSProperties;
  publicHref?: string;
};

const cookieMaxAge = 60 * 60 * 24 * 365;

export function LocaleToggle({ locale, mode, className, style, publicHref }: Props) {
  const router = useRouter();
  const nextLocale: Locale = locale === 'ar' ? 'en' : 'ar';
  const label = nextLocale === 'ar' ? 'العربية' : 'English';
  const title = nextLocale === 'ar' ? 'Switch to Arabic' : 'Switch to English';

  const sharedStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    padding: '7px 12px',
    borderRadius: 999,
    border: '1px solid var(--sq-rule, var(--surface-rule-strong))',
    background: 'var(--sq-glass, color-mix(in srgb, var(--surface-overlay) 82%, transparent))',
    color: 'var(--sq-ink, var(--ink-strong))',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0,
    textDecoration: 'none',
    cursor: 'pointer',
    ...style,
  };

  if (mode === 'public') {
    return (
      <Link
        href={publicHref ?? (nextLocale === 'ar' ? '/ar' : '/')}
        aria-label={title}
        title={title}
        className={className}
        style={sharedStyle}
        onClick={() => {
          document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=${cookieMaxAge}; SameSite=Lax`;
        }}
      >
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      className={className}
      style={{
        ...sharedStyle,
        gap: 6,
        minWidth: 72,
      }}
      onClick={() => {
        document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=${cookieMaxAge}; SameSite=Lax`;
        document.documentElement.lang = nextLocale;
        document.documentElement.dir = nextLocale === 'ar' ? 'rtl' : 'ltr';
        router.refresh();
      }}
    >
      <span
        style={{
          opacity: locale === 'en' ? 1 : 0.45,
          fontWeight: locale === 'en' ? 700 : 500,
        }}
      >
        EN
      </span>
      <span aria-hidden style={{ opacity: 0.35 }}>
        /
      </span>
      <span
        style={{
          opacity: locale === 'ar' ? 1 : 0.45,
          fontWeight: locale === 'ar' ? 700 : 500,
        }}
      >
        AR
      </span>
    </button>
  );
}
