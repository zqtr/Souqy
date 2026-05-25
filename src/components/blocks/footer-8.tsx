"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { HomeStaggeredText } from "@/components/sections/home/HomeStaggeredText";
import type { Locale } from "@/i18n/locales";

const socials = [
  {
    key: "x",
    label: "X",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    key: "ig",
    label: "Instagram",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    key: "yt",
    label: "YouTube",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.5 6.5a3 3 0 0 0-2.1-2.1C19.5 4 12 4 12 4s-7.5 0-9.4.4A3 3 0 0 0 .5 6.5C0 8.4 0 12 0 12s0 3.6.5 5.5a3 3 0 0 0 2.1 2.1C4.5 20 12 20 12 20s7.5 0 9.4-.4a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.5.5-5.5s0-3.6-.5-5.5zM9.6 15.6V8.4l6.4 3.6z" />
      </svg>
    ),
  },
  {
    key: "li",
    label: "LinkedIn",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zm7 0h3.8v1.7h.05c.53-1 1.84-2.05 3.78-2.05 4.04 0 4.78 2.66 4.78 6.12V21h-4v-5.5c0-1.3-.02-3-1.83-3s-2.11 1.43-2.11 2.9V21h-4z" />
      </svg>
    ),
  },
];

const cols = [
  {
    title: "Product",
    links: [
      { label: "AI builder", href: "/begin" },
      { label: "Apps marketplace", href: "/account/apps" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Product docs", href: "/docs" },
      { label: "Founder overview", href: "/docs" },
      { label: "Integration matrix", href: "/docs" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/brand" },
      { label: "Careers", href: "/docs", badge: "we're hiring" },
    ],
  },
] as const;

export default function Footer8({ locale }: { locale: Locale }) {
  const localize = (href: string) => {
    if (href.startsWith("#") || locale === "en") return href;
    return href.startsWith("/") ? `/${locale}${href === "/" ? "" : href}` : href;
  };

  return (
    <footer
      id="homepage-footer"
      data-homepage-footer
      className="relative w-full overflow-hidden bg-transparent px-[var(--gutter-tight)] py-12 text-black dark:text-white sm:py-16 lg:px-[var(--gutter)]"
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
            <HomeStaggeredText
              as="p"
              className="max-w-xs text-sm leading-relaxed text-black/74 dark:text-white/74 sm:text-base"
              delay={14}
              text="Souqna is a bilingual commerce workspace for launching, connecting, and operating modern Gulf storefronts."
            />
            <div className="flex items-center gap-2">
              {socials.map((s) => (
                <span
                  key={s.key}
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-white/25 text-black/80 dark:text-white/80"
                >
                  {s.icon}
                </span>
              ))}
            </div>
          </motion.div>

          {cols.map((col, ci) => (
            <motion.div
              key={col.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.05 + ci * 0.05 }}
              className="flex flex-col gap-2 lg:border-t lg:border-white/15 lg:pt-5"
            >
              <HomeStaggeredText
                as="h4"
                className="text-base font-semibold text-black dark:text-white sm:text-lg"
                delay={14}
                text={col.title}
              />
              <ul className="flex flex-col gap-1">
                {col.links.map((link) => {
                  const { label, href } = link;
                  const badge = "badge" in link ? link.badge : undefined;
                  return (
                    <li key={label} className="flex items-center gap-2">
                      <Link
                        href={localize(href)}
                        className="text-sm text-black/72 dark:text-white/72 transition-colors hover:text-black dark:hover:text-white sm:text-base"
                      >
                        <HomeStaggeredText as="span" blur={false} delay={10} text={label} />
                      </Link>
                      {badge && (
                        <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-black/80 dark:text-white/80">
                          <HomeStaggeredText as="span" blur={false} delay={8} text={badge} />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          ))}
        </div>

        <div
          className="relative mt-20 w-full"
          aria-hidden="true"
          style={{
            fontSize: "min(14.2vw, 210px)",
            height: "0.74em",
            maskImage: "linear-gradient(to bottom, #000 50%, transparent 95%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, #000 50%, transparent 95%)",
          }}
        >
          <div
            className="absolute inset-0 flex justify-center whitespace-nowrap font-bold uppercase leading-none text-black dark:text-white dark:hidden"
            style={{
              fontSize: "inherit",
              letterSpacing: "0.15em",
              paddingLeft: "0.15em",
              textShadow:
                "0 -1.5px 0 rgba(115,115,115,0.7), 1.5px 0 0 rgba(115,115,115,0.7), 0 1.5px 0 rgba(115,115,115,0.7), -1.5px 0 0 rgba(115,115,115,0.7), 1px 1px 0 rgba(115,115,115,0.7), -1px -1px 0 rgba(115,115,115,0.7), 1px -1px 0 rgba(115,115,115,0.7), -1px 1px 0 rgba(115,115,115,0.7)",
            }}
          >
            <HomeStaggeredText as="span" blur={false} delay={18} segmentBy="chars" text="Souqna" />
          </div>
          <div
            className="absolute inset-0 hidden justify-center whitespace-nowrap font-bold uppercase leading-none text-black"
            style={{
              fontSize: "inherit",
              letterSpacing: "0.15em",
              paddingLeft: "0.15em",
              textShadow:
                "0 -1.5px 0 rgba(163,163,163,0.55), 1.5px 0 0 rgba(163,163,163,0.55), 0 1.5px 0 rgba(163,163,163,0.55), -1.5px 0 0 rgba(163,163,163,0.55), 1px 1px 0 rgba(163,163,163,0.55), -1px -1px 0 rgba(163,163,163,0.55), 1px -1px 0 rgba(163,163,163,0.55), -1px 1px 0 rgba(163,163,163,0.55)",
            }}
          >
            Souqna
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 text-xs text-black/58 dark:text-white/58 sm:flex-row sm:items-center sm:text-sm">
          <HomeStaggeredText
            as="p"
            blur={false}
            delay={10}
            text="© 2026 Souqna / Built for AI-first commerce"
          />
          <div className="flex items-center gap-5">
            <Link href={localize("/docs")} className="transition-colors hover:text-black dark:hover:text-white">
              <HomeStaggeredText as="span" blur={false} delay={10} text="Security" />
            </Link>
            <Link href={localize("/terms")} className="transition-colors hover:text-black dark:hover:text-white">
              <HomeStaggeredText as="span" blur={false} delay={10} text="Terms of service" />
            </Link>
            <Link href={localize("/privacy")} className="transition-colors hover:text-black dark:hover:text-white">
              <HomeStaggeredText as="span" blur={false} delay={10} text="Privacy policy" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
