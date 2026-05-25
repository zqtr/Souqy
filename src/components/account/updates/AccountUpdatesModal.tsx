'use client';

import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ExternalLink, Rocket, X } from 'lucide-react';
import { markAccountUpdateRead } from '@/app/actions/accountUpdates';
import { UpdateEmptyState } from './UpdateEmptyState';
import { UpdateProgress } from './UpdateProgress';
import { UpdateStack } from './UpdateStack';
import type { AccountUpdateView } from './types';

type AccountUpdatesModalProps = {
  initialUpdates: AccountUpdateView[];
  locale?: 'en' | 'ar';
};

const modalCopy = {
  en: {
    eyebrow: 'Changelog',
    title: 'Souqna changelog',
    subtitle: 'Updates and product improvements you have not seen yet.',
    close: 'Close updates',
    sticky: 'Important update. Acknowledge it to keep moving.',
    revisit: 'You can come back to unread updates by reopening this page.',
    details: 'View details',
    footerTitle: 'Souqna just updated',
    gotIt: 'Got it',
    next: 'Next',
  },
  ar: {
    eyebrow: 'سجل التحديثات',
    title: 'تحديثات سوقنا',
    subtitle: 'التحديثات والتحسينات التي لم ترها بعد.',
    close: 'إغلاق التحديثات',
    sticky: 'تحديث مهم. أكده للمتابعة.',
    revisit: 'يمكنك الرجوع للتحديثات غير المقروءة عند فتح هذه الصفحة.',
    details: 'عرض التفاصيل',
    footerTitle: 'تم تحديث سوقنا',
    gotIt: 'تم',
    next: 'التالي',
  },
} as const;

const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AccountUpdatesModal({ initialUpdates, locale = 'en' }: AccountUpdatesModalProps) {
  const [updates, setUpdates] = useState(initialUpdates);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(initialUpdates.length > 0);
  const [, startTransition] = useTransition();
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const subtitleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = updates[index] ?? null;
  const detailsHref = current?.detailsHref ?? current?.ctaHref ?? null;
  const isLast = index >= updates.length - 1;
  const isRtl = locale === 'ar';
  const copy = modalCopy[locale];

  const markReadOptimistically = useCallback((updateId: string) => {
    startTransition(() => {
      void markAccountUpdateRead(updateId);
    });
  }, [startTransition]);

  const finishCurrent = useCallback(() => {
    if (!current) return;
    markReadOptimistically(current.id);
    if (!isLast) {
      setIndex((value) => value + 1);
      return;
    }
    setUpdates([]);
    setIndex(0);
    closeTimerRef.current = setTimeout(() => setOpen(false), 900);
  }, [current, isLast, markReadOptimistically]);

  const viewDetails = useCallback(() => {
    if (!current || !detailsHref) return;
    setUpdates((value) => value.filter((update) => update.id !== current.id));
    void markAccountUpdateRead(current.id).finally(() => {
      window.location.href = detailsHref;
    });
  }, [current, detailsHref]);

  const closeIfAllowed = useCallback(() => {
    if (current?.isSticky) return;
    setOpen(false);
  }, [current]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const id = window.setTimeout(() => {
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector);
      focusables?.[0]?.focus();
    }, 0);
    return () => {
      window.clearTimeout(id);
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeIfAllowed();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      ).filter((element) => !element.hasAttribute('disabled'));
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeIfAllowed, open]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  if (initialUpdates.length === 0 && updates.length === 0) return null;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[#080608]/75 px-3 py-5 backdrop-blur-xl sm:px-6"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={subtitleId}
            tabIndex={-1}
            dir={isRtl ? 'rtl' : 'ltr'}
            className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-[#31282d] bg-[#121113] text-[#f8efdf] shadow-[0_42px_140px_rgba(0,0,0,0.62)] outline-none ring-1 ring-[#e8d6b8]/10"
            initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            {!current?.isSticky ? (
              <button
                type="button"
                onClick={closeIfAllowed}
                className="absolute end-4 top-4 z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e8d6b8]/15 bg-[#0d0c0e]/75 text-[#e8d6b8] backdrop-blur transition hover:border-[#d8b56b]/45 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d8b56b]"
                aria-label={copy.close}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}

            {current ? (
              <>
                <span id={subtitleId} className="sr-only">
                  {copy.subtitle}
                </span>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <UpdateStack
                    update={current}
                    index={index}
                    total={updates.length}
                    onViewDetails={viewDetails}
                    locale={locale}
                    titleId={titleId}
                  />
                </div>
                <div className="flex items-center justify-center border-t border-[#29252a] bg-[#121113] px-4 py-3">
                  <UpdateProgress index={index} total={updates.length} locale={locale} />
                </div>
                <footer className="flex flex-col gap-3 border-t border-[#29252a] bg-[#0d0c0e] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#f8efdf]">
                    <Rocket className="h-4 w-4 text-[#5f7cff]" aria-hidden="true" />
                    {copy.footerTitle}
                  </span>
                  <div className="flex items-center justify-end gap-2">
                    {detailsHref ? (
                      <button
                        type="button"
                        onClick={viewDetails}
                        className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#d8b56b]/35 bg-[#191619] px-4 text-sm font-semibold text-[#e8d6b8] transition hover:border-[#d8b56b] hover:bg-[#21181a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d8b56b]"
                      >
                        {copy.details}
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={finishCurrent}
                      className="min-h-9 rounded-full bg-[#5f7cff] px-5 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(95,124,255,0.26)] transition hover:bg-[#718cff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d8b56b]"
                    >
                      {isLast ? copy.gotIt : copy.next}
                    </button>
                  </div>
                </footer>
              </>
            ) : (
              <UpdateEmptyState locale={locale} />
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
