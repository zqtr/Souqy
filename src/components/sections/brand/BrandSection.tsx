import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/locales';

type Props = {
  locale: Locale;
  label: string;
  title: string;
  lede: string;
  caption?: string;
  children: ReactNode;
  background?: string;
  surfaceBg?: string;
  textColor?: string;
  muted?: string;
};

/**
 * The repeating frame for every brand-book section: eyebrow label,
 * editorial title, lede, and the artboard surface beneath. Surface
 * tone is parameterized so each section can sit on the substrate it
 * documents (sand, maroon, charcoal).
 */
export function BrandSection({
  locale,
  label,
  title,
  lede,
  caption,
  children,
  background = 'var(--surface-bg)',
  surfaceBg = 'var(--surface-elevated)',
  textColor = 'var(--ink-strong)',
  muted = 'var(--ink-muted)',
}: Props) {
  const isRtl = locale === 'ar';
  return (
    <section
      style={{
        background,
        color: textColor,
        padding: '120px clamp(24px, 4vw, 48px)',
        borderTop: '1px solid var(--surface-rule)',
      }}
    >
      <div className="mx-auto" style={{ maxWidth: 1400 }}>
        <div className="flex flex-wrap items-end justify-between gap-y-4 mb-10">
          <div>
            <div
              className="font-mono text-[11px]"
              style={{
                color: 'var(--color-maroon)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {label}
            </div>
            <h2
              className="m-0 mt-3 text-balance"
              style={{
                fontFamily: isRtl
                  ? 'var(--font-arabic), var(--font-sans)'
                  : 'var(--font-sans)',
                fontSize: 'clamp(28px, 3.4vw, 52px)',
                fontWeight: isRtl ? 500 : 400,
                lineHeight: isRtl ? 1.2 : 1.05,
                letterSpacing: isRtl ? '-0.005em' : '-0.03em',
                color: textColor,
                maxWidth: '20ch',
              }}
            >
              {title}
            </h2>
          </div>
          <p
            className="m-0 max-w-[60ch]"
            style={{
              fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
              fontSize: 15,
              lineHeight: isRtl ? 1.7 : 1.55,
              color: muted,
            }}
          >
            {lede}
          </p>
        </div>
        <div
          className="rounded-[2px] overflow-hidden"
          style={{
            background: surfaceBg,
            border: '1px solid var(--surface-rule)',
          }}
        >
          {children}
        </div>
        {caption && (
          <div
            className="font-mono text-[10px] mt-4"
            style={{
              color: muted,
              letterSpacing: '0.08em',
              textAlign: isRtl ? 'left' : 'right',
            }}
          >
            {caption}
          </div>
        )}
      </div>
    </section>
  );
}
