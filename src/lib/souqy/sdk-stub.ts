import 'server-only';

/**
 * Compact `@souqna/sdk` type stub written into the sandbox before tsc
 * runs. This is the *only* view tsc has of our SDK — the real
 * implementation lives in `src/sdk/` and is provided at runtime by the
 * dynamic loader, never bundled into the per-tenant artifact.
 *
 * Hand-maintained: bump in lockstep with the real SDK whenever the
 * exported surface changes. The build will catch a stale stub in
 * one of two ways:
 *
 *   - new component prop → tsc fails on a "not present in stub" error
 *     when Claude (correctly) writes against the real SDK,
 *   - removed component → tsc passes a stale call that fails at
 *     runtime on the dynamic loader's missing-export check.
 *
 * Bias toward "permissive in the stub, strict at runtime": Zod schemas
 * are still the truth for runtime validity. The stub's job is mostly
 * to give Claude red-squiggle feedback during type-check inside the
 * sandbox — catching obvious typos and missing required props.
 *
 * When updating: mirror `src/sdk/index.ts`, `src/sdk/runtime.ts`, and
 * prop shapes in `src/lib/blocks/types.ts` for exported components.
 */

const PROP_TYPES = `
export type PaletteId =
  | 'sand_gold'
  | 'pearl_ink'
  | 'olive_brass'
  | 'maroon_bone'
  | 'midnight_emerald'
  | 'terracotta_kiln'
  | 'bone_obsidian'
  | 'coral_play'
  | 'pearl_lagoon'
  | 'sage_inlet'
  | 'dune_blush';

export type Cta = { label: string; href: string; scrollTo?: string };

export type HeroProps = {
  eyebrow?: string;
  title: string;
  tagline?: string;
  layout?: 'centered' | 'inline' | 'banner';
  backgroundUrl?: string;
  backgroundCss?: string;
  backgroundCssSize?: string;
  showLogo?: boolean;
  showGlyph?: boolean;
  showFounder?: boolean;
  logoMode?: 'hide' | 'default' | 'custom';
  logoUrl?: string;
  glyphMode?: 'hide' | 'default' | 'custom';
  glyphUrl?: string;
  glyphText?: string;
  cta?: Cta;
};

export type BannerProps = {
  imageUrl: string;
  alt?: string;
  overlayTitle?: string;
  overlaySubtitle?: string;
  align?: 'start' | 'center' | 'end';
  scrim?: 'none' | 'soft' | 'strong';
  cta?: Cta;
};

export type TextProps = {
  eyebrow?: string;
  heading?: string;
  body: string;
  align?: 'start' | 'center' | 'end';
  emphasis?: 'plain' | 'serif';
};

export type ImageProps = {
  imageUrl: string;
  alt?: string;
  caption?: string;
  aspect?: '1/1' | '4/3' | '4/5' | '3/4' | '16/9' | 'auto';
  width?: 'narrow' | 'wide' | 'full';
};

export type GalleryItem = { imageUrl: string; alt?: string; caption?: string };
export type GalleryProps = {
  items: GalleryItem[];
  columns?: 2 | 3 | 4;
  aspect?: '1/1' | '4/5' | '3/4' | 'auto';
};

export type ProductGridProps = {
  layout?: 'cards' | 'minimal' | 'lookbook';
  columns?: 2 | 3 | 4;
  category?: string;
  categorySlug?: string;
  limit?: number;
  showInquire?: boolean;
};

export type ProductListProps = {
  groupByCategory?: boolean;
  showImages?: boolean;
  showPrices?: boolean;
  category?: string;
  categorySlug?: string;
  limit?: number;
};

export type FeaturedProductProps = {
  productId?: string;
  categorySlug?: string;
  layout?: 'split' | 'stacked';
};

export type ServiceItem = {
  id: string;
  title: string;
  description?: string;
  priceQar?: number;
  status?: 'active' | 'sold_out';
};
export type ServiceListProps = {
  category?: string;
  limit?: number;
  showInquire?: boolean;
  items?: ServiceItem[];
  heading?: string;
};

export type MenuItem = {
  id: string;
  title: string;
  titleAlt?: string;
  description?: string;
  category?: string;
  priceQar?: number;
  status?: 'active' | 'sold_out';
};
export type MenuProps = {
  category?: string;
  categorySlug?: string;
  groupByCategory?: boolean;
  limit?: number;
  items?: MenuItem[];
  heading?: string;
};

export type CalendarSlot = {
  id: string;
  date: string;
  time?: string;
  label: string;
  capacity?: number;
  status?: 'open' | 'limited' | 'full';
};
export type CalendarProps = {
  category?: string;
  limit?: number;
  slots?: CalendarSlot[];
  heading?: string;
};

export type ContactCardProps = {
  showPhone?: boolean;
  showArea?: boolean;
  showHours?: boolean;
  showInstagram?: boolean;
  label?: string;
  heading?: string;
  body?: string;
  phone?: string;
  area?: string;
  hours?: string;
  instagram?: string;
};

export type InquireCtaProps = {
  label?: string;
  variant?: 'primary' | 'ghost';
  eyebrow?: string;
  title?: string;
  body?: string;
  align?: 'start' | 'center' | 'end';
};

export type SpacerProps = { size?: 'sm' | 'md' | 'lg' | 'xl' };
export type DividerProps = { glyph?: boolean; width?: 'narrow' | 'wide' | 'full' };

export type DepthShowcaseProps = {
  imageUrl: string;
  title: string;
  description?: string;
  imageAlt?: string;
  width?: 'narrow' | 'wide' | 'full';
};

export type AuroraRibbonProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  heightPx?: number;
  brightness?: number;
};

/** Mirrors \`ThemeOverrides\` in \`src/lib/blocks/types.ts\` for theme.ts — enums relaxed to \`string\` where Zod lists are huge. */
export type ThemeOverrides = {
  palette?: PaletteId;
  pageBg?: string;
  backgroundEffect?: string;
  cursorEffect?: string;
  headingWeight?: 400 | 500 | 600;
  sectionSpacing?: 'tight' | 'comfortable' | 'spacious';
  themeBehaviour?: 'auto' | 'light' | 'dark';
  seo?: { title?: string; description?: string; ogImage?: string };
};

/**
 * Mirrors \`Storefront\` from \`src/lib/brief.ts\` — string-widen nested enums
 * so the stub stays maintainable; tsc only needs field names the model reads.
 */
export type Storefront = {
  slug: string;
  locale: 'en' | 'ar';
  founderName: string;
  businessName: string;
  contactEmail: string;
  ownership: string;
  experience: string;
  businessType: string;
  marketVolume: string;
  payments: string;
  tagline: string | null;
  phone: string | null;
  area: string | null;
  hours: string | null;
  instagram: string | null;
  logoUrl: string | null;
  design: string;
  palette: PaletteId;
  templateId: string;
  crNumber: string | null;
  clerkUserId: string;
  publishedBlocks: unknown[];
  draftBlocks: unknown[];
  themeOverrides: ThemeOverrides;
  isPublished: boolean;
  publishedAt: Date | null;
  souqyRevision: string | null;
  souqyBlobUrl: string | null;
  souqySource: string | null;
  souqyBrief: Record<string, unknown>;
  policies: Record<string, unknown>;
  checkout: Record<string, unknown>;
  customDomain: string | null;
  customDomainAddedAt: Date | null;
  customDomainVerifiedAt: Date | null;
  subdomainStatus: string;
  subdomainProvisionedAt: Date | null;
  subdomainError: string | null;
  createdAt: Date;
  expiresAt: Date;
};

export type Product = {
  id: string;
  storefrontSlug: string;
  title: string;
  description: string | null;
  priceQar: number | null;
  imageUrl: string | null;
  category: string | null;
  eventAt: Date | null;
  status: 'active' | 'draft' | 'sold_out';
  position: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SectionProps = {
  size?: 'tight' | 'comfortable' | 'spacious';
  tone?: 'default' | 'sand' | 'ink' | 'gold' | 'transparent';
  align?: 'start' | 'center' | 'end';
  maxWidth?: number;
  id?: string;
  children?: React.ReactNode;
};
export type StackProps = {
  gap?: number;
  align?: 'start' | 'center' | 'end' | 'stretch';
  direction?: 'column' | 'row';
  wrap?: boolean;
  justify?: 'start' | 'center' | 'end' | 'between';
  children?: React.ReactNode;
};
export type GridProps = {
  columns?: 1 | 2 | 3 | 4 | 6;
  gap?: number;
  collapseAt?: number;
  children?: React.ReactNode;
};
export type QuoteProps = { children?: React.ReactNode; cite?: string };
export type MarqueeProps = { items: string[]; speed?: 'slow' | 'medium' | 'fast' };
`.trim();

