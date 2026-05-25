'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import type { Showcase4Project, Showcase4Props as BlockShowcase4Props } from '@/lib/blocks/types';
import { souqnaFxClassName, SouqnaFxStyles } from './souqna-fx-styles';

type Props = BlockShowcase4Props & {
  dir?: 'ltr' | 'rtl';
};

const FALLBACK_PROJECTS: Showcase4Project[] = [
  {
    id: 'showcase-4-1',
    title: 'Halcyon Type Foundry',
    client: 'Halcyon',
    year: '2025',
    tags: ['Identity'],
    imageUrl: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&q=80',
    href: '#',
  },
  {
    id: 'showcase-4-2',
    title: 'Bloom Cold Brew',
    client: 'Bloom Coffee',
    year: '2025',
    tags: ['Campaign'],
    imageUrl: 'https://images.unsplash.com/photo-1605902711622-cfb43c4437b5?w=800&q=80',
    href: '#',
  },
  {
    id: 'showcase-4-3',
    title: 'Polaris Navigation Kit',
    client: 'Polaris',
    year: '2024',
    tags: ['Identity', 'Product'],
    imageUrl: 'https://images.unsplash.com/photo-1618004652321-13a63e576b80?w=800&q=80',
    href: '#',
  },
  {
    id: 'showcase-4-4',
    title: 'Northwind Commerce',
    client: 'Northwind',
    year: '2024',
    tags: ['Identity', 'Campaign'],
    imageUrl: 'https://images.unsplash.com/photo-1618556450994-a6a128ef0d9d?w=800&q=80',
    href: '#',
  },
];

function normalizeProjects(projects?: Showcase4Project[]): Showcase4Project[] {
  const cleaned = (projects ?? []).filter(
    (project) => project.title?.trim() || project.imageUrl?.trim(),
  );
  return cleaned.length ? cleaned : FALLBACK_PROJECTS;
}

function collectFilters(projects: Showcase4Project[]) {
  const tags = new Set<string>();
  projects.forEach((project) => project.tags?.forEach((tag) => tag.trim() && tags.add(tag.trim())));
  return ['All', ...Array.from(tags).slice(0, 6)];
}

export default function Showcase4({
  eyebrow = 'Selected Work / 2023-2025',
  title = 'Quiet craft, shipped for brands you probably already use.',
  projects,
  dir = 'ltr',
}: Props) {
  const shouldReduceMotion = useReducedMotion();
  const normalizedProjects = useMemo(() => normalizeProjects(projects), [projects]);
  const filters = useMemo(() => collectFilters(normalizedProjects), [normalizedProjects]);
  const [active, setActive] = useState('All');

  const visible =
    active === 'All'
      ? normalizedProjects
      : normalizedProjects.filter((project) => project.tags?.includes(active));

  return (
    <section
      dir={dir}
      className={`${souqnaFxClassName} flex w-full items-start bg-white px-4 py-8 text-neutral-900 dark:bg-neutral-950 dark:text-white sm:px-6 sm:py-10 lg:px-8`}
    >
      <SouqnaFxStyles />
      <div className="mx-auto w-full max-w-6xl">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
          whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-6 flex flex-col gap-4"
        >
          {eyebrow ? (
            <span className="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-500">
              {eyebrow}
            </span>
          ) : null}
          {title ? (
            <h2 className="max-w-3xl text-2xl font-semibold leading-tight text-neutral-900 dark:text-white sm:text-3xl md:text-4xl">
              {title}
            </h2>
          ) : null}
        </motion.div>

        <div className="flex flex-col gap-4 border-t border-neutral-200 pt-6 dark:border-neutral-800 sm:flex-row sm:items-center">
          <span className="shrink-0 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-500">
            Filter
          </span>
          <div className="relative flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActive(filter)}
                className={`relative isolate cursor-pointer rounded-full px-4 py-1.5 text-xs font-medium uppercase transition-colors ${
                  active === filter
                    ? 'text-white dark:text-neutral-900'
                    : 'bg-neutral-100 text-neutral-700 hover:text-neutral-900 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:text-white'
                }`}
              >
                {active === filter ? (
                  <motion.span
                    layoutId="showcase4-pill"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    className="absolute inset-0 -z-10 rounded-full bg-neutral-900 dark:bg-white"
                  />
                ) : null}
                {filter}
              </button>
            ))}
          </div>
          <span className="text-xs uppercase text-neutral-500 dark:text-neutral-500 sm:ml-auto">
            {visible.length} {visible.length === 1 ? 'project' : 'projects'}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((project, index) => (
              <motion.a
                key={project.id ?? `${project.title}-${index}`}
                href={project.href || '#'}
                layout
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                transition={{
                  layout: { type: 'spring', stiffness: 260, damping: 30, mass: 0.8 },
                  opacity: { duration: 0.25, ease: 'easeOut' },
                }}
                whileHover={shouldReduceMotion ? undefined : 'hover'}
                className="group flex flex-col gap-3"
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-900">
                  {project.imageUrl ? (
                    <motion.img
                      src={project.imageUrl}
                      alt={project.title}
                      loading="lazy"
                      variants={{ hover: { scale: 1.05 } }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}
                  <motion.div
                    variants={{ hover: { opacity: 1, y: 0 } }}
                    initial={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.3 }}
                    className="absolute end-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white text-neutral-900 shadow-md"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </motion.div>
                  <div className="absolute bottom-3 start-3 flex flex-wrap gap-1.5">
                    {(project.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium uppercase text-neutral-900 backdrop-blur-sm dark:bg-neutral-900/90 dark:text-white"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <h3 className="truncate text-base font-semibold text-neutral-900 dark:text-white sm:text-lg">
                      {project.title}
                    </h3>
                    {project.client ? (
                      <span className="text-xs text-neutral-500 dark:text-neutral-500">
                        {project.client}
                      </span>
                    ) : null}
                  </div>
                  {project.year ? (
                    <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-600">
                      {project.year}
                    </span>
                  ) : null}
                </div>
              </motion.a>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
