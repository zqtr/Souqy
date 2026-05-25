import { StorefrontGlyph } from '@/lib/storefront-glyphs';
import type { Storefront } from '@/lib/brief';
import type { getVocabulary } from '@/lib/storefront-vocabulary';
import { LogoOrMonogram } from './StorefrontChrome';

type Props = {
  data: Storefront;
  vocabulary: ReturnType<typeof getVocabulary>;
  variant?: 'centered' | 'inline';
};

/**
 * Shared hero block for every archetype template. Centered variant is used
 * by Menu / CatalogGrid / Calendar / Generic; inline variant is used by
 * Lookbook / Portfolio / ServiceList where the products are the headline.
 */
export function StorefrontHero({ data, vocabulary, variant = 'centered' }: Props) {
  const isRtl = data.locale === 'ar';
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const serifFamily = isRtl ? 'var(--font-arabic-serif), serif' : 'var(--font-serif), serif';

  if (variant === 'inline') {
    return (
      <header
        className="flex flex-col gap-5"
        style={{
          paddingTop: 'clamp(24px, 5vw, 56px)',
          paddingBottom: 'clamp(24px, 4vw, 48px)',
        }}
      >
        <div
          className="flex items-center gap-4"
          style={{ flexWrap: 'wrap', flexDirection: isRtl ? 'row-reverse' : 'row' }}
        >
          <LogoOrMonogram storefront={data} size={64} />
          <div aria-hidden="true" style={{ color: 'var(--sf-accent)', opacity: 0.85 }}>
            <StorefrontGlyph type={data.businessType} size={32} />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--sf-accent)',
            }}
          >
            {vocabulary.heroVerb}
          </div>
        </div>
        <h1
          className="text-balance"
          style={{
            fontFamily: serifFamily,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(40px, 7vw, 88px)',
            lineHeight: isRtl ? 1.18 : 0.98,
            letterSpacing: isRtl ? '-0.005em' : '-0.03em',
            margin: 0,
          }}
        >
          {data.businessName}
        </h1>
        {data.tagline ? (
          <p
            className="text-balance"
            style={{
              fontFamily,
              fontWeight: 300,
              fontSize: 'clamp(16px, 1.8vw, 20px)',
              lineHeight: 1.5,
              margin: 0,
              maxWidth: 640,
              color: 'color-mix(in srgb, var(--sf-ink) 80%, transparent)',
            }}
          >
            {data.tagline}
          </p>
        ) : null}
      </header>
    );
  }

  return (
    <header
      className="flex flex-col items-center text-center"
      style={{
        paddingTop: 'clamp(40px, 7vw, 80px)',
        paddingBottom: 'clamp(40px, 7vw, 80px)',
      }}
    >
      <LogoOrMonogram storefront={data} size={108} />
      <div aria-hidden="true" style={{ marginTop: 32, color: 'var(--sf-accent)', opacity: 0.85 }}>
        <StorefrontGlyph type={data.businessType} size={44} />
      </div>
      <div
        style={{
          marginTop: 18,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--sf-accent)',
        }}
      >
        {vocabulary.heroVerb}
      </div>
      <h1
        className="text-balance"
        style={{
          fontFamily: serifFamily,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 'clamp(48px, 9vw, 132px)',
          lineHeight: isRtl ? 1.18 : 0.96,
          letterSpacing: isRtl ? '-0.005em' : '-0.035em',
          margin: '18px 0 0',
          maxWidth: 980,
        }}
      >
        {data.businessName}
      </h1>
      {data.tagline ? (
        <p
          className="text-balance"
          style={{
            fontFamily,
            fontWeight: 300,
            fontSize: 'clamp(18px, 2.2vw, 24px)',
            lineHeight: 1.45,
            margin: '32px auto 0',
            maxWidth: 720,
            color: 'color-mix(in srgb, var(--sf-ink) 80%, transparent)',
          }}
        >
          {data.tagline}
        </p>
      ) : null}
      <div
        style={{
          marginTop: 36,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.08em',
          color: 'color-mix(in srgb, var(--sf-ink) 50%, transparent)',
        }}
      >
        {isRtl ? 'بحضور' : 'Hosted by'}{' '}
        <span style={{ color: 'var(--sf-ink)' }}>{data.founderName}</span>
      </div>
    </header>
  );
}
