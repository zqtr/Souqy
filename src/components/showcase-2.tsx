'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useAnimationFrame, useMotionValue, useReducedMotion } from 'motion/react';
import type { Showcase2Image, Showcase2Props as BlockShowcase2Props } from '@/lib/blocks/types';
import { souqnaFxClassName, SouqnaFxStyles } from './souqna-fx-styles';

type Props = BlockShowcase2Props & {
  dir?: 'ltr' | 'rtl';
};

const FALLBACK_ITEMS: Showcase2Image[] = [
  {
    id: 'showcase-2-1',
    imageUrl:
      'https://cdn.dribbble.com/userupload/46030284/file/8dfdc9a8b09fdbd99b010c1dcb279841.jpg?resize=1024x1693&vertical=center',
    alt: 'Editorial product showcase',
    height: 'md',
  },
  {
    id: 'showcase-2-2',
    imageUrl:
      'https://cdn.dribbble.com/userupload/46029941/file/f3b0e906d38980bf48e008f5542a58b5.jpg?resize=1024x1693&vertical=center',
    alt: 'Campaign visual',
    height: 'lg',
  },
  {
    id: 'showcase-2-3',
    imageUrl:
      'https://cdn.dribbble.com/userupload/45777759/file/acf14657b38cd25e64bb16b4f201bef8.jpg?resize=1024x1529&vertical=center',
    alt: 'Brand case study',
    height: 'md',
  },
  {
    id: 'showcase-2-4',
    imageUrl:
      'https://cdn.dribbble.com/userupload/46068721/file/3910087a60fe6f781ddae7c14daf1804.jpg?resize=1024x1589&vertical=center',
    alt: 'Portfolio card',
    height: 'sm',
  },
];

const HEIGHT_CLASS: Record<NonNullable<Showcase2Image['height']>, string> = {
  sm: 'h-[240px]',
  md: 'h-[290px]',
  lg: 'h-[340px]',
};

const TONE_CLASS = [
  'bg-rose-200 dark:bg-rose-900/30',
  'bg-lime-200 dark:bg-lime-900/30',
  'bg-blue-200 dark:bg-blue-900/30',
  'bg-neutral-200 dark:bg-neutral-800',
];

function normalizeItems(items?: Showcase2Image[]): Showcase2Image[] {
  const cleaned = (items ?? []).filter((item) => item.imageUrl?.trim());
  return cleaned.length ? cleaned : FALLBACK_ITEMS;
}

export function Showcase2({
  eyebrow = 'Featured Work',
  title = 'Crafting digital experiences that inspire and engage.',
  cta,
  items,
  dir = 'ltr',
}: Props) {
  const shouldReduceMotion = useReducedMotion();
  const normalizedItems = useMemo(() => normalizeItems(items), [items]);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [oneSetWidth, setOneSetWidth] = useState(0);

  const baseVelocity = dir === 'rtl' ? 18 : -18;
  const baseX = useMotionValue(0);
  const scrollVelocity = useRef(baseVelocity);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const loopItems = shouldReduceMotion
    ? normalizedItems
    : [
        ...normalizedItems,
        ...normalizedItems,
        ...normalizedItems,
        ...normalizedItems,
        ...normalizedItems,
        ...normalizedItems,
      ];

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 640;
      const itemWidth = isMobile ? 220 : 260;
      const gap = 16;
      const width = (itemWidth + gap) * normalizedItems.length;
      setOneSetWidth(width);
      baseX.set(shouldReduceMotion ? 0 : -width);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [baseX, normalizedItems.length, shouldReduceMotion]);

  useAnimationFrame((_, delta) => {
    if (!oneSetWidth || shouldReduceMotion || isDragging) return;

    scrollVelocity.current = scrollVelocity.current * 0.9 + baseVelocity * 0.1;

    const moveBy = scrollVelocity.current * (delta / 1000);
    baseX.set(baseX.get() + moveBy);

    const x = baseX.get();
    if (dir === 'rtl') {
      if (x >= 0) baseX.set(x - oneSetWidth);
      if (x < -oneSetWidth * 2) baseX.set(x + oneSetWidth);
      return;
    }

    if (x <= -oneSetWidth * 2) {
      baseX.set(x + oneSetWidth);
    } else if (x > 0) {
      baseX.set(x - oneSetWidth);
    }
  });

  return (
    <section
      dir={dir}
      className={`${souqnaFxClassName} w-full overflow-hidden bg-white px-4 py-8 text-neutral-900 dark:bg-neutral-950 dark:text-white sm:px-6 sm:py-10 lg:px-8`}
    >
      <SouqnaFxStyles />
      <div className="mx-auto w-full max-w-6xl">
        <motion.div
          initial={false}
          whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="max-w-xl">
            {eyebrow ? (
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="mb-5 max-w-2xl text-2xl font-semibold leading-tight text-neutral-900 dark:text-white sm:text-3xl md:text-4xl">
                {title}
              </h2>
            ) : null}
            {cta?.label ? (
              <motion.a
                href={cta.href || '#'}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                className="inline-flex rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                {cta.label}
              </motion.a>
            ) : null}
          </div>
        </motion.div>

        <div className="relative -mx-4 overflow-hidden py-8 sm:-mx-6 sm:py-10 lg:-mx-8">
          <motion.div
            ref={scrollerRef}
            className="flex cursor-grab items-end gap-4 active:cursor-grabbing"
            style={{ x: baseX }}
            drag={shouldReduceMotion ? false : 'x'}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={(_, info) => {
              setIsDragging(false);
              scrollVelocity.current = info.velocity.x;
            }}
            dragElastic={0.05}
            dragMomentum={false}
          >
            {loopItems.map((item, index) => (
              <motion.div
                key={`${item.id ?? item.imageUrl}-${index}`}
                className={`relative shrink-0 select-none overflow-hidden rounded-2xl ${HEIGHT_CLASS[item.height ?? 'md']} w-[220px] pointer-events-auto sm:w-[260px]`}
                initial={{ rotateX: 0, opacity: 1 }}
                animate={
                  hoveredId === index && !shouldReduceMotion
                    ? {
                        scale: 1.05,
                        rotateX: -15,
                        y: -25,
                        zIndex: 50,
                      }
                    : {
                        scale: 1,
                        rotateX: 0,
                        y: 0,
                        zIndex: 1,
                      }
                }
                transition={{
                  duration: 0.3,
                  ease: 'backOut',
                  zIndex: { delay: hoveredId === index ? 0 : 0.4 },
                }}
                onMouseEnter={() => setHoveredId(index)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ transformPerspective: 1000 }}
              >
                <div className={`h-full w-full ${TONE_CLASS[index % TONE_CLASS.length]}`}>
                  <img
                    src={item.imageUrl}
                    alt={item.alt ?? ''}
                    className="h-full w-full object-cover object-top pointer-events-none"
                    draggable="false"
                  />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
