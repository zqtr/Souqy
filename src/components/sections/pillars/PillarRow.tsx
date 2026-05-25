'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Locale } from '@/i18n/locales';
import { getCopy } from '@/content/copy';

type PillarKey = 'human' | 'social' | 'economic' | 'environmental';

type Props = {
  locale: Locale;
  pillarKey: PillarKey;
  index: number;
};

/**
 * One row of the pillars stack. Four columns:
 * roman numeral · bilingual name · body · mono note.
 * Hover lifts the numeral to gold and brightens the row.
 */
export function PillarRow({ locale, pillarKey, index }: Props) {
  const [hover, setHover] = useState(false);
  const reduced = useReducedMotion();
  const isRtl = locale === 'ar';

  const t = getCopy(locale).pillars.items[pillarKey];
  const tEcho = getCopy(locale === 'en' ? 'ar' : 'en').pillars.items[pillarKey];

  const initial = reduced ? false : { opacity: 0, y: 24 };
  const whileInView = reduced ? undefined : { opacity: 1, y: 0 };

  return (
    <motion.article
      initial={initial}
      whileInView={whileInView}
      viewport={{ once: true, amount: 0.25 }}
      transition={{
        duration: 0.8,
        delay: index * 0.08,
        ease: [0.2, 0.7, 0.15, 1],
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="souqna-pillar-row grid items-center border-t border-[color:var(--surface-rule)]"
      style={{
        gridTemplateColumns: '60px 1.1fr 2fr 1fr',
        columnGap: 32,
        padding: '40px 0',
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media (max-width: 1023px) {
          .souqna-pillar-row { grid-template-columns: 48px 1fr !important; column-gap: 16px !important; row-gap: 12px !important; padding: 28px 0 !important; }
          .souqna-pillar-row > p { grid-column: 1 / -1 !important; }
          .souqna-pillar-row > div:last-child { grid-column: 1 / -1 !important; text-align: ${isRtl ? 'right' : 'left'} !important; }
        }
      `,
        }}
      />
      <span
        aria-hidden
        className="font-serif italic"
        style={{
          fontFamily: 'var(--font-serif), serif',
          fontSize: 28,
          letterSpacing: '0.02em',
          color: hover ? 'var(--color-gold)' : 'var(--ink-faint)',
          transition: 'color 300ms',
        }}
      >
        {t.roman}
      </span>

      <div className="flex flex-col gap-1">
        <span
          style={{
            fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
            fontWeight: isRtl ? 500 : 400,
            fontSize: 'clamp(26px, 3vw, 42px)',
            letterSpacing: isRtl ? '-0.005em' : '-0.03em',
            lineHeight: isRtl ? 1.15 : 1.05,
            color: 'var(--ink-strong)',
          }}
        >
          {t.name}
        </span>
        <span
          dir={isRtl ? 'ltr' : 'rtl'}
          style={{
            fontFamily: isRtl ? 'var(--font-sans)' : 'var(--font-arabic), var(--font-sans)',
            fontSize: 'clamp(16px, 1.6vw, 22px)',
            fontWeight: 300,
            color: 'var(--ink-faint)',
          }}
        >
          {tEcho.name}
        </span>
      </div>

      <p
        className="m-0 text-pretty"
        style={{
          fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
          fontSize: 16,
          lineHeight: isRtl ? 1.7 : 1.5,
          color: 'var(--ink-muted)',
          maxWidth: 560,
        }}
      >
        {t.body}
      </p>

      <div
        className="font-mono text-[11px] leading-[1.6] text-[color:var(--ink-faint)]"
        style={{
          letterSpacing: '0.04em',
          textAlign: isRtl ? 'left' : 'right',
        }}
      >
        <span>{t.note}</span>
      </div>
    </motion.article>
  );
}
