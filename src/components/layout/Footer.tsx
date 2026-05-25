import Link from 'next/link';
import { SouqnaLockup } from '@/components/primitives/SouqnaLockup';
import { ArchMark } from '@/components/primitives/ArchMark';
import { getCopy } from '@/content/copy';
import type { Copy } from '@/content/copy';
import type { Locale } from '@/i18n/locales';

type Props = {
  locale: Locale;
  copy: Copy;
};

export function Footer({ locale, copy }: Props) {
  const columns = [copy.footer.columns.atelier, copy.footer.columns.doha, copy.footer.columns.legal];
  const isRtl = locale === 'ar';
  const echo = getCopy(isRtl ? 'en' : 'ar').footer;

  function localize(href: string): string {
    if (locale === 'en') return href;
    if (href.startsWith('/') && !href.startsWith('//')) return `/${locale}${href === '/' ? '' : href}`;
    return href;
  }

  return (
    <footer
      className="px-6 md:px-12 pt-14 pb-8 border-t"
      style={{
        background: 'var(--surface-bg)',
        color: 'var(--ink-strong)',
        borderTopColor: 'var(--surface-rule)',
      }}
    >
      <div className="max-w-[var(--max-w-editorial)] mx-auto">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <SouqnaLockup ariaLabel={copy.meta.siteName} height={36} />
            <p
              className="mt-5 max-w-[320px] text-[13px] leading-[1.55]"
              style={{
                fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
                color: 'var(--ink-muted)',
              }}
            >
              {copy.footer.tagline}
            </p>
            <p
              dir={isRtl ? 'ltr' : 'rtl'}
              className="mt-3 max-w-[320px] text-[12px] leading-[1.6]"
              style={{
                fontFamily: isRtl ? 'var(--font-sans)' : 'var(--font-arabic), var(--font-sans)',
                color: 'var(--ink-faint)',
              }}
            >
              {echo.tagline}
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <div
                className="font-mono text-[11px] tracking-[0.1em] uppercase mb-3.5"
                style={{ color: 'var(--accent)' }}
              >
                {col.title}
              </div>
              <ul className="list-none p-0 m-0 flex flex-col gap-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.href.startsWith('http') || l.href.startsWith('mailto:') ? (
                      <a
                        href={l.href}
                        className="text-[14px] no-underline transition-colors text-[color:var(--ink-strong)] hover:text-[color:var(--accent)]"
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        href={localize(l.href)}
                        className="text-[14px] no-underline transition-colors text-[color:var(--ink-strong)] hover:text-[color:var(--accent)]"
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-14 pt-5 border-t flex flex-wrap items-center gap-4 md:gap-8 font-mono text-[10px] tracking-[0.05em]"
          style={{ borderTopColor: 'var(--surface-rule)', color: 'var(--ink-faint)' }}
        >
          <span className="inline-flex items-center gap-2.5">
            <ArchMark size={14} inner={false} />
            {copy.footer.copyright}
          </span>
          <span className="hidden md:inline opacity-30">·</span>
          <span>{copy.footer.builtIn}</span>
          <span className="ms-auto">{copy.footer.version}</span>
        </div>
      </div>
    </footer>
  );
}
