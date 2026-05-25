import type { Block, BlockStyle } from '@/lib/blocks/types';
import type { BlockContext } from './blocks/BlockContext';
import { palettes, paletteCssVars, type PaletteId } from '@/lib/palettes';
import { HeroBlock } from './blocks/HeroBlock';
import { BannerBlock } from './blocks/BannerBlock';
import { TextBlock } from './blocks/TextBlock';
import { ImageBlock } from './blocks/ImageBlock';
import { GalleryBlock } from './blocks/GalleryBlock';
import { ProductGridBlock } from './blocks/ProductGridBlock';
import { ProductListBlock } from './blocks/ProductListBlock';
import { FeaturedProductBlock } from './blocks/FeaturedProductBlock';
import { ServiceListBlock } from './blocks/ServiceListBlock';
import { MenuBlock } from './blocks/MenuBlock';
import { CalendarBlock } from './blocks/CalendarBlock';
import { ContactCardBlock } from './blocks/ContactCardBlock';
import { InquireCtaBlock } from './blocks/InquireCtaBlock';
import { SpacerBlock } from './blocks/SpacerBlock';
import { DividerBlock } from './blocks/DividerBlock';
import { DropBlock as RawDropBlock } from './blocks/DropBlock';
import { AnimatedTextBlock } from './blocks/AnimatedTextBlock';
import { AnimatedImageBlock } from './blocks/AnimatedImageBlock';
import { ProductCardStackBlock } from './blocks/ProductCardStackBlock';
import { TiltImageBlock } from './blocks/TiltImageBlock';
import { SpotlightCardBlock } from './blocks/SpotlightCardBlock';
import { ProductPromoCardBlock } from './blocks/ProductPromoCardBlock';
import { MawidBlock as RawMawidBlock } from './blocks/MawidBlock';
import { TaqimBlock as RawTaqimBlock } from './blocks/TaqimBlock';
import { DepthShowcaseBlock } from './blocks/DepthShowcaseBlock';
import { AuroraRibbonBlock } from './blocks/AuroraRibbonBlock';
import {
  Showcase1Block,
  Showcase2Block,
  Showcase3Block,
  Showcase4Block,
  Showcase5Block,
} from './blocks/ShowcaseBlocks';
import {
  Ecommerce1Block,
  Ecommerce2Block,
  Ecommerce3Block,
  Ecommerce4Block,
  Ecommerce5Block,
  Ecommerce6Block,
  Ecommerce7Block,
} from './blocks/EcommerceBlocks';
import { BlockBackgroundFrame } from './blocks/BlockBackgroundFrame';

// Async server component → `Promise<ReactNode>` return type isn't yet
// part of the React 18 ambient types; the App Router resolves it at
// runtime. Same cast pattern used in Storefront.tsx for SouqyMount.
const DropBlock = RawDropBlock as unknown as (props: {
  block: Block;
  ctx: BlockContext;
}) => JSX.Element;
const MawidBlock = RawMawidBlock as unknown as (props: {
  block: Block;
  ctx: BlockContext;
}) => JSX.Element;
const TaqimBlock = RawTaqimBlock as unknown as (props: {
  block: Block;
  ctx: BlockContext;
}) => JSX.Element;

type Props = {
  blocks: Block[];
  ctx: BlockContext;
  /** When true, wraps each block with a `data-block-id` so the iframe
   * preview can sync selection with the parent builder via postMessage. */
  selectable?: boolean;
};

const PADDING_Y_MAP: Record<string, string> = {
  none: '0',
  sm: 'clamp(12px, 1.5vw, 20px)',
  md: 'clamp(20px, 3vw, 36px)',
  lg: 'clamp(36px, 5vw, 64px)',
  xl: 'clamp(56px, 8vw, 112px)',
};

const PADDING_X_MAP: Record<string, string> = {
  none: '0',
  sm: 'clamp(8px, 1vw, 16px)',
  md: 'clamp(16px, 2vw, 28px)',
  lg: 'clamp(24px, 3vw, 48px)',
};

function resolvePadding(
  value: BlockStyle['paddingY'] | BlockStyle['paddingX'],
  map: Record<string, string>,
): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') return `${Math.max(0, Math.round(value))}px`;
  return map[value];
}

const BG_KEYWORDS: Record<string, string> = {
  sand: 'var(--sf-ground)',
  ink: 'var(--sf-ink)',
  gold: 'var(--sf-accent)',
  transparent: 'transparent',
};

