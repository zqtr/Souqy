'use client';

import { Link, usePathname } from '@/i18n/routing';
import type { Locale } from '@/i18n/locales';

type Props = {
  current: Locale;
  className?: string;
};

/**
 * Single-click bilingual toggle. The whole pill is one anchor that
 * switches to the opposite locale via next-intl's locale-aware Link,
 * keeping the current logical pathname. The active label is filled,
 * the inactive label is the click hint.
 */
export function LocaleSwitch({ current, className = '' }: Props) {
  const pathname = usePathname() || '/';
  const target: Locale = current === 'en' ? 'ar' : 'en';
  const label = current === 'en' ? 'Switch to Arabic' : 'الترجمة إلى الإنجليزية';

  return (
    <Link
      href={pathname}
      locale={target}
      hrefLang={target}
      aria-label={label}
      prefetch={false}
      className={`group inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] no-underline rounded-full border border-[color:var(--surface-rule)] hover:border-[color:var(--surface-rule-strong)] transition-colors px-2.5 py-1 ${className}`}
    >
      <span
        aria-hidden
        className="px-1.5 py-0.5 rounded-full transition-colors"
        style={{
          background: current === 'en' ? 'var(--ink-strong)' : 'transparent',
          color: current === 'en' ? 'var(--surface-bg)' : 'var(--ink-faint)',
        }}
      >
        EN
      </span>
      <span aria-hidden className="text-[color:var(--ink-faint)] select-none">
        ·
      </span>
      <span
        aria-hidden
        className="px-1.5 py-0.5 rounded-full transition-colors"
        style={{
          background: current === 'ar' ? 'var(--ink-strong)' : 'transparent',
          color: current === 'ar' ? 'var(--surface-bg)' : 'var(--ink-faint)',
          fontFamily: 'var(--font-arabic), var(--font-mono)',
        }}
      >
        ع
      </span>
    </Link>
  );
}
