"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { SouqnaLockup } from "@/components/primitives/SouqnaLockup";
import { LocaleSwitch } from "@/components/layout/LocaleSwitch";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import type { Copy } from "@/content/copy";
import type { Locale } from "@/i18n/locales";

type Props = {
  locale: Locale;
  copy: Copy;
};

export function Navigation3({ locale, copy }: Props) {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const isRtl = locale === "ar";

  useEffect(() => {
    setMounted(true);
    setAuthReady(true);
  }, []);

  const home = locale === "en" ? "/" : `/${locale}`;
  const docs = locale === "en" ? "/docs" : `/${locale}/docs`;
  const souqyStudio = locale === "en" ? "/begin/souqy" : `/${locale}/begin/souqy`;

  const navLinks = [
    { key: "docs", href: docs, label: isRtl ? "الدليل" : "Docs" },
    { key: "account", href: "/account", label: isRtl ? "الحساب" : "Account" },
    { key: "souqy", href: souqyStudio, label: isRtl ? "استوديو سوقي" : "Souqy Studio" },
  ];

  const signInLabel = isRtl ? "دخول" : "Sign in";
  const signUpLabel = isRtl ? "إنشاء حساب" : "Sign up";

  if (!mounted) {
    return (
      <>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[200] focus:rounded-sm focus:bg-[color:var(--surface-contrast)] focus:px-4 focus:py-2 focus:text-[color:var(--ink-on-contrast)]"
        >
          {copy.nav.skipToContent}
        </a>
        <nav
          dir={isRtl ? "rtl" : "ltr"}
          aria-label={copy.meta.siteName}
          className="fixed inset-x-0 top-0 z-[100] w-full px-4 py-4 sm:px-6"
        >
          <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between">
            <Link
              href={home}
              className="flex shrink-0 items-center gap-2 text-[color:var(--ink-strong)] no-underline"
              aria-label={copy.meta.siteName}
            >
              <SouqnaLockup ariaLabel="" height={24} className="text-[color:var(--ink-strong)]" />
            </Link>
          </div>
        </nav>
      </>
    );
  }

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[200] focus:rounded-sm focus:bg-[color:var(--surface-contrast)] focus:px-4 focus:py-2 focus:text-[color:var(--ink-on-contrast)]"
      >
        {copy.nav.skipToContent}
      </a>
      <nav
        dir={isRtl ? "rtl" : "ltr"}
        aria-label={copy.meta.siteName}
        className="fixed inset-x-0 top-0 z-[100] w-full px-4 py-4 sm:px-6"
      >
        <div className="mx-auto w-full max-w-[1400px]">
          <motion.div
            className="hidden items-center justify-between gap-4 lg:flex"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            <Link
              href={home}
              className="flex shrink-0 items-center gap-2 text-[color:var(--ink-strong)] no-underline"
              aria-label={copy.meta.siteName}
            >
              <SouqnaLockup ariaLabel="" height={28} className="text-[color:var(--ink-strong)]" />
            </Link>

            <div className="flex min-w-0 flex-1 justify-center">
              <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-sm border border-[color:var(--surface-rule)] bg-[color:color-mix(in_srgb,var(--surface-overlay)_78%,transparent)] px-3 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.08)] backdrop-blur-xl">
                {navLinks.map((link) => (
                  <Link
                    key={link.key}
                    href={link.href}
                    className="whitespace-nowrap rounded-[5px] px-3 py-1.5 text-xs font-medium text-[color:var(--ink-muted)] no-underline transition hover:bg-[color:var(--surface-bg)] hover:text-[color:var(--ink-strong)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <LocaleSwitch current={locale} />
              <ThemeToggle compact />
              {!authReady ? (
                <Link
                  href="/sign-in"
                  className="px-4 py-3 text-sm font-medium text-[color:var(--ink-muted)] no-underline transition hover:text-[color:var(--ink-strong)]"
                >
                  {signInLabel}
                </Link>
              ) : (
                <>
                  <SignedOut>
                    <Link
                      href="/sign-in"
                      className="px-4 py-3 text-sm font-medium text-[color:var(--ink-muted)] no-underline transition hover:text-[color:var(--ink-strong)]"
                    >
                      {signInLabel}
                    </Link>
                    <Link
                      href="/sign-up"
                      className="rounded-sm bg-[color:var(--ink-strong)] px-5 py-3 text-sm font-medium text-[color:var(--surface-bg)] no-underline transition hover:opacity-85"
                    >
                      {signUpLabel}
                    </Link>
                  </SignedOut>
                  <SignedIn>
                    <UserButton afterSignOutUrl="/" />
                  </SignedIn>
                </>
              )}
            </div>
          </motion.div>

          <motion.div
            className="lg:hidden"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="flex items-center justify-between gap-3">
              <Link
                href={home}
                className="flex min-w-0 items-center gap-2 text-[color:var(--ink-strong)] no-underline"
                aria-label={copy.meta.siteName}
              >
                <SouqnaLockup
                  ariaLabel=""
                  height={24}
                  className="max-w-[min(100%,200px)] text-[color:var(--ink-strong)]"
                />
              </Link>

              <div className="flex items-center gap-2">
                <ThemeToggle compact />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-[color:var(--surface-rule-strong)] bg-[color:var(--surface-overlay)] text-[color:var(--ink-strong)] shadow-[0_14px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl transition hover:bg-[color:var(--surface-bg)]"
                  aria-expanded={mobileMenuOpen}
                  aria-label={
                    mobileMenuOpen
                      ? isRtl
                        ? "إغلاق القائمة"
                        : "Close menu"
                      : isRtl
                        ? "فتح القائمة"
                        : "Open menu"
                  }
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {mobileMenuOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1 pb-2 pt-4">
                    <div className="mb-3 rounded-2xl border border-[color:var(--surface-rule)] bg-[color:color-mix(in_srgb,var(--surface-overlay)_88%,transparent)] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.12)] backdrop-blur-xl">
                      {navLinks.map((link, index) => (
                        <motion.div
                          key={link.key}
                          initial={{ opacity: 0, x: isRtl ? 10 : -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: index * 0.03 }}
                        >
                          <Link
                            href={link.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className="block rounded-sm px-4 py-2.5 text-sm font-medium text-[color:var(--ink-muted)] no-underline hover:bg-[color:var(--surface-bg)] hover:text-[color:var(--ink-strong)]"
                          >
                            {link.label}
                          </Link>
                        </motion.div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                      <LocaleSwitch current={locale} />
                      {!authReady ? (
                        <Link
                          href="/sign-in"
                          onClick={() => setMobileMenuOpen(false)}
                          className="block px-4 py-2.5 text-center text-sm font-medium text-[color:var(--ink-muted)] no-underline hover:text-[color:var(--ink-strong)]"
                        >
                          {signInLabel}
                        </Link>
                      ) : (
                        <>
                          <SignedOut>
                            <Link
                              href="/sign-in"
                              onClick={() => setMobileMenuOpen(false)}
                              className="block px-4 py-2.5 text-center text-sm font-medium text-[color:var(--ink-muted)] no-underline hover:text-[color:var(--ink-strong)]"
                            >
                              {signInLabel}
                            </Link>
                            <Link
                              href="/sign-up"
                              onClick={() => setMobileMenuOpen(false)}
                              className="block rounded-lg bg-[color:var(--ink-strong)] px-5 py-2.5 text-center text-sm font-medium text-[color:var(--surface-bg)] no-underline hover:opacity-85"
                            >
                              {signUpLabel}
                            </Link>
                          </SignedOut>
                          <SignedIn>
                            <div className="flex justify-center py-2">
                              <UserButton afterSignOutUrl="/" />
                            </div>
                          </SignedIn>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </div>
      </nav>
    </>
  );
}

export default Navigation3;