const COLOR_KEYWORDS: Record<string, string> = {
  ink: 'var(--sf-ink)',
  sand: 'var(--sf-ground)',
  gold: 'var(--sf-accent)',
};

/**
 * Iterates the storefront's `blocks` array and dispatches each row to its
 * concrete server component. The dispatcher tolerates unknown block types
 * (returns null) so partial rollouts of new block kinds never break the
 * public storefront — important once Phase 2 starts shipping new types.
 */
export function BlockRenderer({ blocks, ctx, selectable = false }: Props) {
  return (
    <>
      {blocks.map((block) => {
        // `display: 'hidden'` is the editor's "stash" — keep the row in the
        // draft JSON but skip rendering entirely so previews and published
        // storefronts both omit it.
        if (block.style?.display === 'hidden') return null;
        const inner = renderBlock(block, ctx);
        if (inner === null) return null;
        return (
          <BlockFrame key={block.id} block={block} ctx={ctx} selectable={selectable}>
            {inner}
          </BlockFrame>
        );
      })}
    </>
  );
}

const JUSTIFY_MAP: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
};

const ALIGN_MAP: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
};

function BlockFrame({
  block,
  ctx,
  selectable,
  children,
}: {
  block: Block;
  ctx: BlockContext;
  selectable: boolean;
  children: React.ReactNode;
}) {
  const style = block.style ?? {};
  const css: React.CSSProperties = {};
  const py = resolvePadding(style.paddingY, PADDING_Y_MAP);
  if (py) css.paddingTop = css.paddingBottom = py;
  const px = resolvePadding(style.paddingX, PADDING_X_MAP);
  if (px) css.paddingLeft = css.paddingRight = px;
  // Per-side overrides win over the legacy axis tokens. We layer them on
  // *after* the token values so a founder who only sets `paddingTop`
  // keeps the X token for the unset axis.
  if (typeof style.paddingTop === 'number')
    css.paddingTop = `${Math.max(0, Math.round(style.paddingTop))}px`;
  if (typeof style.paddingRight === 'number')
    css.paddingRight = `${Math.max(0, Math.round(style.paddingRight))}px`;
  if (typeof style.paddingBottom === 'number')
    css.paddingBottom = `${Math.max(0, Math.round(style.paddingBottom))}px`;
  if (typeof style.paddingLeft === 'number')
    css.paddingLeft = `${Math.max(0, Math.round(style.paddingLeft))}px`;
  if (style.bg) css.background = BG_KEYWORDS[style.bg] ?? style.bg;
  if (style.backgroundCss) {
    css.background = style.backgroundCss;
    if (style.backgroundCssSize) css.backgroundSize = style.backgroundCssSize;
  }
  if (style.textColor) css.color = COLOR_KEYWORDS[style.textColor] ?? style.textColor;
  if (style.align)
    css.textAlign = style.align === 'start' ? 'left' : style.align === 'end' ? 'right' : 'center';

  // Layout primitives. `block` (default) leaves the wrapper as a
  // standard stacked section; `flex` / `grid` switch the wrapper to that
  // display mode and apply direction/wrap/justify/align/gap.
  if (style.display === 'flex' || style.display === 'grid') {
    css.display = style.display;
    if (style.display === 'flex') {
      if (style.flexDirection) css.flexDirection = style.flexDirection;
      if (style.flexWrap) css.flexWrap = style.flexWrap;
    }
    if (style.justifyContent)
      css.justifyContent = JUSTIFY_MAP[style.justifyContent] ?? style.justifyContent;
    if (style.alignItems) css.alignItems = ALIGN_MAP[style.alignItems] ?? style.alignItems;
    if (typeof style.gap === 'number') css.gap = `${Math.max(0, Math.round(style.gap))}px`;
  }

  // Per-block surface mode. When `light` or `dark` is picked, re-emit the
  // palette CSS vars for that triplet so every nested `var(--sf-ink|ground|accent)`
  // resolves against the chosen scheme — even if the page itself is the
  // opposite mode. `inherit` (or undefined) leaves the parent vars alone.
  if (style.colorScheme === 'light' || style.colorScheme === 'dark') {
    const paletteId = (ctx.theme.palette ?? ctx.storefront.palette) as PaletteId;
    const palette = palettes[paletteId] ?? palettes.sand_gold;
    Object.assign(css, paletteCssVars(palette, style.colorScheme));
    css.colorScheme = style.colorScheme;
    if (!style.bg) css.background = 'var(--sf-ground)';
    if (!style.textColor) css.color = 'var(--sf-ink)';
  }

  return (
    <div
      id={`b-${block.id}`}
      data-block-id={selectable ? block.id : undefined}
      data-block-type={block.type}
      style={{ ...css, scrollMarginTop: 80 }}
    >
      <BlockBackgroundFrame effect={style.backgroundEffect}>{children}</BlockBackgroundFrame>
    </div>
  );
}

