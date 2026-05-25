"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type Navigation2Item = {
  label: string;
  href: string;
  description?: string;
  children?: Navigation2Item[];
};

type Navigation2Props = {
  actions?: ReactNode;
  brand: ReactNode;
  brandHref: string;
  brandLabel: string;
  className?: string;
  items: Navigation2Item[];
  mobileMenuFooter?: ReactNode;
};

export function Navigation2({
  actions,
  brand,
  brandHref,
  brandLabel,
  className,
  items,
  mobileMenuFooter,
}: Navigation2Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className={cn("relative z-40 w-full px-4 py-4", className)} aria-label="Primary">
      <div className="mx-auto w-full max-w-[1400px]">
        <motion.div
          className="relative hidden lg:flex items-center justify-center"
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="rb-nav-shell flex w-fit items-center justify-between gap-2 overflow-visible rounded-3xl border border-neutral-950/10 bg-white/60 px-3 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-neutral-950/45 dark:shadow-[0_18px_70px_rgba(0,0,0,0.38)]">
            <a
              href={brandHref}
              aria-label={brandLabel}
              className="mr-5 flex items-center text-neutral-950 no-underline dark:text-white"
            >
              {brand}
            </a>

            <div className="flex items-center gap-1">
              {items.map((item) =>
                item.children?.length ? (
                  <details
                    key={item.href}
                    className="group relative"
                    onMouseEnter={(event) => {
                      event.currentTarget.open = true;
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.open = false;
                    }}
                  >
                    <summary className="rb-nav-link block cursor-pointer list-none rounded-full px-4 py-2 text-sm font-medium tracking-tight text-neutral-600 no-underline transition-colors marker:hidden hover:text-neutral-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/20 dark:text-neutral-300 dark:hover:text-white dark:focus-visible:ring-white/20 [&::-webkit-details-marker]:hidden">
                      {item.label}
                    </summary>
                    <div className="rb-nav-dropdown absolute left-1/2 top-full z-50 grid w-[360px] -translate-x-1/2 gap-2 rounded-3xl border border-neutral-950/10 bg-white/72 p-2 pt-[1.35rem] shadow-[0_24px_70px_rgba(0,0,0,0.18)] backdrop-blur-2xl transition duration-200 ease-out dark:border-white/10 dark:bg-neutral-950/72 dark:shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
                      {item.children.map((child) => (
                        <a
                          key={`${item.href}-${child.href}`}
                          href={child.href}
                          className="rounded-2xl px-4 py-3 text-start no-underline transition-colors hover:bg-neutral-950/[0.06] dark:hover:bg-white/10"
                        >
                          <span className="block text-sm font-semibold tracking-tight text-neutral-950 dark:text-white">
                            {child.label}
                          </span>
                          {child.description ? (
                            <span className="mt-1 block text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                              {child.description}
                            </span>
                          ) : null}
                        </a>
                      ))}
                    </div>
                  </details>
                ) : (
                  <a
                    key={item.href}
                    href={item.href}
                    className="rb-nav-link block rounded-full px-4 py-2 text-sm font-medium tracking-tight text-neutral-600 no-underline transition-colors hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white"
                  >
                    {item.label}
                  </a>
                ),
              )}
            </div>

            {actions ? <div className="ml-5 flex items-center gap-2">{actions}</div> : null}
          </div>
        </motion.div>

        <motion.div
          className="lg:hidden"
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="rb-nav-shell overflow-hidden rounded-3xl border border-neutral-950/10 bg-white/65 shadow-[0_18px_60px_rgba(0,0,0,0.14)] backdrop-blur-2xl dark:border-white/10 dark:bg-neutral-950/45">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <a
                href={brandHref}
                aria-label={brandLabel}
                className="flex items-center text-neutral-950 no-underline dark:text-white"
              >
                {brand}
              </a>

              <div className="flex items-center gap-2">
                {actions}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((open) => !open)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-950 text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                  aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={mobileMenuOpen}
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
                  <div className="grid gap-2 px-4 pb-4 pt-1">
                    {items.map((item, index) => (
                      <motion.div
                        key={item.href}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.035, ease: "easeOut" }}
                      >
                        <a
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className="block rounded-2xl border border-neutral-950/10 bg-white/36 px-4 py-3 text-sm font-medium text-neutral-900 no-underline backdrop-blur-xl transition-colors hover:bg-white/62 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                        >
                          <span>{item.label}</span>
                          {item.description ? (
                            <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                              {item.description}
                            </span>
                          ) : null}
                        </a>
                        {item.children?.length ? (
                          <div className="mt-2 grid gap-2 ps-3">
                            {item.children.map((child) => (
                              <a
                                key={`${item.href}-${child.href}`}
                                href={child.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className="rounded-xl border border-neutral-950/10 bg-white/24 px-4 py-2.5 text-sm text-neutral-700 no-underline backdrop-blur-xl transition-colors hover:bg-white/52 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:hover:bg-white/10"
                              >
                                {child.label}
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </motion.div>
                    ))}
                    {mobileMenuFooter ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.2,
                          delay: items.length * 0.035,
                          ease: "easeOut",
                        }}
                      >
                        {mobileMenuFooter}
                      </motion.div>
                    ) : null}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </nav>
  );
}

export default Navigation2;
