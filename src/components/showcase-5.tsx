'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Showcase5Props as BlockShowcase5Props, Showcase5Tab } from '@/lib/blocks/types';
import { souqnaFxClassName, SouqnaFxStyles } from './souqna-fx-styles';

type Props = BlockShowcase5Props & {
  dir?: 'ltr' | 'rtl';
};

const FALLBACK_TABS: Showcase5Tab[] = [
  {
    id: 'studios',
    label: 'Studios',
    images: [
      'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?w=600&q=80',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
      'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=600&q=80',
      'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&q=80',
    ],
  },
  {
    id: 'creators',
    label: 'Creators',
    images: [
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80',
      'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&q=80',
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80',
      'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=600&q=80',
    ],
  },
  {
    id: 'teams',
    label: 'Teams',
    images: [
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80',
      'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&q=80',
      'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&q=80',
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&q=80',
    ],
  },
];

function normalizeTabs(tabs?: Showcase5Tab[]): Showcase5Tab[] {
  const cleaned = (tabs ?? [])
    .map((tab, index) => ({
      id: tab.id || `tab-${index + 1}`,
      label: tab.label || `Tab ${index + 1}`,
      images: (tab.images ?? []).filter((src) => src.trim()),
    }))
    .filter((tab) => tab.label || tab.images.length);
  return cleaned.length ? cleaned : FALLBACK_TABS;
}

export default function Showcase5({
  eyebrow = 'In the wild',
  title = 'Work that left the canvas and made it to market',
  description = 'A rolling feed of campaigns, launches, and side projects shipped by people building on our tools every day.',
  tabs,
  dir = 'ltr',
}: Props) {
  const shouldReduceMotion = useReducedMotion();
  const normalizedTabs = useMemo(() => normalizeTabs(tabs), [tabs]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeTab = normalizedTabs[activeIndex] ?? normalizedTabs[0];
  const slides = activeTab?.images.length ? activeTab.images : (FALLBACK_TABS[0]?.images ?? []);
  const loop = shouldReduceMotion ? slides : [...slides, ...slides];

  useEffect(() => {
    if (activeIndex >= normalizedTabs.length) setActiveIndex(0);
  }, [activeIndex, normalizedTabs.length]);

  return (
    <section
      dir={dir}
      className={`${souqnaFxClassName} relative flex w-full flex-col items-center overflow-hidden bg-white py-8 text-neutral-900 dark:bg-neutral-950 dark:text-white sm:py-10`}
    >
      <SouqnaFxStyles />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.25] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(0 0 0 / 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgb(0 0 0 / 0.06) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
        }}
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
        {eyebrow ? (
          <motion.span
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-500"
          >
            {eyebrow}
          </motion.span>
        ) : null}
        {title ? (
          <motion.h2
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-3 max-w-3xl text-2xl font-semibold leading-tight text-neutral-900 dark:text-white sm:text-3xl md:text-4xl"
          >
            {title}
          </motion.h2>
        ) : null}
        {description ? (
          <motion.p
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-3 max-w-xl text-sm leading-6 text-neutral-600 dark:text-neutral-400"
          >
            {description}
          </motion.p>
        ) : null}

        <div className="relative mt-5 flex flex-wrap items-center justify-center rounded-full border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-900">
          {normalizedTabs.map((tab, index) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`relative z-10 cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeIndex === index
                  ? 'text-neutral-900 dark:text-white'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-white'
              }`}
            >
              {activeIndex === index ? (
                <motion.span
                  layoutId="showcase5-pill"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="absolute inset-0 -z-10 rounded-full bg-neutral-100 dark:bg-neutral-800"
                />
              ) : null}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-8 w-full overflow-hidden py-4 sm:mt-10">
        <motion.div
          animate={shouldReduceMotion ? undefined : { x: ['0%', '-50%'] }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
          className="flex w-max items-center will-change-transform"
        >
          {loop.map((src, index) => (
            <div
              key={`${activeTab?.id ?? 'tab'}-${src}-${index}`}
              className="flex shrink-0 items-center"
            >
              <div className="relative z-10 aspect-square w-[190px] rounded-2xl border border-neutral-200 bg-white p-2 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.2)] dark:border-neutral-800 dark:bg-neutral-900 sm:w-[230px]">
                <div className="relative h-full w-full overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800 sm:rounded-2xl">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={`${activeTab?.id ?? 'tab'}-${index}`}
                      src={src}
                      alt=""
                      loading="lazy"
                      initial={
                        shouldReduceMotion ? false : { scale: 0, opacity: 0, borderRadius: '100%' }
                      }
                      animate={{ scale: 1, opacity: 1, borderRadius: '0%' }}
                      exit={
                        shouldReduceMotion
                          ? undefined
                          : { scale: 0, opacity: 0, borderRadius: '100%' }
                      }
                      transition={{
                        duration: 0.55,
                        ease: [0.22, 1, 0.36, 1],
                        delay: shouldReduceMotion ? 0 : (index % slides.length) * 0.04,
                      }}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </AnimatePresence>
                </div>
              </div>
              {!shouldReduceMotion ? (
                <div className="relative z-0 flex w-10 shrink-0 items-center sm:w-14">
                  <span className="absolute start-0 h-3 w-3 -translate-x-1/2 rounded-full bg-orange-500 rtl:translate-x-1/2" />
                  <span className="flex-1 border-t-2 border-dashed border-neutral-300 dark:border-neutral-700" />
                  <span className="absolute end-0 h-3 w-3 translate-x-1/2 rounded-full bg-orange-500 rtl:-translate-x-1/2" />
                </div>
              ) : null}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