function renderBlock(block: Block, ctx: BlockContext): React.ReactNode {
  switch (block.type) {
    case 'hero':
      return <HeroBlock block={block as never} ctx={ctx} />;
    case 'banner':
      return <BannerBlock block={block as never} ctx={ctx} />;
    case 'text':
      return <TextBlock block={block as never} ctx={ctx} />;
    case 'image':
      return <ImageBlock block={block as never} ctx={ctx} />;
    case 'gallery':
      return <GalleryBlock block={block as never} ctx={ctx} />;
    case 'productGrid':
      return <ProductGridBlock block={block as never} ctx={ctx} />;
    case 'productList':
      return <ProductListBlock block={block as never} ctx={ctx} />;
    case 'featuredProduct':
      return <FeaturedProductBlock block={block as never} ctx={ctx} />;
    case 'serviceList':
      return <ServiceListBlock block={block as never} ctx={ctx} />;
    case 'menu':
      return <MenuBlock block={block as never} ctx={ctx} />;
    case 'calendar':
      return <CalendarBlock block={block as never} ctx={ctx} />;
    case 'contactCard':
      return <ContactCardBlock block={block as never} ctx={ctx} />;
    case 'inquireCta':
      return <InquireCtaBlock block={block as never} ctx={ctx} />;
    case 'spacer':
      return <SpacerBlock block={block as never} ctx={ctx} />;
    case 'divider':
      return <DividerBlock block={block as never} ctx={ctx} />;
    case 'drop':
      return <DropBlock block={block as never} ctx={ctx} />;
    case 'animatedText':
      return <AnimatedTextBlock block={block as never} ctx={ctx} />;
    case 'animatedImage':
      return <AnimatedImageBlock block={block as never} ctx={ctx} />;
    case 'productCardStack':
      return <ProductCardStackBlock block={block as never} ctx={ctx} />;
    case 'tiltImage':
      return <TiltImageBlock block={block as never} ctx={ctx} />;
    case 'spotlightCard':
      return <SpotlightCardBlock block={block as never} ctx={ctx} />;
    case 'productPromoCard':
      return <ProductPromoCardBlock block={block as never} ctx={ctx} />;
    case 'mawid':
      return <MawidBlock block={block as never} ctx={ctx} />;
    case 'taqim':
      return <TaqimBlock block={block as never} ctx={ctx} />;
    case 'depthShowcase':
      return <DepthShowcaseBlock block={block as never} ctx={ctx} />;
    case 'auroraRibbon':
      return <AuroraRibbonBlock block={block as never} ctx={ctx} />;
    case 'showcase1':
      return <Showcase1Block block={block as never} ctx={ctx} />;
    case 'showcase2':
      return <Showcase2Block block={block as never} ctx={ctx} />;
    case 'showcase3':
      return <Showcase3Block block={block as never} ctx={ctx} />;
    case 'showcase4':
      return <Showcase4Block block={block as never} ctx={ctx} />;
    case 'showcase5':
      return <Showcase5Block block={block as never} ctx={ctx} />;
    case 'ecommerce1':
      return <Ecommerce1Block block={block as never} ctx={ctx} />;
    case 'ecommerce2':
      return <Ecommerce2Block block={block as never} ctx={ctx} />;
    case 'ecommerce3':
      return <Ecommerce3Block block={block as never} ctx={ctx} />;
    case 'ecommerce4':
      return <Ecommerce4Block block={block as never} ctx={ctx} />;
    case 'ecommerce5':
      return <Ecommerce5Block block={block as never} ctx={ctx} />;
    case 'ecommerce6':
      return <Ecommerce6Block block={block as never} ctx={ctx} />;
    case 'ecommerce7':
      return <Ecommerce7Block block={block as never} ctx={ctx} />;
    default:
      return null;
  }
}
