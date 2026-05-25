import type { BlockRenderProps } from './BlockContext';
import type { HeroProps } from '@/lib/blocks/types';
import { StorefrontGlyph } from '@/lib/storefront-glyphs';
import { LogoOrMonogram } from '../StorefrontChrome';
import { VariantFrame } from './VariantFrame';
import { TextEffectRenderer } from './TextEffectRenderer';

/**
 * Hero block. Three layouts:
 *   - centered : Atrium-style (monogram + glyph + verb + name + tagline + founder)
 *   - inline   : list-led pages (logo row + name + tagline)
 *   - banner   : full-bleed background image with overlaid name + tagline
 *
 * Falls back gracefully when optional props (eyebrow, glyph toggle, founder
 * toggle) are absent — the seeded blocks fill the most common defaults.
 */
export function HeroBlock({ block, ctx }: BlockRenderProps<HeroProps>) {
  const { storefront, vocabulary, isRtl } = ctx;
  const props = block.props;
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const serifFamily = isRtl ? 'var(--font-arabic-serif), serif' : 'var(--font-serif), serif';

  const eyebrow = props.eyebrow ?? vocabulary.heroVerb;
  const logoMode = props.logoMode ?? (props.showLogo === false ? 'hide' : 'default');
  const glyphMode = props.glyphMode ?? (props.showGlyph === false ? 'hide' : 'default');
  const showFounder = props.showFounder ?? props.layout === 'centered';

  const logoNode =
    logoMode === 'hide' || (logoMode === 'custom' && !props.logoUrl) ? null : (
      <LogoOrMonogram
        storefront={storefront}
        size={props.layout === 'inline' ? 64 : 108}
        overrideUrl={logoMode === 'custom' ? props.logoUrl : undefined}
      />
    );

  function renderGlyph(size: number) {
    if (glyphMode === 'hide') return null;
    if (glyphMode === 'custom' && props.glyphUrl) {
      return (
        <img
          src={props.glyphUrl}
          alt=""
          aria-hidden="true"
          width={size}
          height={size}
          style={{ width: size, height: size, objectFit: 'contain', opacity: 0.85 }}
        />
      );
    }
    if (glyphMode === 'custom' && props.glyphText) {
      return (
        <span
          aria-hidden="true"
          style={{
            fontFamily: serifFamily,
            fontStyle: 'italic',
            fontSize: size,
            lineHeight: 1,
            color: 'var(--sf-accent)',
            opacity: 0.9,
            letterSpacing: '0.02em',
          }}
        >
          {props.glyphText.slice(0, 4)}
        </span>
      );
    }
    return <StorefrontGlyph type={storefront.businessType} size={size} />;
  }

  const variant = block.style?.variant;

  if (props.layout === 'banner' && (props.backgroundCss || props.backgroundUrl)) {
    // CSS pattern wins over a stale uploaded image: founders who pick a
    // pattern explicitly clear `backgroundUrl` from the inspector, but
    // the guard here ensures any bypass still ends up with a single
    // background source. We don't apply the dimming scrim when a
    // pattern is active — patterns already carry their own contrast and
    // an extra rgba overlay washes them out.
    const usePattern = Boolean(props.backgroundCss);
    const bannerBg: React.CSSProperties = usePattern
      ? {
          background: props.backgroundCss,
          ...(props.backgroundCssSize ? { backgroundSize: props.backgroundCssSize } : {}),
        }
      : {
          backgroundImage: `linear-gradient(rgba(0,0,0,0.32), rgba(0,0,0,0.32)), url(${props.backgroundUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        };
    return (
      <VariantFrame variant={variant}>
      <header
        className="flex flex-col items-center justify-center text-center"
        style={{
          minHeight: 'clamp(360px, 60vh, 560px)',
          padding: 'clamp(48px, 8vw, 96px) clamp(20px, 5vw, 64px)',
          color: usePattern ? 'var(--sf-ink)' : '#fff',
          ...bannerBg,
        }}
      >
        {eyebrow ? (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              opacity: 0.85,
              marginBottom: 18,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <TextEffectRenderer
          as="h1"
          effect={block.style?.textEffect}
          style={{
            fontFamily: serifFamily,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(40px, 8vw, 96px)',
            lineHeight: isRtl ? 1.18 : 1,
            margin: 0,
            maxWidth: 980,
          }}
        >
          {props.title}
        </TextEffectRenderer>
        {props.tagline ? (
          <p
            style={{
              fontFamily,
              fontSize: 'clamp(16px, 1.8vw, 20px)',
              lineHeight: 1.5,
              maxWidth: 640,
              margin: '24px auto 0',
              opacity: 0.92,
            }}
          >
            {props.tagline}
          </p>
        ) : null}
        {props.cta ? <CtaButton {...props.cta} variant="primary" /> : null}
      </header>
      </VariantFrame>
    );
  }

  if (props.layout === 'inline') {
    return (
      <VariantFrame variant={variant}>
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
          {logoNode}
          {glyphMode === 'hide' ? null : (
            <div
              aria-hidden="true"
              style={{
                color: 'var(--sf-accent)',
                opacity: 0.85,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {renderGlyph(32)}
            </div>
          )}
          {eyebrow ? (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--sf-accent)',
              }}
            >
              {eyebrow}
            </div>
          ) : null}
        </div>
        <TextEffectRenderer
          as="h1"
          effect={block.style?.textEffect}
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
          {props.title}
        </TextEffectRenderer>
        {props.tagline ? (
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
            {props.tagline}
          </p>
        ) : null}
        {props.cta ? <CtaButton {...props.cta} variant="ghost" /> : null}
      </header>
      </VariantFrame>
    );
  }

  return (
    <VariantFrame variant={variant}>
    <header
      className="flex flex-col items-center text-center"
      style={{
        paddingTop: 'clamp(40px, 7vw, 80px)',
        paddingBottom: 'clamp(40px, 7vw, 80px)',
      }}
    >
      {logoNode}
      {glyphMode === 'hide' ? null : (
        <div
          aria-hidden="true"
          style={{
            marginTop: 32,
            color: 'var(--sf-accent)',
            opacity: 0.85,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {renderGlyph(44)}
        </div>
      )}
      {eyebrow ? (
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
          {eyebrow}
        </div>
      ) : null}
      <TextEffectRenderer
        as="h1"
        effect={block.style?.textEffect}
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
        {props.title}
      </TextEffectRenderer>
      {props.tagline ? (
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
          {props.tagline}
        </p>
      ) : null}
      {showFounder ? (
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
          <span style={{ color: 'var(--sf-ink)' }}>{storefront.founderName}</span>
        </div>
      ) : null}
      {props.cta ? <CtaButton {...props.cta} variant="ghost" /> : null}
    </header>
    </VariantFrame>
  );
}

function CtaButton({
  label,
  href,
  scrollTo,
  variant,
}: {
  label: string;
  href: string;
  scrollTo?: string;
  variant: 'primary' | 'ghost';
}) {
  // `scrollTo` wins over the raw href: render an in-page anchor that the
  // browser smooth-scrolls to via `html { scroll-behavior: smooth }`.
  const target = scrollTo ? `#b-${scrollTo}` : href;
  return (
    <a
      href={target}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 22px',
        marginTop: 28,
        textDecoration: 'none',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        borderRadius: 999,
        background: variant === 'primary' ? 'var(--sf-accent)' : 'transparent',
        color: variant === 'primary' ? 'var(--sf-ground)' : 'var(--sf-ink)',
        border: `1px solid color-mix(in srgb, var(--sf-accent) 60%, transparent)`,
      }}
    >
      <span aria-hidden>→</span>
      {label}
    </a>
  );
}