const COMPONENT_DECLS = [
  'Hero',
  'Banner',
  'Text',
  'Image',
  'Gallery',
  'ProductGrid',
  'ProductList',
  'FeaturedProduct',
  'ServiceList',
  'Menu',
  'Calendar',
  'ContactCard',
  'InquireCta',
  'Spacer',
  'Divider',
  'DepthShowcase',
  'AuroraRibbon',
]
  .map((name) => `export declare function ${name}(props: ${name}Props): JSX.Element;`)
  .join('\n');

const PRIMITIVES = ['Section', 'Stack', 'Grid', 'Quote', 'Marquee']
  .map((name) => `export declare function ${name}(props: ${name}Props): JSX.Element;`)
  .join('\n');

const HOOKS = `
export type SouqyContext = {
  storefront: Storefront;
  storefrontBaseHref: string;
  products: Product[];
  theme: ThemeOverrides;
  isRtl: boolean;
  copy: Record<string, unknown>;
  vocabulary: Record<string, unknown>;
  categoriesBySlug: Map<string, Set<string>>;
};
export declare function useSouqyContext(): SouqyContext;
export declare function useStorefront(): Storefront;
export declare function useProducts(): Product[];
export declare function useTheme(): ThemeOverrides;
export declare function useLocale(): 'en' | 'ar';
export declare function useIsRtl(): boolean;
`.trim();

export function souqnaSdkDts(): string {
  return [
    '/// <reference types="react" />',
    '',
    PROP_TYPES,
    '',
    HOOKS,
    '',
    COMPONENT_DECLS,
    '',
    PRIMITIVES,
    '',
  ].join('\n');
}

/**
 * `package.json` for the synthetic `@souqna/sdk` package we drop into
 * the sandbox's `node_modules` so tsc can resolve `import { Hero }
 * from '@souqna/sdk'` against our type stub.
 */
export function souqnaSdkPackageJson(): string {
  return JSON.stringify(
    {
      name: '@souqna/sdk',
      version: '0.0.0-souqy',
      types: './index.d.ts',
      main: './index.js',
    },
    null,
    2,
  );
}

/**
 * Stub `index.js` so Node doesn't error on the package while tsc reads
 * the .d.ts. We never actually load this file at runtime — bundling
 * marks `@souqna/sdk` external and the dynamic loader resolves it
 * against the real SDK in our app process.
 */
export function souqnaSdkStubJs(): string {
  return 'module.exports = new Proxy({}, { get: () => () => null });\n';
}
