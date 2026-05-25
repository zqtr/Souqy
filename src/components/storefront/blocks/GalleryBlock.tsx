import type { BlockRenderProps } from './BlockContext';
import type { GalleryProps } from '@/lib/blocks/types';
import { VariantFrame } from './VariantFrame';

/**
 * 2/3/4-column image grid. Captions are optional per item; if any item has
 * one we render a caption row beneath every cell to keep the rhythm even.
 */
export function GalleryBlock({ block, ctx }: BlockRenderProps<GalleryProps>) {
  const { isRtl } = ctx;
  const props = block.props;
  const items = (props.items ?? []).filter((item) => item.imageUrl?.trim());
  if (items.length === 0) return null;
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const aspect = props.aspect === 'auto' ? undefined : props.aspect;
  const galleryEffect = block.style?.galleryEffect;
  const isCarousel =
    galleryEffect === 'infinite-gallery' ||
    galleryEffect === 'gradient-carousel' ||
    galleryEffect === 'animated-list';
  const isCircle = galleryEffect === 'circle-gallery' || galleryEffect === 'circles';
  const isDraggable = galleryEffect === 'draggable-grid';
  const isComparison = galleryEffect === 'comparison-slider';
  const columns = isCarousel
    ? `repeat(${items.length}, minmax(220px, 34vw))`
    : `repeat(${props.columns}, minmax(0, 1fr))`;

  return (
    <VariantFrame variant={block.style?.variant}>
      <section
        style={{
          padding: 'clamp(20px, 3vw, 40px) clamp(0px, 2vw, 24px)',
        }}
      >
        <div
          className="grid"
          style={{
            gap: 'clamp(12px, 1.6vw, 20px)',
            gridTemplateColumns: columns,
            overflowX: isCarousel ? 'auto' : undefined,
            scrollSnapType: isCarousel ? 'x mandatory' : undefined,
            cursor: isDraggable ? 'grab' : undefined,
          }}
        >
          {items.map((item, idx) => {
            const imageUrl = item.imageUrl.trim();
            return (
              <figure
                key={`${imageUrl}-${idx}`}
                style={{
                  margin: 0,
                  scrollSnapAlign: isCarousel ? 'start' : undefined,
                  transform:
                    galleryEffect === 'hover-preview'
                      ? `rotate(${idx % 2 === 0 ? '-1.4deg' : '1.4deg'})`
                      : galleryEffect === 'comparison-slider' && idx > 0
                        ? 'translateX(-18%)'
                        : undefined,
                  marginInlineStart: isComparison && idx > 0 ? '-12%' : undefined,
                  zIndex: isComparison ? items.length - idx : undefined,
                }}
              >
                <div
                  style={{
                    aspectRatio: aspect,
                    background: 'color-mix(in srgb, var(--sf-ink) 6%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--sf-accent) 18%, transparent)',
                    overflow: 'hidden',
                    borderRadius: isCircle
                      ? '999px'
                      : galleryEffect === 'hover-preview'
                        ? 18
                        : undefined,
                    boxShadow:
                      galleryEffect && galleryEffect !== 'none'
                        ? '0 24px 70px -44px color-mix(in srgb, var(--sf-ink) 70%, transparent)'
                        : undefined,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt={item.alt ?? ''}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
                {item.caption ? (
                  <figcaption
                    style={{
                      fontFamily,
                      fontSize: 12,
                      color: 'color-mix(in srgb, var(--sf-ink) 60%, transparent)',
                      marginTop: 8,
                    }}
                  >
                    {item.caption}
                  </figcaption>
                ) : null}
              </figure>
            );
          })}
        </div>
      </section>
    </VariantFrame>
  );
}
