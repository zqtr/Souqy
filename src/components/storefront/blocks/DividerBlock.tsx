import type { BlockRenderProps } from './BlockContext';
import type { DividerProps } from '@/lib/blocks/types';

const WIDTH_MAP: Record<NonNullable<DividerProps['width']>, string> = {
  narrow: 'min(60ch, 100%)',
  wide: 'min(80ch, 100%)',
  full: '100%',
};

export function DividerBlock({ block }: BlockRenderProps<DividerProps>) {
  const { glyph, width = 'full' } = block.props;
  return (
    <div
      role="separator"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '24px 0',
        width: WIDTH_MAP[width],
        marginInline: 'auto',
      }}
    >
      <span
        aria-hidden
        style={{
          flex: 1,
          height: 1,
          background: 'color-mix(in srgb, var(--sf-accent) 30%, transparent)',
        }}
      />
      {glyph ? (
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--sf-accent)',
          }}
        />
      ) : null}
      <span
        aria-hidden
        style={{
          flex: 1,
          height: 1,
          background: 'color-mix(in srgb, var(--sf-accent) 30%, transparent)',
        }}
      />
    </div>
  );
}
