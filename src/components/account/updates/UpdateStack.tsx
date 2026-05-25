'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { AccountUpdateView } from './types';
import { UpdateCard } from './UpdateCard';

type UpdateStackProps = {
  update: AccountUpdateView;
  index: number;
  total: number;
  onViewDetails: () => void;
  locale?: 'en' | 'ar';
  titleId?: string;
};

export function UpdateStack({
  update,
  index,
  total,
  onViewDetails,
  locale = 'en',
  titleId,
}: UpdateStackProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-7 bottom-0 top-5 rounded-lg border border-[#29252a] bg-[#171417] opacity-70 shadow-lg" />
      {total - index > 1 ? (
        <div className="pointer-events-none absolute inset-x-12 bottom-0 top-10 rounded-lg border border-[#29252a] bg-[#1f181c] opacity-55" />
      ) : null}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={update.id}
          initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -18, scale: 0.98 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <UpdateCard
            update={update}
            onViewDetails={onViewDetails}
            locale={locale}
            titleId={titleId}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
