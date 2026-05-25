import { ImageResponse } from 'next/og';
import { isLocale, type Locale } from '@/i18n/locales';
import { getCopy } from '@/content/copy';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Souqna - bilingual commerce workspace';

const SAND = '#E8DCC4';
const INK = '#1F1B16';
const MAROON = '#8B3A3A';
const GOLD = '#C9A961';

type Props = { params: Promise<{ locale: string }> };

export default async function OG({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  const t = getCopy(locale);
  const isRtl = locale === 'ar';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: SAND,
          color: INK,
          padding: 72,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        {/* Trailing arch watermark */}
        <div
          style={{
            position: 'absolute',
            right: -40,
            top: 0,
            display: 'flex',
            opacity: 0.55,
            transform: isRtl ? 'scaleX(-1)' : 'none',
          }}
        >
          <svg width="540" height="630" viewBox="0 0 400 600">
            <path
              d="M 40 560 L 40 240 A 160 160 0 0 1 360 240 L 360 560"
              stroke={GOLD}
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M 90 560 L 90 270 A 110 110 0 0 1 310 270 L 310 560"
              stroke={GOLD}
              strokeWidth="1.5"
              fill="none"
              opacity="0.55"
            />
            <path
              d="M 140 560 L 140 300 A 60 60 0 0 1 260 300 L 260 560"
              stroke={GOLD}
              strokeWidth="1.5"
              fill="none"
              opacity="0.3"
            />
            <circle cx="200" cy="75" r="3" fill={GOLD} />
          </svg>
        </div>

        {/* Top: wordmark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: INK,
          }}
        >
          <svg width="32" height="32" viewBox="0 0 64 64">
            <path
              d="M 12 56 L 12 30 A 20 20 0 0 1 52 30 L 52 56"
              stroke={GOLD}
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="square"
            />
            <circle cx="32" cy="10" r="2" fill={GOLD} />
          </svg>
          <span>Souqna</span>
          <span style={{ width: 1, height: 24, background: GOLD, opacity: 0.55, display: 'flex' }} />
          <span style={{ fontWeight: 500 }}>سوقنا</span>
        </div>

        {/* Middle: headline */}
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 760 }}>
          <div
            style={{
              fontSize: 18,
              letterSpacing: '0.14em',
              color: MAROON,
              textTransform: 'uppercase',
              fontWeight: 600,
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <span style={{ width: 30, height: 1.5, background: MAROON, display: 'flex' }} />
            {t.meta.framingFull}
          </div>
          <div
            style={{
              fontSize: 86,
              fontWeight: 500,
              letterSpacing: '-0.045em',
              lineHeight: 0.95,
              color: INK,
              display: 'flex',
              flexWrap: 'wrap',
            }}
          >
            <span>{t.meta.titleSuffix}</span>
          </div>
          <div
            style={{
              fontSize: 28,
              color: 'rgba(31,27,22,0.62)',
              marginTop: 18,
              fontWeight: 400,
              maxWidth: 720,
            }}
          >
            {locale === 'ar' ? 'EST. DOHA — 2026' : 'EST. DOHA — 2026'}
          </div>
        </div>

        {/* Bottom rail */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 18,
            letterSpacing: '0.12em',
            color: 'rgba(31,27,22,0.65)',
            textTransform: 'uppercase',
            fontWeight: 500,
          }}
        >
          <span>SOUQNA.CO</span>
          <span>{t.meta.vision}</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
