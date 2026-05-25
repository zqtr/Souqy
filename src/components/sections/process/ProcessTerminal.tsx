'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Locale } from '@/i18n/locales';
import { getCopy } from '@/content/copy';
import { palette } from '@/lib/tokens';

type PhaseKey = 'begin' | 'build' | 'tune' | 'publish';

type Props = {
  locale: Locale;
  active: PhaseKey;
  index: number;
  total: number;
  host: string;
  hint: string;
};

/**
 * Right-side terminal-style panel. Swaps content as the active phase
 * changes. Sticky positioned so it tracks the user as they hover the
 * left list.
 */
export function ProcessTerminal({ locale, active, index, total, host, hint }: Props) {
  const reduced = useReducedMotion();
  const t = getCopy(locale).process.phases[active];
  const tEcho = getCopy(locale === 'en' ? 'ar' : 'en').process.phases[active];
  const isRtl = locale === 'ar';

  return (
    <div className="lg:sticky" style={{ top: 120 }}>
      <div
        className="rounded-[4px] relative"
        style={{
          background: 'rgba(232,220,196,0.04)',
          border: `1px solid ${palette.gold}33`,
          padding: '18px 22px',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--color-sand-pale)',
          minHeight: 240,
        }}
      >
        <div
          className="flex items-center gap-2 pb-3.5 mb-3.5"
          style={{
            borderBottom: `1px solid ${palette.gold}22`,
            color: 'rgba(232,220,196,0.5)',
            fontSize: 11,
            letterSpacing: '0.05em',
          }}
        >
          <span
            aria-hidden
            className="block h-2 w-2 rounded-full"
            style={{
              background: palette.gold,
              boxShadow: `0 0 10px ${palette.gold}`,
            }}
          />
          <span>{host}</span>
          <span style={{ marginInlineStart: 'auto', fontVariantNumeric: 'tabular-nums' }}>
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.2, 0.7, 0.15, 1] }}
            style={{ lineHeight: 1.7, color: 'rgba(232,220,196,0.95)' }}
          >
            <div style={{ color: palette.gold }}>$ phase {index + 1}</div>
            <div style={{ color: 'rgba(232,220,196,0.6)', marginTop: 4, marginBottom: 12 }}>
              # {t.name.toLowerCase()}{' '}
              <span dir={isRtl ? 'ltr' : 'rtl'} style={{ fontFamily: 'var(--font-arabic)' }}>
                / {tEcho.name}
              </span>
            </div>
            <div
              style={{
                fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
                fontSize: 16,
                lineHeight: isRtl ? 1.7 : 1.6,
                color: 'var(--color-sand-pale)',
                fontWeight: 300,
              }}
            >
              {t.body}
            </div>
            <div
              style={{
                marginTop: 18,
                color: 'rgba(232,220,196,0.4)',
                fontSize: 11,
              }}
            >
              ↳ ready{' '}
              <span aria-hidden style={{ color: palette.gold }}>
                ●
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <p
        className="font-mono text-[11px] mt-3.5"
        style={{
          color: 'rgba(232,220,196,0.45)',
          letterSpacing: '0.05em',
        }}
      >
        * {hint}
      </p>
    </div>
  );
}
