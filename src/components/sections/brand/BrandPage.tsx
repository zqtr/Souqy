import type { Locale } from '@/i18n/locales';
import type { Copy } from '@/content/copy';
import { SouqnaLockup } from '@/components/primitives/SouqnaLockup';
import { ArchMark } from '@/components/primitives/ArchMark';
import { Eyebrow } from '@/components/primitives/Eyebrow';
import { palette } from '@/lib/tokens';
import { BrandSection } from './BrandSection';

type Props = {
  locale: Locale;
  copy: Copy;
};

const SWATCHES = [
  { name: 'Sand', ar: 'رمل', hex: '#E8DCC4', role: 'Primary surface', text: '#1F1B16' },
  { name: 'Maroon', ar: 'عنابي', hex: '#8B3A3A', role: 'Accent · identity', text: '#F1E9D7' },
  { name: 'Antique Gold', ar: 'ذهبي عتيق', hex: '#C9A961', role: 'Accent · CTA only', text: '#1F1B16' },
  { name: 'Silver', ar: 'فضي', hex: '#C5C5C5', role: 'Tech signal · sparingly', text: '#1F1B16' },
  { name: 'Charcoal', ar: 'فحمي', hex: '#2A2A2A', role: 'Typography surface', text: '#F1E9D7' },
] as const;

