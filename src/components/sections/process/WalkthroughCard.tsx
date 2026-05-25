import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/locales';
import { Reveal } from '@/components/motion/Reveal';
import { palette } from '@/lib/tokens';

type Props = {
  locale: Locale;
  index: number;
  roman: string;
  name: string;
  echoName: string;
  time: string;
  body: string;
  /** Pre-rendered MockFrame (or any visual) for this step. */
  visual: ReactNode;
  /** Slight delay so the four cards reveal in sequence. */
  delay?: number;
};

/**
 * One step card in the product walkthrough. Composition:
 *
 *   ┌──────────────────────────────────────┐
 *   │ I  Begin · بدء         BEGIN · 1 MIN │
 *   │ ──────────────────────────────────── │
 *   │ [ MockFrame: stylised intake form ]  │
 *   │ ──────────────────────────────────── │
 *   │ "We listen first. We sit with..."    │
 *   └──────────────────────────────────────┘
 *
 * The card has a sand body, a hairline maroon top border, and a roman
 * numeral that sits on the same baseline as the step name. The visual
 * is given a fixed aspect ratio inside MockFrame, which keeps cards in
 * the 2×2 grid uniform regardless of viewport width.
 */
export function WalkthroughCard({
  locale,
  index,
  roman,
  name,
  echoName,
  time,
  body,
  visual,
  delay = 0,
}: Props) {
  const isRtl = locale === 'ar';
  const fontFamily = isRtl
    ? 'var(--font-arabic), var(--font-sans)'
    : 'var(--font-sans)';
  const echoFontFamily = isRtl
    ? 'var(--font-sans)'
    : 'var(--font-arabic), var(--font-sans)';

  return (
    <Reveal delay={delay}>
      <article
        className="souqna-walkthrough-card"
        style={{
          position: 'relative',
          background: 'rgba(232,220,196,0.05)',
          border: `1px solid ${palette.gold}22`,
          borderRadius: 18,
          padding: 'clamp(20px, 2.6vw, 32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          height: '100%',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 16,
            flexDirection: isRtl ? 'row-reverse' : 'row',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 14,
              flexDirection: isRtl ? 'row-reverse' : 'row',
              minWidth: 0,
            }}
          >
            <span
              aria-hidden
              style={{
                fontFamily: 'var(--font-serif), serif',
                fontStyle: 'italic',
                fontSize: 'clamp(28px, 3.4vw, 44px)',
                color: palette.gold,
                lineHeight: 1,
                letterSpacing: 0,
                flex: '0 0 auto',
              }}
            >
              {roman}
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                flexWrap: 'wrap',
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontFamily,
                  fontSize: 'clamp(20px, 2.2vw, 26px)',
                  fontWeight: 400,
                  letterSpacing: isRtl ? 0 : '-0.025em',
                  color: 'var(--ink-on-contrast)',
                }}
              >
                {name}
              </span>
              <span
                dir={isRtl ? 'ltr' : 'rtl'}
                style={{
                  fontFamily: echoFontFamily,
                  fontSize: 'clamp(14px, 1.4vw, 17px)',
                  color: 'var(--ink-on-contrast-muted)',
                }}
              >
                {echoName}
              </span>
            </div>
          </div>
          <span
            className="souqna-walkthrough-time"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              color: 'var(--ink-on-contrast-muted)',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              flex: '0 0 auto',
            }}
          >
            <span aria-hidden style={{ marginInlineEnd: 6, color: palette.maroon }}>
              ◈
            </span>
            {String(index + 1).padStart(2, '0')} · {time}
          </span>
        </header>

        <span
          aria-hidden
          style={{
            display: 'block',
            height: 1,
            background: `linear-gradient(${isRtl ? '270deg' : '90deg'}, ${palette.gold}55, transparent)`,
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {visual}

          <p
            style={{
              margin: 0,
              fontFamily,
              fontSize: 14,
              lineHeight: isRtl ? 1.7 : 1.55,
              color: 'var(--ink-on-contrast)',
              letterSpacing: isRtl ? 0 : '-0.005em',
            }}
          >
            {body}
          </p>
        </div>
      </article>
    </Reveal>
  );
}
