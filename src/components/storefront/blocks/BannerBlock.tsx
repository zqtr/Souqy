import type { BlockRenderProps } from './BlockContext';
import type { BannerProps } from '@/lib/blocks/types';
import { VariantFrame } from './VariantFrame';

/**
 * Full-width banner with optional overlay text and CTA. The scrim sits
 * between the image and the overlay so text stays readable on busy art.
 */
export function BannerBlock({ block, ctx }: BlockRenderProps<BannerProps>) {
  const props = block.props;
  const { isRtl } = ctx;
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const serifFamily = isRtl ? 'var(--font-arabic-serif), serif' : 'var(--font-serif), serif';
  const imageUrl = props.imageUrl?.trim() ?? '';
  if (!imageUrl && !props.overlayTitle && !props.overlaySubtitle && !props.cta) return null;
  const align = props.align ?? 'center';
  const scrim = props.scrim ?? 'soft';
  const scrimAlpha = scrim === 'strong' ? 0.5 : scrim === 'soft' ? 0.28 : 0;
  const hasImage = imageUrl.length > 0;

  return (
    <VariantFrame variant={block.style?.variant}>
      <section
        style={{
          position: 'relative',
          minHeight: 'clamp(200px, 32vh, 360px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent:
            align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center',
          background: hasImage
            ? undefined
            : 'linear-gradient(135deg, color-mix(in srgb, var(--sf-accent) 10%, transparent), color-mix(in srgb, var(--sf-ink) 6%, transparent))',
          backgroundImage: hasImage
            ? `linear-gradient(rgba(0,0,0,${scrimAlpha}), rgba(0,0,0,${scrimAlpha})), url(${imageUrl})`
            : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: hasImage ? '#fff' : 'var(--sf-ink)',
          padding: 'clamp(28px, 5vw, 56px)',
          textAlign: align === 'start' ? 'left' : align === 'end' ? 'right' : 'center',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 1px 0 color-mix(in srgb, var(--sf-ink) 8%, transparent) inset',
        }}
        role={props.alt ? 'img' : undefined}
        aria-label={props.alt}
      >
        <div style={{ maxWidth: 720 }}>
          {props.overlayTitle ? (
            <h2
              style={{
                fontFamily: serifFamily,
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 'clamp(28px, 5vw, 56px)',
                lineHeight: 1.05,
                margin: 0,
              }}
            >
              {props.overlayTitle}
            </h2>
          ) : null}
          {props.overlaySubtitle ? (
            <p
              style={{
                fontFamily,
                fontSize: 'clamp(14px, 1.6vw, 18px)',
                lineHeight: 1.5,
                margin: '14px 0 0',
                opacity: 0.92,
              }}
            >
              {props.overlaySubtitle}
            </p>
          ) : null}
          {props.cta ? (
            <a
              href={props.cta.scrollTo ? `#b-${props.cta.scrollTo}` : props.cta.href}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 22px',
                marginTop: 24,
                borderRadius: 999,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                background: 'rgba(255,255,255,0.95)',
                color: '#1F1B16',
                textDecoration: 'none',
              }}
            >
              <span aria-hidden>→</span>
              {props.cta.label}
            </a>
          ) : null}
        </div>
      </section>
    </VariantFrame>
  );
}
