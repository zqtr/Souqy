import Link from 'next/link';
import type { Locale } from '@/i18n/locales';
import type { Copy } from '@/content/copy';
import { palette } from '@/lib/tokens';
import { Reveal } from '@/components/motion/Reveal';
import { Eyebrow } from '@/components/primitives/Eyebrow';
import { MetalFrame } from '@/components/primitives/MetalFrame';

/**
 * Souqy paywall surface. Renders when a free-tier (or unauthenticated)
 * founder lands on `/begin/souqy`. Deliberately quiet — no countdown
 * timers, no scarcity copy. The fallback action is the regular `/begin`
 * flow, which is unchanged for free founders.
 *
 * The "Request access" CTA goes to the existing contact channel rather
 * than a Stripe Checkout link until billing is wired (Phase 0.5).
 * Replace `mailto:support@souqna.qa` with the Stripe / Vercel
 * Marketplace upgrade URL once provisioned.
 */
type Props = {
  locale: Locale;
  copy: Copy;
};

export function SouqyPaywall({ locale }: Props) {
  const isRtl = locale === 'ar';
  const fontFamily = isRtl
    ? 'var(--font-arabic), var(--font-sans)'
    : 'var(--font-sans)';
  const t = isRtl
    ? {
        eyebrow: 'سوقي · باقة مدفوعة',
        title: 'سوقي يبني المتجر — قريبًا متاح للجميع.',
        sub: 'استوديو ذكاء اصطناعي يكتب صفحاتك، نسخك، وصورك. متاح حاليًا للمؤسّسين في الإصدار التجريبي المغلق.',
        bullets: [
          'تصميم كامل بناءً على وصف موجز.',
          'مكوّنات قابلة للتعديل من لوحة التحكم لاحقًا.',
          'إعادة توجيه الذكاء بطلبات نصية: "اجعل البطل أغمق".',
        ],
        primary: 'اطلب وصولًا مبكرًا',
        secondary: 'العودة إلى الخيارات المجانية',
      }
    : {
        eyebrow: 'Souqy · paid tier',
        title: 'Souqy builds the store — opening up gradually.',
        sub: 'An AI atelier that writes your pages, your copy, your imagery. Currently in closed beta with founders we work with directly.',
        bullets: [
          'A full storefront from a short brief.',
          'Every section stays editable from the dashboard.',
          'Re-prompt with plain language: "Make the hero darker".',
        ],
        primary: 'Request early access',
        secondary: 'Back to the free options',
      };

  return (
    <section
      style={{
        padding:
          'clamp(72px, 12vw, 120px) clamp(20px, 4vw, 48px) clamp(80px, 14vw, 140px)',
        background: 'var(--surface-contrast)',
        color: 'var(--ink-on-contrast)',
        minHeight: '70vh',
        fontFamily,
        direction: isRtl ? 'rtl' : 'ltr',
      }}
    >
      <div
        className="mx-auto"
        style={{ maxWidth: 720, textAlign: isRtl ? 'right' : 'left' }}
      >
        <Reveal>
          <div className="flex" style={{ justifyContent: isRtl ? 'flex-end' : 'flex-start' }}>
            <Eyebrow tone="gold">{t.eyebrow}</Eyebrow>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h1
            className="text-balance"
            style={{
              fontFamily,
              fontWeight: isRtl ? 400 : 300,
              fontSize: 'clamp(36px, 5vw, 64px)',
              lineHeight: isRtl ? 1.18 : 1.04,
              letterSpacing: isRtl ? '-0.005em' : '-0.03em',
              color: 'var(--ink-on-contrast)',
              margin: '24px 0 18px',
            }}
          >
            {t.title}
          </h1>
        </Reveal>
        <Reveal delay={200}>
          <p
            style={{
              fontSize: 18,
              color: 'var(--ink-on-contrast-muted)',
              lineHeight: 1.6,
              maxWidth: 560,
              marginInlineEnd: isRtl ? 0 : 'auto',
            }}
          >
            {t.sub}
          </p>
        </Reveal>
        <Reveal delay={280}>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '36px 0 44px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {t.bullets.map((bullet) => (
              <li
                key={bullet}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 12,
                  fontSize: 15,
                  color: 'var(--ink-on-contrast-muted)',
                  lineHeight: 1.55,
                  flexDirection: isRtl ? 'row-reverse' : 'row',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    color: palette.gold,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                  }}
                >
                  ◈
                </span>
                <span style={{ flex: 1 }}>{bullet}</span>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={360}>
          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              flexDirection: isRtl ? 'row-reverse' : 'row',
            }}
          >
            <MetalFrame strength={0.7} borderRadius={999}>
              <a
                href="mailto:support@souqna.qa?subject=Souqy%20early%20access"
                style={{
                  background: palette.gold,
                  color: palette.ink,
                  padding: '14px 22px',
                  borderRadius: 999,
                  fontFamily,
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                {t.primary}
                <span aria-hidden style={{ transform: isRtl ? 'scaleX(-1)' : undefined }}>
                  →
                </span>
              </a>
            </MetalFrame>
            <Link
              href={locale === 'en' ? '/begin' : `/${locale}/begin`}
              style={{
                background: 'transparent',
                border: `1px solid ${palette.gold}66`,
                color: palette.gold,
                padding: '14px 22px',
                borderRadius: 999,
                fontFamily,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              {t.secondary}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
