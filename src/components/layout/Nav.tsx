'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { SouqnaLockup } from '@/components/primitives/SouqnaLockup';
import { MagneticButton } from '@/components/motion/MagneticButton';
import { LocaleSwitch } from './LocaleSwitch';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import type { Copy } from '@/content/copy';
import type { Locale } from '@/i18n/locales';

type Props = {
  locale: Locale;
  copy: Copy;
};

const sections = [
  { id: 'ai', key: 'work' },
  { id: 'builder', key: 'process' },
  { id: 'operations', key: 'operations' },
  { id: 'souqy', key: 'atelier' },
  { id: 'apps', key: 'discover' },
  { id: 'pricing', key: 'pricing' },
] as const;

export function Nav({ locale, copy }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    setAuthReady(true);
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-close the mobile drawer on navigation / Escape so it never
  // outlives the user's intent to interact with it.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDrawerOpen(false);
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  useEffect(() => {
    const ids = sections.map((s) => s.id);
    const observed = ids
      .map((id) => document.getElementById(id))
      .filter((n): n is HTMLElement => n !== null);
    if (observed.length === 0) return;
    const ob = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: '-40% 0px -50% 0px' },
    );
    observed.forEach((n) => ob.observe(n));
    return () => ob.disconnect();
  }, []);

  const home = locale === 'en' ? '/' : `/${locale}`;
  const contact = locale === 'en' ? '/begin' : `/${locale}/begin`;
  const souqyStudio = locale === 'en' ? '/begin/souqy' : `/${locale}/begin/souqy`;
  const isRtl = locale === 'ar';

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[200] focus:bg-[color:var(--surface-contrast)] focus:text-[color:var(--ink-on-contrast)] focus:px-4 focus:py-2 focus:rounded"
      >
        {copy.nav.skipToContent}
      </a>
      <nav
        aria-label={copy.meta.siteName}
        className={`fixed top-0 inset-x-0 z-[100] transition-all duration-[400ms] ease-[cubic-bezier(.2,.7,.3,1)] ${
          scrolled ? 'py-3 px-6 md:px-8 backdrop-blur-xl' : 'py-5 px-6 md:px-8'
        }`}
        style={{
          // Surface tokens flip with theme; the alpha stays the same so the
          // glass effect reads identically in light and dark.
          background: scrolled
            ? 'color-mix(in srgb, var(--surface-bg) 82%, transparent)'
            : 'transparent',
          borderBottom: scrolled ? '1px solid var(--surface-rule)' : '1px solid transparent',
          backdropFilter: scrolled ? 'blur(18px) saturate(140%)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(18px) saturate(140%)' : 'none',
        }}
      >
        <div className="flex items-center justify-between gap-6 max-w-[var(--max-w-editorial)] mx-auto">
          <Link
            href={home}
            aria-label={copy.meta.siteName}
            className="no-underline inline-flex items-center"
            style={{ color: 'var(--ink-strong)' }}
          >
            <SouqnaLockup ariaLabel={copy.meta.siteName} height={scrolled ? 32 : 38} />
          </Link>

          <ul className="hidden lg:flex items-center gap-8 list-none m-0 p-0">
            {sections.map((s) => {
              const enLabel = (copy.nav as Record<string, string>)[s.key] ?? s.key;
              const isActive = active === s.id;
              return (
                <Fragment key={s.id}>
                  <li>
                    <Link
                      href={`${home}#${s.id}`}
                      className="group relative inline-flex items-baseline gap-1.5 text-[13px] font-[450] no-underline"
                      style={{
                        opacity: isActive ? 1 : 0.7,
                        color: 'var(--ink-strong)',
                      }}
                    >
                      <span>{enLabel}</span>
                      <span
                        aria-hidden
                        className="absolute inset-x-0 -bottom-0.5 h-px bg-[color:var(--color-gold)] transition-transform duration-[400ms] ease-[cubic-bezier(.2,.7,.3,1)]"
                        style={{
                          transform: isActive ? 'scaleX(1)' : 'scaleX(0)',
                          transformOrigin: isRtl ? 'right' : 'left',
                        }}
                      />
                    </Link>
                  </li>
                </Fragment>
              );
            })}
          </ul>

          <div className="flex items-center gap-3 md:gap-5 lg:gap-6">
            <StudioShortcut href={souqyStudio} locale={locale} className="inline-flex" />
            <LocaleSwitch current={locale} />
            <ThemeToggle compact />
            {!authReady ? (
              <Link
                href="/sign-in"
                className="hidden sm:inline-flex text-[12px] font-[450] transition-colors no-underline"
                style={{
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-muted)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-strong)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-muted)')}
              >
                {locale === 'ar' ? 'دخول' : 'Sign in'}
              </Link>
            ) : (
              <>
                <SignedOut>
                  <Link
                    href="/sign-in"
                    className="hidden sm:inline-flex text-[12px] font-[450] transition-colors no-underline"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-muted)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-strong)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-muted)')}
                  >
                    {locale === 'ar' ? 'دخول' : 'Sign in'}
                  </Link>
                </SignedOut>
                <SignedIn>
                  <Link
                    href="/account"
                    className="hidden sm:inline-flex text-[12px] font-[450] transition-colors no-underline"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-muted)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-strong)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-muted)')}
                  >
                    {locale === 'ar' ? 'الحساب' : 'Account'}
                  </Link>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
              </>
            )}
            <div className="hidden sm:block">
              <MagneticButton href={contact} variant="ghost">
                {copy.nav.cta}
              </MagneticButton>
            </div>

            {/* Mobile/tablet hamburger — visible below lg, where the
                inline link list is hidden. */}
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden inline-flex items-center justify-center"
              style={{
                width: 36,
                height: 36,
                background: 'transparent',
                border: '1px solid var(--surface-rule)',
                borderRadius: 6,
                color: 'var(--ink-strong)',
                cursor: 'pointer',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer. Renders only when open so unscrolled mobile
          first paint stays cheap. Scoped to lg-and-below since the
          inline list takes over at lg. */}
      {drawerOpen ? (
        <div
          className="lg:hidden fixed inset-0 z-[150]"
          role="dialog"
          aria-modal
          aria-label={copy.meta.siteName}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
          style={{
            background: 'color-mix(in srgb, var(--surface-bg) 60%, transparent)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <div
            className="absolute top-0 end-0 h-full w-[min(86vw,380px)] flex flex-col"
            style={{
              background: 'var(--surface-bg)',
              borderInlineStart: '1px solid var(--surface-rule)',
              padding: '20px 22px',
              gap: 24,
              boxShadow: 'var(--shadow-popover)',
            }}
          >
            <div
              className="flex items-center justify-between"
              style={{ color: 'var(--ink-strong)' }}
            >
              <SouqnaLockup ariaLabel={copy.meta.siteName} height={28} />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
                style={{
                  width: 32,
                  height: 32,
                  background: 'transparent',
                  border: '1px solid var(--surface-rule)',
                  borderRadius: 6,
                  color: 'var(--ink-strong)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <ul className="list-none m-0 p-0 flex flex-col gap-4">
              {sections.map((s) => {
                const enLabel = (copy.nav as Record<string, string>)[s.key] ?? s.key;
                return (
                  <Fragment key={s.id}>
                    <li>
                      <Link
                        href={`${home}#${s.id}`}
                        onClick={() => setDrawerOpen(false)}
                        className="no-underline"
                        style={{
                          fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
                          fontSize: 28,
                          lineHeight: 1.1,
                          letterSpacing: 0,
                          color: 'var(--ink-strong)',
                        }}
                      >
                        {enLabel}
                      </Link>
                    </li>
                  </Fragment>
                );
              })}
            </ul>

            <StudioShortcut
              href={souqyStudio}
              locale={locale}
              onClick={() => setDrawerOpen(false)}
              mobile
            />

            <div
              className="mt-auto flex flex-col gap-3"
              style={{
                paddingTop: 18,
                borderTop: '1px solid var(--surface-rule)',
              }}
            >
              {!authReady ? (
                <Link
                  href="/sign-in"
                  onClick={() => setDrawerOpen(false)}
                  className="no-underline"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    background: 'transparent',
                    border: '1px solid var(--surface-rule)',
                    color: 'var(--ink-strong)',
                    padding: '12px 16px',
                    borderRadius: 6,
                    textAlign: 'start',
                  }}
                >
                  {locale === 'ar' ? 'دخول' : 'Sign in'}
                </Link>
              ) : (
                <>
                  <SignedOut>
                    <Link
                      href="/sign-in"
                      onClick={() => setDrawerOpen(false)}
                      className="no-underline"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        background: 'transparent',
                        border: '1px solid var(--surface-rule)',
                        color: 'var(--ink-strong)',
                        padding: '12px 16px',
                        borderRadius: 6,
                        textAlign: 'start',
                      }}
                    >
                      {locale === 'ar' ? 'دخول' : 'Sign in'}
                    </Link>
                  </SignedOut>
                  <SignedIn>
                    <Link
                      href="/account"
                      onClick={() => setDrawerOpen(false)}
                      className="no-underline"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        border: '1px solid var(--surface-rule)',
                        color: 'var(--ink-strong)',
                        padding: '12px 16px',
                        borderRadius: 6,
                      }}
                    >
                      {locale === 'ar' ? 'الحساب' : 'Account'}
                    </Link>
                  </SignedIn>
                </>
              )}
              <Link
                href={contact}
                onClick={() => setDrawerOpen(false)}
                className="no-underline"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: 'var(--accent)',
                  color: 'var(--ink-on-accent)',
                  padding: '14px 16px',
                  borderRadius: 6,
                  textAlign: 'center',
                }}
              >
                {copy.nav.cta}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function StudioShortcut({
  href,
  locale,
  className,
  mobile = false,
  onClick,
}: {
  href: string;
  locale: Locale;
  className?: string;
  mobile?: boolean;
  onClick?: () => void;
}) {
  const isAr = locale === 'ar';
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`souqna-nav-studio no-underline ${className ?? ''}`}
      aria-label={isAr ? 'افتح سوقي' : 'Open Souqy'}
      style={{
        display: mobile ? 'inline-flex' : undefined,
        alignItems: 'center',
        justifyContent: mobile ? 'center' : undefined,
        gap: mobile ? 8 : 6,
        border: '1px solid color-mix(in srgb, var(--color-gold) 42%, var(--surface-rule))',
        borderRadius: mobile ? 6 : 999,
        background: 'color-mix(in srgb, var(--color-gold) 10%, transparent)',
        color: 'var(--ink-strong)',
        padding: mobile ? '12px 14px' : '7px 9px',
        fontFamily: 'var(--font-mono)',
        fontSize: mobile ? 11 : 10,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        boxShadow: '0 10px 26px color-mix(in srgb, var(--color-gold) 12%, transparent)',
      }}
    >
      <InfinityGridIcon />
      <span className={mobile ? undefined : 'souqna-nav-studio-label'}>
        {isAr ? 'سوقي' : 'Souqy'}
      </span>
      <style jsx global>{`
        .souqna-nav-studio {
          transition:
            transform 180ms ease,
            background 180ms ease,
            border-color 180ms ease;
        }
        .souqna-nav-studio:hover {
          transform: translateY(-1px);
          background: color-mix(in srgb, var(--color-gold) 16%, transparent);
          border-color: color-mix(in srgb, var(--color-gold) 64%, var(--surface-rule));
        }
        .souqna-nav-studio:focus-visible {
          outline: 2px solid var(--color-gold);
          outline-offset: 4px;
        }
        @media (max-width: 520px) {
          .souqna-nav-studio-label {
            display: none;
          }
        }
      `}</style>
    </Link>
  );
}

function InfinityGridIcon() {
  return (
    <span
      aria-hidden
      style={{
        width: 22,
        height: 22,
        borderRadius: 7,
        display: 'grid',
        placeItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: 'color-mix(in srgb, var(--color-gold) 20%, transparent)',
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--ink-strong) 16%, transparent)',
        flex: '0 0 auto',
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 4,
          opacity: 0.38,
          backgroundImage:
            'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
          backgroundSize: '7px 7px',
        }}
      />
      <span
        style={{
          position: 'relative',
          fontFamily: 'var(--font-serif), serif',
          fontSize: 15,
          lineHeight: 1,
          transform: 'translateY(-1px)',
        }}
      >
        ∞
      </span>
    </span>
  );
}
