"use client";

import { motion } from "motion/react";
import { Cloud, Database, Code2, PlayCircle, Zap, CheckCircle2 } from "lucide-react";
import { HomeStaggeredText } from "@/components/sections/home/HomeStaggeredText";
import { HeroPromptBar } from "@/components/sections/home/HeroPromptBar";
import type { Locale } from "@/i18n/locales";
import type { CSSProperties } from "react";

function FloatingIcons() {
  const icons = [
    {
      Icon: Zap,
      color: "text-neutral-900 dark:text-white",
      bg: "bg-white dark:bg-neutral-800",
      x: "20%",
      xMob: "10%",
      y: "16%",
      delay: 0,
    },
    {
      Icon: Cloud,
      color: "text-neutral-900 dark:text-white",
      bg: "bg-white dark:bg-neutral-800",
      x: "48%",
      xMob: "55%",
      y: "46%",
      delay: 0.2,
    },
    {
      Icon: Database,
      color: "text-neutral-900 dark:text-white",
      bg: "bg-white dark:bg-neutral-800",
      x: "32%",
      xMob: "30%",
      y: "74%",
      delay: 0.4,
    },
    {
      Icon: Code2,
      color: "text-neutral-900 dark:text-white",
      bg: "bg-white dark:bg-neutral-800",
      x: "8%",
      xMob: "4%",
      y: "52%",
      delay: 0.3,
    },
  ];

  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[48%] overflow-hidden md:block">
      {icons.map((item, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-2xl border border-neutral-200 p-3 shadow-lg dark:border-neutral-700 ${item.bg} left-(--x-mob) sm:p-4 md:left-(--x-desk)`}
          style={
            {
              top: item.y,
              "--x-mob": item.xMob,
              "--x-desk": item.x,
            } as CSSProperties
          }
          animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
          transition={{
            duration: 4 + i * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: item.delay,
          }}
        >
          <item.Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${item.color}`} />
        </motion.div>
      ))}
    </div>
  );
}

function ContentCards() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[52%] items-center justify-start ps-8 md:flex">
      <div className="relative grid w-full max-w-[620px] gap-3 sm:grid-cols-2 md:block md:max-w-sm md:space-y-3">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="pointer-events-auto rounded-xl border border-neutral-200 bg-white/90 p-4 shadow-lg backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/90 md:origin-left"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="min-w-6 rounded-md bg-neutral-200 p-1 dark:bg-neutral-700">
              <Zap className="w-4 h-4 text-neutral-900 dark:text-white" />
            </div>
            <span className="text-xs font-semibold text-neutral-800 dark:text-white truncate">
              AI Storefront Generated
            </span>
          </div>
          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-relaxed mb-2 line-clamp-2">
            Souqna turns your brand, products, and voice into a launch-ready
            website.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="pointer-events-auto rounded-xl border border-neutral-200 bg-white/90 p-4 shadow-lg backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/90 md:ms-6 md:origin-left"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="min-w-6 rounded-md bg-neutral-200 p-1 dark:bg-neutral-700">
              <CheckCircle2 className="w-4 h-4 text-neutral-900 dark:text-white" />
            </div>
            <span className="text-xs font-semibold text-neutral-800 dark:text-white truncate">
              Integrations Ready
            </span>
          </div>
          <ul className="space-y-1 mb-2">
            <li className="text-[10px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-neutral-300" /> Payments
              connected
            </li>
            <li className="text-[10px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-neutral-300" /> Domain
              ready to deploy
            </li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}

export function Hero13({ locale }: { locale: Locale }) {
  return (
    <section className="relative isolate flex w-full items-start overflow-hidden bg-transparent px-[var(--gutter-tight)] pb-12 pt-8 sm:pb-16 lg:items-center lg:px-[var(--gutter)] lg:pb-20">
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="relative flex min-h-[calc(100svh-126px)] w-full flex-col items-center justify-start overflow-hidden rounded-[2rem] pt-10 sm:rounded-[2.5rem] sm:pt-14 lg:min-h-[720px]">
          <div className="pointer-events-auto relative z-20 mx-auto mb-8 max-w-3xl px-2 text-center sm:mb-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <HomeStaggeredText
                as="h1"
                className="mb-4 justify-center text-5xl font-medium tracking-tight text-black dark:text-white sm:text-6xl md:text-7xl"
                delay={22}
                segmentBy="words"
                text="AI builds your website."
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <HomeStaggeredText
                as="p"
                className="mx-auto mb-7 max-w-xl justify-center text-base leading-7 tracking-tight text-black/72 dark:text-white/72 sm:text-lg"
                delay={18}
                text="Forget coding. Describe your business, connect integrations, and deploy a polished storefront in minutes."
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex w-full flex-col items-center justify-center gap-4"
            >
              <HeroPromptBar locale={locale} />
              <button className="flex cursor-pointer items-center gap-2 text-sm font-medium text-black/70 transition-colors hover:text-black dark:text-white/70 dark:hover:text-white">
                <HomeStaggeredText as="span" blur={false} delay={18} text="Watch Souqna" />
                <PlayCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-6 flex flex-wrap items-center justify-center gap-2"
            >
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-neutral-300 dark:border-neutral-950 dark:bg-neutral-700 sm:h-8 sm:w-8"
                  >
                    <span className="text-[8px] sm:text-xs text-neutral-600 dark:text-neutral-400">
                      {i}
                    </span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-black/70 dark:text-white/70 sm:text-sm">
                <span className="text-yellow-500">★★★★★</span> made for AI-first
                storefronts
              </div>
            </motion.div>
          </div>

          <div className="relative mx-auto hidden min-h-[360px] w-full max-w-5xl md:block lg:min-h-[430px]">
            <div className="pointer-events-none absolute inset-0 z-10">
              <FloatingIcons />
              <ContentCards />
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 z-30 h-24 bg-linear-to-t from-white/70 to-transparent dark:from-black/45 sm:hidden" />
        </div>
      </div>
    </section>
  );
}
