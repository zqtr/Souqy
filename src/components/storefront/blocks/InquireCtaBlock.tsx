import type { BlockRenderProps } from './BlockContext';
import type { InquireCtaProps } from '@/lib/blocks/types';
import { InquireButton } from '../InquireButton';
import { VariantFrame } from './VariantFrame';

/**
 * Free-floating inquire CTA. Used by the seed when no contact card is
 * appropriate but the storefront still needs a clear way to reach out.
 * Optional eyebrow + headline give it the editorial framing.
 */
export function InquireCtaBlock({ block, ctx }: BlockRenderProps<InquireCtaProps>) {
  const { storefront, isRtl } = ctx;
  const props = block.props;
  const align = props.align ?? 'center';
  const variant = props.variant ?? 'primary';
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const serifFamily = isRtl ? 'var(--font-arabic-serif), serif' : 'var(--font-serif), serif';
  const justify =
    align === 'center'
      ? 'center'
      : align === 'end'
        ? isRtl
          ? 'flex-start'
          : 'flex-end'
        : isRtl
          ? 'flex-end'
          : 'flex-start';
  const textAlign: 'center' | 'right' | 'left' =
    align === 'center' ? 'center' : align === 'end' ? (isRtl ? 'left' : 'right') : (isRtl ? 'right' : 'left');

  return (
    <VariantFrame variant={block.style?.variant}>
    <section
      className="flex flex-col"
      style={{
        gap: 16,
        padding: 'clamp(28px, 4vw, 56px) clamp(20px, 4vw, 40px)',
        alignItems: justify,
      }}
    >
      {props.eyebrow ? (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--sf-accent)',
            textAlign,
          }}
        >
          {props.eyebrow}
        </span>
      ) : null}
      {props.title ? (
        <h2
          style={{
            margin: 0,
            fontFamily: serifFamily,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(28px, 4vw, 44px)',
            lineHeight: 1.1,
            textAlign,
            maxWidth: 720,
          }}
        >
          {props.title}
        </h2>
      ) : null}
      {props.body ? (
        <p
          style={{
            margin: 0,
            fontFamily,
            fontSize: 16,
            lineHeight: 1.6,
            color: 'color-mix(in srgb, var(--sf-ink) 75%, transparent)',
            textAlign,
            maxWidth: 560,
          }}
        >
          {props.body}
        </p>
      ) : null}
      <InquireButton storefront={storefront} variant={variant} />
    </section>
    </VariantFrame>
  );
}