export function BrandPage({ locale, copy }: Props) {
  const isRtl = locale === 'ar';
  const sections = copy.brand.sections;
  const captions = copy.brand.captions;

  return (
    <>
      {/* Hero strip */}
      <section
        className="bg-[color:var(--surface-bg)] text-[color:var(--ink-strong)]"
        style={{ padding: '160px clamp(24px, 4vw, 48px) 80px' }}
      >
        <div className="mx-auto" style={{ maxWidth: 1400 }}>
          <Eyebrow tone="maroon">{copy.brand.eyebrow}</Eyebrow>
          <h1
            className="m-0 mt-6 text-balance"
            style={{
              fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
              fontWeight: isRtl ? 400 : 300,
              fontSize: 'clamp(40px, 5.6vw, 88px)',
              lineHeight: isRtl ? 1.2 : 0.95,
              letterSpacing: isRtl ? '-0.005em' : '-0.04em',
            }}
          >
            {copy.brand.title}
          </h1>
          <p
            className="mt-8 max-w-[60ch]"
            style={{
              fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
              fontSize: 16,
              lineHeight: isRtl ? 1.7 : 1.55,
              color: 'var(--ink-muted)',
            }}
          >
            {copy.brand.sub}
          </p>
        </div>
      </section>

      {/* 01 · Logo on three substrates */}
      <BrandSection
        locale={locale}
        label={sections.logo.label}
        title={sections.logo.title}
        lede={sections.logo.lede}
      >
        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 0 }}>
          {[
            { bg: palette.sand, fg: palette.ink, label: captions.onSand },
            { bg: palette.maroon, fg: palette.sandPale, label: captions.onMaroon },
            { bg: palette.charcoal, fg: palette.sandPale, label: captions.onCharcoal },
          ].map((cell) => (
            <div
              key={cell.label}
              className="flex flex-col"
              style={{
                background: cell.bg,
                color: cell.fg,
                padding: 28,
                aspectRatio: '4 / 3',
                borderRight: '1px solid rgba(31,27,22,0.08)',
              }}
            >
              <div
                className="font-mono text-[10px] flex justify-between"
                style={{ color: cell.fg, opacity: 0.5, letterSpacing: '0.12em' }}
              >
                <span>— logo · primary</span>
                <span>{cell.label}</span>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <SouqnaLockup ariaLabel="Souqna" height={56} />
              </div>
              <div
                className="font-mono text-[10px] flex justify-between"
                style={{ color: cell.fg, opacity: 0.5, letterSpacing: '0.1em' }}
              >
                <span>MIN 120PX</span>
                <span>BUILT IN DOHA, FOR DOHA</span>
              </div>
            </div>
          ))}
        </div>
      </BrandSection>

      {/* 02 · Mark — geometry + scale */}
      <BrandSection
        locale={locale}
        label={sections.mark.label}
        title={sections.mark.title}
        lede={sections.mark.lede}
        caption={captions.geometry}
      >
        <div className="grid md:grid-cols-2" style={{ gap: 0 }}>
          <div
            className="p-8 border-b md:border-b-0 md:border-r"
            style={{ borderColor: 'rgba(31,27,22,0.08)' }}
          >
            <div
              className="font-mono text-[10px] mb-4"
              style={{
                color: 'rgba(31,27,22,0.5)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              — mark · geometry
            </div>
            <svg viewBox="0 0 400 380" width="100%" style={{ display: 'block' }}>
              {Array.from({ length: 13 }).map((_, i) => (
                <line
                  key={`v${i}`}
                  x1={40 + i * 25}
                  y1="20"
                  x2={40 + i * 25}
                  y2="360"
                  stroke="rgba(31,27,22,0.09)"
                  strokeWidth="0.5"
                />
              ))}
              {Array.from({ length: 15 }).map((_, i) => (
                <line
                  key={`h${i}`}
                  x1="40"
                  y1={20 + i * 25}
                  x2="360"
                  y2={20 + i * 25}
                  stroke="rgba(31,27,22,0.09)"
                  strokeWidth="0.5"
                />
              ))}
              <path
                d="M 80 340 L 80 180 A 120 120 0 0 1 320 180 L 320 340"
                stroke={palette.gold}
                strokeWidth="2"
                fill="none"
                strokeLinecap="square"
              />
              <path
                d="M 130 340 L 130 200 A 70 70 0 0 1 270 200 L 270 340"
                stroke={palette.gold}
                strokeWidth="1.5"
                fill="none"
                opacity="0.55"
                strokeLinecap="square"
              />
              <circle cx="200" cy="60" r="4" fill={palette.gold} />
              <line
                x1="200"
                y1="60"
                x2="200"
                y2="180"
                stroke={palette.maroon}
                strokeDasharray="2,3"
                strokeWidth="0.8"
              />
              <text
                x="208"
                y="120"
                fontFamily="var(--font-mono)"
                fontSize="9"
                fill={palette.maroon}
                opacity="0.7"
              >
                R = 2u
              </text>
              <line
                x1="80"
                y1="340"
                x2="320"
                y2="340"
                stroke={palette.maroon}
                strokeDasharray="2,3"
                strokeWidth="0.8"
              />
              <text
                x="170"
                y="355"
                fontFamily="var(--font-mono)"
                fontSize="9"
                fill={palette.maroon}
                opacity="0.7"
              >
                W = 4u
              </text>
              <text
                x="40"
                y="14"
                fontFamily="var(--font-mono)"
                fontSize="9"
                fill="rgba(31,27,22,0.4)"
              >
                UNIT · 25PX
              </text>
            </svg>
          </div>
          <div className="p-8">
            <div
              className="font-mono text-[10px] mb-6"
              style={{
                color: 'rgba(31,27,22,0.5)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              — mark · family
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { bg: palette.sand, stroke: palette.gold, label: 'ON SAND' },
                { bg: palette.maroon, stroke: palette.silverPale, label: 'ON MAROON' },
                { bg: palette.charcoal, stroke: palette.gold, label: 'ON CHARCOAL' },
                { bg: palette.gold, stroke: palette.ink, label: 'ON GOLD' },
              ].map((v) => (
                <div
                  key={v.label}
                  className="flex flex-col items-center justify-center gap-2"
                  style={{ background: v.bg, padding: '28px 12px', aspectRatio: '1 / 1' }}
                >
                  <ArchMark size={48} stroke={v.stroke} />
                  <span
                    className="font-mono text-[9px]"
                    style={{
                      color: v.stroke,
                      opacity: 0.7,
                      letterSpacing: '0.1em',
                    }}
                  >
                    {v.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </BrandSection>

      {/* 03 · Palette */}
      <BrandSection
        locale={locale}
        label={sections.color.label}
        title={sections.color.title}
        lede={sections.color.lede}
        caption={captions.palette}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5" style={{ gap: 0 }}>
          {SWATCHES.map((s, i) => (
            <div
              key={s.hex}
              className="flex flex-col justify-between"
              style={{
                background: s.hex,
                color: s.text,
                padding: 24,
                minHeight: 240,
                borderRight: i === SWATCHES.length - 1 ? undefined : '1px solid rgba(0,0,0,0.04)',
              }}
            >
              <div className="flex justify-between font-mono text-[10px]" style={{ opacity: 0.7, letterSpacing: '0.05em' }}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                <span>{s.hex.toUpperCase()}</span>
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 26,
                    fontWeight: 400,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.05,
                  }}
                >
                  {s.name}
                </div>
                <div
                  dir="rtl"
                  style={{
                    fontFamily: 'var(--font-arabic), var(--font-sans)',
                    fontSize: 16,
                    opacity: 0.65,
                    marginTop: 2,
                  }}
                >
                  {s.ar}
                </div>
                <div
                  className="font-mono text-[11px]"
                  style={{ opacity: 0.65, marginTop: 14, letterSpacing: '0.02em' }}
                >
                  {s.role}
                </div>
              </div>
            </div>
          ))}
        </div>
      </BrandSection>

      {/* 04 · Typography */}
      <BrandSection
        locale={locale}
        label={sections.type.label}
        title={sections.type.title}
        lede={sections.type.lede}
        caption={captions.typePairing}
      >
        <div className="grid md:grid-cols-2" style={{ gap: 0 }}>
          <div
            className="p-8 md:p-10"
            style={{ borderRight: '1px solid rgba(31,27,22,0.08)' }}
          >
            <div
              className="font-mono text-[10px] mb-6"
              style={{ color: palette.maroon, letterSpacing: '0.1em' }}
            >
              EN · DISPLAY
            </div>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 400,
                fontSize: 'clamp(48px, 6vw, 92px)',
                letterSpacing: '-0.045em',
                lineHeight: 0.9,
                color: palette.ink,
              }}
            >
              From idea
              <br />
              to{' '}
              <span
                style={{
                  fontFamily: 'var(--font-serif), serif',
                  fontStyle: 'italic',
                  color: palette.maroon,
                }}
              >
                real
              </span>
              .
            </div>
            <p
              className="mt-6 max-w-[420px]"
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                color: 'rgba(31,27,22,0.55)',
                letterSpacing: '-0.005em',
                lineHeight: 1.45,
              }}
            >
              Body at 14–16px. A high-contrast sans for ninety percent of the page; a serif italic
              used only for emphasis and pull-quotes — never both at once.
            </p>
            <div
              className="font-mono text-[11px] mt-8 flex flex-wrap gap-4"
              style={{ color: 'rgba(31,27,22,0.55)', letterSpacing: '0.02em' }}
            >
              <span>Aa Bb Cc 123</span>
              <span>— 300 / 400 / 500</span>
              <span style={{ color: palette.gold }}>MONO 11PX · UI META</span>
            </div>
          </div>
          <div dir="rtl" className="p-8 md:p-10">
            <div
              dir="ltr"
              className="font-mono text-[10px] mb-6 text-right"
              style={{ color: palette.maroon, letterSpacing: '0.1em' }}
            >
              AR · العربية
            </div>
            <div
              style={{
                fontFamily: 'var(--font-arabic), var(--font-sans)',
                fontWeight: 500,
                fontSize: 'clamp(40px, 5.4vw, 84px)',
                lineHeight: 1.05,
                color: palette.ink,
              }}
            >
              مِن فكرة
              <br />
              إلى{' '}
              <span
                style={{
                  fontFamily: 'var(--font-arabic-serif), serif',
                  fontStyle: 'italic',
                  color: palette.maroon,
                }}
              >
                حقيقة
              </span>
              .
            </div>
            <p
              className="mt-6 max-w-[420px]"
              style={{
                fontFamily: 'var(--font-arabic), var(--font-sans)',
                fontSize: 16,
                color: 'rgba(31,27,22,0.6)',
                lineHeight: 1.7,
                fontWeight: 300,
              }}
            >
              النص العربي بنفس الكرامة البصرية. خط كوفي معاصر للعناوين والنص، وأميري للتأكيد
              والاقتباسات.
            </p>
            <div
              className="mt-8 flex flex-wrap gap-4"
              style={{
                fontFamily: 'var(--font-arabic), var(--font-sans)',
                fontSize: 20,
                color: 'rgba(31,27,22,0.6)',
              }}
            >
              <span>أ ب ت ث ج ح خ</span>
              <span>١٢٣٤٥٦</span>
            </div>
          </div>
        </div>
      </BrandSection>

      {/* 05 · Stationery */}
      <BrandSection
        locale={locale}
        label={sections.stationery.label}
        title={sections.stationery.title}
        lede={sections.stationery.lede}
        caption={captions.businessCard}
      >
        <div className="grid md:grid-cols-2 gap-0">
          {/* Front of business card on maroon */}
          <div
            className="relative p-8"
            style={{
              background: palette.maroon,
              minHeight: 320,
              borderRight: '1px solid rgba(31,27,22,0.08)',
            }}
          >
            <svg viewBox="0 0 440 284" width="100%" height="100%" style={{ position: 'absolute', inset: 0, padding: 32 }} preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="foilA" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#E8E8E8" />
                  <stop offset="0.5" stopColor="#B8B8B8" />
                  <stop offset="1" stopColor="#D8D8D8" />
                </linearGradient>
              </defs>
              <path
                d="M 40 260 L 40 120 A 80 80 0 0 1 200 120 L 200 260"
                stroke="url(#foilA)"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="square"
              />
              <path
                d="M 80 260 L 80 140 A 40 40 0 0 1 160 140 L 160 260"
                stroke="url(#foilA)"
                strokeWidth="1"
                fill="none"
                opacity="0.7"
                strokeLinecap="square"
              />
              <circle cx="120" cy="36" r="2.5" fill="url(#foilA)" />
            </svg>
            <div className="relative text-right" style={{ color: '#E8E8E8' }}>
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  fontSize: 24,
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}
              >
                Souqna
              </div>
              <div
                dir="rtl"
                style={{
                  fontFamily: 'var(--font-arabic), var(--font-sans)',
                  fontSize: 22,
                  color: '#D0D0D0',
                  marginTop: 6,
                }}
              >
                سوقنا
              </div>
            </div>
            <div
              className="absolute font-mono text-[9px] text-right"
              style={{ bottom: 28, right: 32, color: '#C5C5C5', letterSpacing: '0.1em' }}
            >
              <div>BUILT IN DOHA, FOR DOHA</div>
              <div className="mt-1">صُنع في الدوحة، للدوحة</div>
            </div>
          </div>

          {/* Compliments slip on charcoal */}
          <div
            className="relative p-8"
            style={{ background: palette.charcoal, color: palette.sandPale, minHeight: 320 }}
          >
            <div
              className="font-mono text-[10px]"
              style={{ color: palette.gold, letterSpacing: '0.1em' }}
            >
              — with compliments
            </div>
            <div
              className="mt-4"
              style={{
                fontFamily: 'var(--font-serif), serif',
                fontStyle: 'italic',
                fontSize: 'clamp(28px, 3.6vw, 40px)',
                lineHeight: 1.1,
                letterSpacing: '-0.01em',
                color: palette.sandPale,
              }}
            >
              Welcome to the atelier.
            </div>
            <div
              dir="rtl"
              className="mt-2"
              style={{
                fontFamily: 'var(--font-arabic-serif), serif',
                fontStyle: 'italic',
                fontSize: 22,
                color: 'rgba(232,220,196,0.75)',
              }}
            >
              أهلاً بكم في المرسم.
            </div>
            <div className="absolute" style={{ bottom: 24, right: 24 }}>
              <ArchMark size={32} stroke={palette.gold} />
            </div>
          </div>
        </div>
      </BrandSection>

      {/* 06 · Open graph */}
      <BrandSection
        locale={locale}
        label={sections.og.label}
        title={sections.og.title}
        lede={sections.og.lede}
        caption={captions.openGraph}
      >
        <div
          className="relative overflow-hidden"
          style={{
            background: palette.sand,
            color: palette.ink,
            padding: 'clamp(32px, 5vw, 72px)',
            aspectRatio: '1200 / 630',
          }}
        >
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{ right: -40, top: 20, width: '40%', height: '90%', opacity: 0.55 }}
          >
            <svg viewBox="0 0 400 600" width="100%" height="100%">
              <path
                d="M 40 560 L 40 240 A 160 160 0 0 1 360 240 L 360 560"
                stroke={palette.gold}
                strokeWidth="1"
                fill="none"
              />
              <path
                d="M 90 560 L 90 270 A 110 110 0 0 1 310 270 L 310 560"
                stroke={palette.gold}
                strokeWidth="1"
                fill="none"
                opacity="0.55"
              />
              <path
                d="M 140 560 L 140 300 A 60 60 0 0 1 260 300 L 260 560"
                stroke={palette.gold}
                strokeWidth="1"
                fill="none"
                opacity="0.3"
              />
              <circle cx="200" cy="75" r="3" fill={palette.gold} />
            </svg>
          </div>
          <div className="relative h-full flex flex-col justify-between">
            <SouqnaLockup ariaLabel="Souqna" height={36} />
            <div style={{ maxWidth: '70%' }}>
              <div
                className="font-mono text-[11px] flex items-center gap-2.5 mb-4"
                style={{
                  color: palette.maroon,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                <span style={{ width: 22, height: 1, background: palette.maroon }} />
                BUILT IN DOHA, FOR DOHA
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 400,
                  fontSize: 'clamp(40px, 6vw, 84px)',
                  lineHeight: 0.95,
                  letterSpacing: '-0.045em',
                  color: palette.ink,
                }}
              >
                From idea to{' '}
                <span
                  style={{
                    fontFamily: 'var(--font-serif), serif',
                    fontStyle: 'italic',
                    color: palette.maroon,
                  }}
                >
                  real
                </span>
                .
              </div>
              <div
                dir="rtl"
                className="mt-3"
                style={{
                  fontFamily: 'var(--font-arabic), var(--font-sans)',
                  fontSize: 'clamp(18px, 2.2vw, 26px)',
                  color: 'rgba(31,27,22,0.6)',
                  fontWeight: 300,
                }}
              >
                من فكرة إلى{' '}
                <span
                  style={{
                    fontFamily: 'var(--font-arabic-serif), serif',
                    fontStyle: 'italic',
                    color: palette.maroon,
                  }}
                >
                  مشروع حقيقي
                </span>
                .
              </div>
            </div>
            <div
              className="font-mono text-[11px] flex justify-between"
              style={{ color: 'rgba(31,27,22,0.6)', letterSpacing: '0.1em' }}
            >
              <span>SOUQNA.CO</span>
              <span>Qatar National Vision 2030 · aligned</span>
            </div>
          </div>
        </div>
      </BrandSection>
    </>
  );
}
