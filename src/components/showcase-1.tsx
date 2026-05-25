'use client';

import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Showcase1Item, Showcase1Props as BlockShowcase1Props } from '@/lib/blocks/types';
import { souqnaFxClassName, SouqnaFxStyles } from './souqna-fx-styles';

type Props = BlockShowcase1Props & {
  dir?: 'ltr' | 'rtl';
};

const FALLBACK_ITEMS: Showcase1Item[] = [
  {
    id: 'case-1',
    title: 'Launch edit',
    subtitle: 'A short visual story for new arrivals and seasonal drops.',
    kicker: 'Products',
    imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1000&q=80',
    href: '#',
  },
  {
    id: 'case-2',
    title: 'Gift guide',
    subtitle: 'Group a few hero picks into one compact buying moment.',
    kicker: 'Gifting',
    imageUrl: 'https://images.unsplash.com/photo-1512909006721-3d6018887383?w=1000&q=80',
    href: '#',
  },
  {
    id: 'case-3',
    title: 'Studio notes',
    subtitle: 'Show process, mood, or founder story without a full landing page.',
    kicker: 'Editorial',
    imageUrl: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1000&q=80',
    href: '#',
  },
  {
    id: 'case-4',
    title: 'Local pickup',
    subtitle: 'Highlight service details with a visual anchor buyers can scan.',
    kicker: 'Services',
    imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1000&q=80',
    href: '#',
  },
];

function normalizeItems(items?: Showcase1Item[]) {
  const cleaned = (items ?? []).filter((item) => item.title?.trim() || item.imageUrl?.trim());
  return cleaned.length ? cleaned : FALLBACK_ITEMS;
}

export default function Showcase1({
  eyebrow = 'Featured paths',
  title = 'Pick a story and let the visuals carry the next step.',
  description,
  items,
  dir = 'ltr',
}: Props) {
  const shouldReduceMotion = useReducedMotion();
  const normalizedItems = useMemo(() => normalizeItems(items), [items]);
  const [activeIndex, setActiveIndex] = useState(0);
  const active = normalizedItems[activeIndex] ?? normalizedItems[0] ?? FALLBACK_ITEMS[0]!;

  return (
    <section
      dir={dir}
      className={`${souqnaFxClassName} w-full overflow-hidden bg-white px-4 py-8 text-neutral-950 dark:bg-neutral-950 dark:text-white sm:px-6 sm:py-10 lg:px-8`}
    >
      <SouqnaFxStyles />
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          {eyebrow ? (
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h2 className="mt-2 max-w-xl text-2xl font-semibold leading-tight sm:text-3xl">
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="mt-3 max-w-lg text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              {description}
            </p>
          ) : null}
          <div className="mt-6 grid gap-2">
            {normalizedItems.map((item, index) => (
              <button
                key={item.id ?? `${item.title}-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`group flex items-center justify-between gap-3 rounded-2xl border p-3 text-start transition ${
                  activeIndex === index
                    ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-950 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white'
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium uppercase tracking-[0.14em] opacity-60">
                    {item.kicker || `0${index + 1}`}
                  </span>
                  <span className="mt-1 block truncate text-sm font-semibold">{item.title}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 rtl:rotate-180" />
              </button>
            ))}
          </div>
        </div>

        <div className="relative min-h-[320px] overflow-hidden rounded-3xl bg-neutral-100 dark:bg-neutral-900">
          <AnimatePresence mode="wait">
            <motion.img
              key={active.imageUrl}
              src={active.imageUrl}
              alt={active.title}
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/70">
              {active.kicker}
            </p>
            <h3 className="mt-1 text-2xl font-semibold">{active.title}</h3>
            {active.subtitle ? (
              <p className="mt-2 max-w-md text-sm text-white/80">{active.subtitle}</p>
            ) : null}
            {active.href ? (
              <a
                href={active.href}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-950"
              >
                Open
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
