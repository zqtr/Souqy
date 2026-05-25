'use client';

import DepthCard from '@/components/react-bits/depth-card';
import type { BlockRenderProps } from './BlockContext';
import type { DepthShowcaseProps } from '@/lib/blocks/types';

const WIDTH_PX: Record<NonNullable<DepthShowcaseProps['width']>, number> = {
  narrow: 300,
  wide: 400,
  full: 560,
};

/**
 * React Bits depth-card as a storefront block. One parallax card;
 * constrain to portfolio / hero-adjacent use — Souqy prompts should emit
 * at most one per page.
 */
export function DepthShowcaseBlock({ block, ctx }: BlockRenderProps<DepthShowcaseProps>) {
  const { isRtl } = ctx;
  const p = block.props;
  const wKey = p.width ?? 'wide';
  const cardW = WIDTH_PX[wKey];
  const cardH = Math.round(cardW * 1.08);
  const maxW =
    wKey === 'full' ? ('100%' as const) : wKey === 'wide' ? 'min(100%, 520px)' : 'min(100%, 360px)';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        paddingBlock: 'clamp(20px, 4vw, 48px)',
        paddingInline: 'clamp(12px, 3vw, 24px)',
        maxWidth: '100%',
      }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div style={{ width: maxW, display: 'flex', justifyContent: 'center' }}>
        <DepthCard
          image={p.imageUrl}
          title={p.title}
          description={p.description}
          imageAlt={p.imageAlt ?? ''}
          width={cardW}
          height={cardH}
          borderRadius="18px"
          disableOnMobile
          respectReducedMotion
          className="w-full"
        />
      </div>
    </div>
  );
}
