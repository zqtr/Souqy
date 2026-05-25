import 'server-only';
import { randomUUID } from 'node:crypto';
import { useSouqyContext } from './runtime';
import { HeroBlock } from '@/components/storefront/blocks/HeroBlock';
import { BannerBlock } from '@/components/storefront/blocks/BannerBlock';
import { TextBlock } from '@/components/storefront/blocks/TextBlock';
import { ImageBlock } from '@/components/storefront/blocks/ImageBlock';
import { GalleryBlock } from '@/components/storefront/blocks/GalleryBlock';
import { ProductGridBlock } from '@/components/storefront/blocks/ProductGridBlock';
import { ProductListBlock } from '@/components/storefront/blocks/ProductListBlock';
import { FeaturedProductBlock } from '@/components/storefront/blocks/FeaturedProductBlock';
import { ServiceListBlock } from '@/components/storefront/blocks/ServiceListBlock';
import { MenuBlock } from '@/components/storefront/blocks/MenuBlock';
import { CalendarBlock } from '@/components/storefront/blocks/CalendarBlock';
import { ContactCardBlock } from '@/components/storefront/blocks/ContactCardBlock';
import { InquireCtaBlock } from '@/components/storefront/blocks/InquireCtaBlock';
import { SpacerBlock } from '@/components/storefront/blocks/SpacerBlock';
import { DividerBlock } from '@/components/storefront/blocks/DividerBlock';
import { DepthShowcaseBlock } from '@/components/storefront/blocks/DepthShowcaseBlock';
import { AuroraRibbonBlock } from '@/components/storefront/blocks/AuroraRibbonBlock';
import type {
  HeroProps,
  BannerProps,
  TextProps,
  ImageProps,
  GalleryProps,
  ProductGridProps,
  ProductListProps,
  FeaturedProductProps,
  ServiceListProps,
  MenuProps,
  CalendarProps,
  ContactCardProps,
  InquireCtaProps,
  SpacerProps,
  DividerProps,
  Block,
  BlockType,
  DepthShowcaseProps,
  AuroraRibbonProps,
} from '@/lib/blocks/types';

/**
 * Each SDK component is a one-line shim that delegates to the
 * corresponding storefront block component. The shim:
 *
 *   1. Mints a stable id with `randomUUID` so the renderer's DnD
 *      affordances and `data-block-id` selectors keep working.
 *   2. Pulls the request-scoped context off AsyncLocalStorage so the
 *      founder's TSX never has to thread `ctx` through every call site.
 *   3. Wraps the props in the `Block` envelope the existing components
 *      expect (`{ id, type, props }`).
 *
 * The shape Claude codes against is the *flat* `*Props` types from
 * `@/lib/blocks/types`. Every prop is the same as what the JSON
 * builder writes — Souqy and the dashboard speak the same language.
 *
 * Adding a new block: add a Zod schema in `src/lib/blocks/schemas.ts`,
 * a renderer in `src/components/storefront/blocks/`, and a one-line
 * wrapper here. Three rows always.
 */

function wrap<T extends BlockType, P>(type: T, props: P) {
  return { id: randomUUID(), type, props } as unknown as Block & { props: P };
}

export function Hero(props: HeroProps) {
  const ctx = useSouqyContext();
  return <HeroBlock block={wrap('hero', props)} ctx={ctx} />;
}

export function Banner(props: BannerProps) {
  const ctx = useSouqyContext();
  return <BannerBlock block={wrap('banner', props)} ctx={ctx} />;
}

export function Text(props: TextProps) {
  const ctx = useSouqyContext();
  return <TextBlock block={wrap('text', props)} ctx={ctx} />;
}

export function Image(props: ImageProps) {
  const ctx = useSouqyContext();
  return <ImageBlock block={wrap('image', props)} ctx={ctx} />;
}

export function Gallery(props: GalleryProps) {
  const ctx = useSouqyContext();
  return <GalleryBlock block={wrap('gallery', props)} ctx={ctx} />;
}

export function ProductGrid(props: ProductGridProps) {
  const ctx = useSouqyContext();
  return <ProductGridBlock block={wrap('productGrid', props)} ctx={ctx} />;
}

export function ProductList(props: ProductListProps) {
  const ctx = useSouqyContext();
  return <ProductListBlock block={wrap('productList', props)} ctx={ctx} />;
}

export function FeaturedProduct(props: FeaturedProductProps) {
  const ctx = useSouqyContext();
  return <FeaturedProductBlock block={wrap('featuredProduct', props)} ctx={ctx} />;
}

export function ServiceList(props: ServiceListProps) {
  const ctx = useSouqyContext();
  return <ServiceListBlock block={wrap('serviceList', props)} ctx={ctx} />;
}

export function Menu(props: MenuProps) {
  const ctx = useSouqyContext();
  return <MenuBlock block={wrap('menu', props)} ctx={ctx} />;
}

export function Calendar(props: CalendarProps) {
  const ctx = useSouqyContext();
  return <CalendarBlock block={wrap('calendar', props)} ctx={ctx} />;
}

export function ContactCard(props: ContactCardProps) {
  const ctx = useSouqyContext();
  return <ContactCardBlock block={wrap('contactCard', props)} ctx={ctx} />;
}

export function InquireCta(props: InquireCtaProps) {
  const ctx = useSouqyContext();
  return <InquireCtaBlock block={wrap('inquireCta', props)} ctx={ctx} />;
}

export function Spacer(props: SpacerProps) {
  const ctx = useSouqyContext();
  return <SpacerBlock block={wrap('spacer', props)} ctx={ctx} />;
}

export function Divider(props: DividerProps) {
  const ctx = useSouqyContext();
  return <DividerBlock block={wrap('divider', props)} ctx={ctx} />;
}

export function DepthShowcase(props: DepthShowcaseProps) {
  const ctx = useSouqyContext();
  return <DepthShowcaseBlock block={wrap('depthShowcase', props)} ctx={ctx} />;
}

export function AuroraRibbon(props: AuroraRibbonProps) {
  const ctx = useSouqyContext();
  return <AuroraRibbonBlock block={wrap('auroraRibbon', props)} ctx={ctx} />;
}
