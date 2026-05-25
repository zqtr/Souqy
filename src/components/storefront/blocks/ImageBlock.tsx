import type { BlockRenderProps } from './BlockContext';
import type { ImageProps as ImageBlockProps } from '@/lib/blocks/types';

const widths: Record<NonNullable<ImageBlockProps['width']>, number | string> = {
  narrow: 640,
  wide: 960,
  full: '100%',
};

/**
 * Single image with optional caption. Aspect ratio is enforced via CSS so
 * the layout stays stable while the asset loads.
 */
export function ImageBlock({ block, ctx }: BlockRenderProps<ImageBlockProps>) {
  const { isRtl } = ctx;
  const props = block.props;
  const imageUrl = props.imageUrl?.trim();
  if (!imageUrl) return null;
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const maxWidth = widths[props.width ?? 'wide'];
  const aspect = props.aspect === 'auto' ? undefined : props.aspect;

  return (
    <figure
      style={{
        margin: '0 auto',
        padding: 'clamp(16px, 3vw, 32px) 0',
        maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
      }}
    >
      <div
        style={{
          aspectRatio: aspect,
          background: 'color-mix(in srgb, var(--sf-ink) 6%, transparent)',
          border: '1px solid color-mix(in srgb, var(--sf-accent) 18%, transparent)',
          overflow: 'hidden',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={props.alt ?? ''}
          style={{
            width: '100%',
            height: aspect ? '100%' : 'auto',
            display: 'block',
            objectFit: 'cover',
          }}
        />
      </div>
      {props.caption ? (
        <figcaption
          style={{
            fontFamily,
            fontSize: 13,
            color: 'color-mix(in srgb, var(--sf-ink) 60%, transparent)',
            marginTop: 12,
            textAlign: 'center',
          }}
        >
          {props.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
