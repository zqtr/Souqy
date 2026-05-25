'use client';

import Showcase1 from '@/components/showcase-1';
import { Showcase2 } from '@/components/showcase-2';
import { Showcase3 } from '@/components/showcase-3';
import Showcase4 from '@/components/showcase-4';
import Showcase5 from '@/components/showcase-5';
import type { BlockRenderProps } from './BlockContext';
import type {
  Showcase1Props,
  Showcase2Props,
  Showcase3Props,
  Showcase4Props,
  Showcase5Props,
} from '@/lib/blocks/types';

export function Showcase1Block({ block, ctx }: BlockRenderProps<Showcase1Props>) {
  return <Showcase1 {...block.props} dir={ctx.isRtl ? 'rtl' : 'ltr'} />;
}

export function Showcase2Block({ block, ctx }: BlockRenderProps<Showcase2Props>) {
  return <Showcase2 {...block.props} dir={ctx.isRtl ? 'rtl' : 'ltr'} />;
}

export function Showcase3Block({ block, ctx }: BlockRenderProps<Showcase3Props>) {
  return <Showcase3 {...block.props} dir={ctx.isRtl ? 'rtl' : 'ltr'} />;
}

export function Showcase4Block({ block, ctx }: BlockRenderProps<Showcase4Props>) {
  return <Showcase4 {...block.props} dir={ctx.isRtl ? 'rtl' : 'ltr'} />;
}

export function Showcase5Block({ block, ctx }: BlockRenderProps<Showcase5Props>) {
  return <Showcase5 {...block.props} dir={ctx.isRtl ? 'rtl' : 'ltr'} />;
}
