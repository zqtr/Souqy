'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import type { Locale } from '@/i18n/locales';

const socials = [
  {
    key: 'x',
    label: 'X',
    href: 'https://x.com/souqnaco',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    key: 'ig',
    label: 'Instagram',
    href: 'https://instagram.com/souqnaqa',
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
      </svg>
    ),
  },
] as const;

const footerCopy = {
  en: {
    description:
      'Souqna is a bilingual commerce workspace for GCC storefronts, payments, orders, and AI-assisted operations.',
    wordmark: 'Souqna',
    copyright: '© 2026 Souqna / Made in Doha for GCC commerce',
    columns: [
      {
        title: 'Product',
        links: [
          { label: 'Start a store', href: '/begin' },
          { label: 'Souqy Studio', href: '/begin/souqy' },
          { label: 'Account dashboard', href: '/account' },
        ],
      },
      {
        title: 'Resources',
        links: [
          { label: 'Templates', href: '/templates' },
          { label: 'Docs', href: '/docs' },
          { label: 'Help', href: '/docs#support' },
          { label: 'How-to', href: '/docs#getting-started' },
        ],
      },
      {
        title: 'Company',
        links: [
          { label: 'Brand', href: '/brand' },
          { label: 'Plans', href: '#plans', badge: 'pricing' },
        ],
      },
    ],
    legal: [
      { label: 'Security', href: '/docs#support' },
      { label: 'Terms of service', href: '/docs#legal' },
      { label: 'Privacy policy', href: '/docs#legal' },
    ],
  },
  ar: {
    description:
      'سوقنا مساحة عمل ثنائية اللغة لمتاجر الخليج، المدفوعات، الطلبات، والتشغيل المدعوم بالذكاء.',
    wordmark: 'سوقنا',
    copyright: '© 2026 سوقنا / صنع في الدوحة لتجارة الخليج',
    columns: [
      {
        title: 'المنتج',
        links: [
          { label: 'ابدأ متجراً', href: '/begin' },
          { label: 'استوديو سوقي', href: '/begin/souqy' },
          { label: 'لوحة الحساب', href: '/account' },
        ],
      },
      {
        title: 'الموارد',
        links: [
          { label: 'القوالب', href: '/templates' },
          { label: 'الدليل', href: '/docs' },
          { label: 'المساعدة', href: '/docs#support' },
          { label: 'شرح الاستخدام', href: '/docs#getting-started' },
        ],
      },
      {
        title: 'الشركة',
        links: [
          { label: 'الهوية', href: '/brand' },
          { label: 'الباقات', href: '#plans', badge: 'الأسعار' },
        ],
      },
    ],
    legal: [
      { label: 'الأمان', href: '/docs#support' },
      { label: 'شروط الخدمة', href: '/docs#legal' },
      { label: 'سياسة الخصوصية', href: '/docs#legal' },
    ],
  },
} satisfies Record<
  Locale,
  {
    columns: Array<{
      links: Array<{ badge?: string; href: string; label: string }>;
      title: string;
    }>;
    copyright: string;
    description: string;
    legal: Array<{ href: string; label: string }>;
    wordmark: string;
  }
>;

export default function Footer8({ locale }: { locale: Locale }) {
  const copy = footerCopy[locale];
  const isRtl = locale === 'ar';
  const localize = (href: string) => {
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('/account'))
      return href;
    if (locale === 'en') return href;
    return href.startsWith('/') ? `/${locale}${href === '/' ? '' : href}` : href;
  };

  return (
    <footer
      id="homepage-footer"
      dir={isRtl ? 'rtl' : 'ltr'}
      className="relative w-full overflow-hidden border-t border-[color:var(--sq-rule)] bg-[color:var(--sq-charcoal)] px-[var(--sq-page-pad)] py-12 text-[color:var(--sq-bg)] sm:py-16"
    >
      <div className="relative mx-auto w-full max-w-[1400px]">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.3fr_1fr_1fr_1fr] lg:gap-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-6"
          >
            <p className="max-w-xs text-sm leading-relaxed text-[color:color-mix(in_srgb,var(--sq-bg)_78%,transparent)] sm:text-base">
              {copy.description}
            </p>
            <div className="flex items-center gap-2">
              {socials.map((s) => (
                <a
                  key={s.key}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[color:color-mix(in_srgb,var(--sq-bg)_24%,transparent)] text-[color:color-mix(in_srgb,var(--sq-bg)_78%,transparent)] transition-colors hover:border-[color:var(--sq-bg)] hover:text-[color:var(--sq-bg)]"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </motion.div>

          {copy.columns.map((col, ci) => (
            <motion.div
              key={col.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.05 + ci * 0.05 }}
              className="flex flex-col gap-2 lg:border-t lg:border-[color:color-mix(in_srgb,var(--sq-bg)_18%,transparent)] lg:pt-5"
            >
              <h4 className="text-base font-semibold text-[color:var(--sq-bg)] sm:text-lg">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-1">
                {col.links.map((link) => (
                  <li key={link.label} className="flex items-center gap-2">
                    <Link
                      href={localize(link.href)}
                      className="text-sm text-[color:color-mix(in_srgb,var(--sq-bg)_76%,transparent)] transition-colors hover:text-[color:var(--sq-bg)] sm:text-base"
                    >
                      {link.label}
                    </Link>
                    {link.badge ? (
                      <span className="rounded-md bg-[color:color-mix(in_srgb,var(--sq-bg)_10%,transparent)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[color:color-mix(in_srgb,var(--sq-bg)_84%,transparent)]">
                        {link.badge}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <div
          className="relative mt-20 w-full"
          aria-hidden="true"
          style={{
            fontSize: isRtl ? 'min(19vw, 230px)' : 'min(14.2vw, 210px)',
            height: '0.74em',
            maskImage: 'linear-gradient(to bottom, #000 50%, transparent 95%)',
            WebkitMaskImage: 'linear-gradient(to bottom, #000 50%, transparent 95%)',
          }}
        >
          <div
            className="absolute inset-0 flex justify-center whitespace-nowrap font-bold uppercase leading-none text-[color:var(--sq-charcoal)]"
            style={{
              fontSize: 'inherit',
              letterSpacing: isRtl ? '0' : '0.15em',
              paddingInlineStart: isRtl ? '0' : '0.15em',
              textShadow:
                '0 -1.5px 0 color-mix(in srgb, var(--sq-bg) 62%, transparent), 1.5px 0 0 color-mix(in srgb, var(--sq-bg) 62%, transparent), 0 1.5px 0 color-mix(in srgb, var(--sq-bg) 62%, transparent), -1.5px 0 0 color-mix(in srgb, var(--sq-bg) 62%, transparent)',
            }}
          >
            {copy.wordmark}
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-[color:color-mix(in_srgb,var(--sq-bg)_14%,transparent)] pt-6 text-xs text-[color:color-mix(in_srgb,var(--sq-bg)_58%,transparent)] sm:flex-row sm:items-center sm:text-sm">
          <p>{copy.copyright}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {copy.legal.map((link) => (
              <Link
                key={link.href}
                href={localize(link.href)}
                className="transition-colors hover:text-[color:var(--sq-bg)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
