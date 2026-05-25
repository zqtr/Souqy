import type { BlockRenderProps } from './BlockContext';
import type { SpacerProps } from '@/lib/blocks/types';

const SIZE_MAP: Record<NonNullable<SpacerProps['size']>, string> = {
  sm: '24px',
  md: '48px',
  lg: '80px',
  xl: '128px',
};

export function SpacerBlock({ block }: BlockRenderProps<SpacerProps>) {
  const size = block.props.size ?? 'md';
  return <div aria-hidden style={{ height: SIZE_MAP[size] }} />;
}
