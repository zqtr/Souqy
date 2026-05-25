import Link from 'next/link';
import { getCopy } from '@/content/copy';
import { palette } from '@/lib/tokens';
import { SouqnaLockup } from '@/components/primitives/SouqnaLockup';
import { env } from '@/lib/env';

/**
 * Shown when a {slug}.souqna.qa address has no live brief — either it
 * was never claimed, or it expired. Bilingual (en + ar columns) since
 * we don't know the locale of the visitor.
 */
export default function BriefNotFound() {
  const en = getCopy('en').brief.notFound;
  const ar = getCopy('ar').brief.notFound;

  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center"
      style={{
        background: 'var(--surface-contrast)',
        color: 'var(--ink-on-contrast)',
        padding: 'clamp(48px, 8vw, 120px) clamp(20px, 4vw, 48px)',
      }}
    >
      <Link
        href={env.NEXT_PUBLIC_SITE_URL}
        className="no-underline mb-12"
        style={{
          color: 'var(--ink-on-contrast)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <SouqnaLockup ariaLabel="Souqna" height={44} />
      </Link>

      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 max-w-3xl text-center"
        style={{ borderTop: `1px solid ${palette.gold}33`, paddingTop: 36 }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 300,
              fontSize: 'clamp(28px, 4vw, 44px)',
              lineHeight: 1.1,
              letterSpacing: '-0.025em',
              margin: '0 0 16px',
            }}
          >
            {en.title}
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 16,
              lineHeight: 1.6,
              color: 'var(--ink-on-contrast-muted)',
              margin: 0,
            }}
          >
            {en.body}
          </p>
        </div>
        <div dir="rtl">
          <h1
            style={{
              fontFamily: 'var(--font-arabic), var(--font-sans)',
              fontWeight: 400,
              fontSize: 'clamp(28px, 4vw, 44px)',
              lineHeight: 1.2,
              margin: '0 0 16px',
            }}
          >
            {ar.title}
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-arabic), var(--font-sans)',
              fontSize: 16,
              lineHeight: 1.7,
              color: 'var(--ink-on-contrast-muted)',
              margin: 0,
            }}
          >
            {ar.body}
          </p>
        </div>
      </div>

      <Link
        href={`${env.NEXT_PUBLIC_SITE_URL}/begin`}
        className="mt-12 no-underline"
        style={{
          background: palette.gold,
          color: 'var(--ink-on-gold)',
          padding: '14px 22px',
          borderRadius: 999,
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {en.cta} <span aria-hidden>◈</span>
      </Link>
    </main>
  );
}
