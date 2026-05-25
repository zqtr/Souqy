/**
 * `@souqna/sdk` — the locked-down API Souqy (Claude) writes against.
 *
 * This barrel is the *only* legal import in generated TSX. The Souqy
 * validator parses every `import` declaration in Claude's output and
 * rejects anything that doesn't resolve to `react`, `./theme`, or
 * `@souqna/sdk` — keeping the per-tenant blast radius bounded to
 * components and hooks we wrote and reviewed.
 *
 * Two kinds of exports:
 *
 *   - **Components** (`Hero`, `ProductGrid`, `Menu`, …) — thin shims
 *     over Souqna's existing storefront blocks. Same prop shapes as the
 *     dashboard's JSON builder so a Souqy-built section is structurally
 *     identical to a hand-built one.
 *
 *   - **Primitives** (`Section`, `Stack`, `Grid`, `Quote`, `Marquee`)
 *     — pure presentational helpers that handle layout without leaking
 *     arbitrary CSS.
 *
 *   - **Hooks** (`useStorefront`, `useProducts`, `useTheme`, …) — read
 *     access into the request-scoped `SouqyContext`. Generated code
 *     can branch on locale, palette, or product list without prop
 *     drilling.
 *
 * Everything is server-component-safe — there is no client runtime in
 * the SDK so generated stores stay 0 KB on the wire.
 */

export {
  withSouqyContext,
  useSouqyContext,
  useStorefront,
  useProducts,
  useTheme,
  useLocale,
  useIsRtl,
  type SouqyContext,
} from './runtime';

export {
  Hero,
  Banner,
  Text,
  Image,
  Gallery,
  ProductGrid,
  ProductList,
  FeaturedProduct,
  ServiceList,
  Menu,
  Calendar,
  ContactCard,
  InquireCta,
  Spacer,
  Divider,
  DepthShowcase,
  AuroraRibbon,
} from './components';

export {
  Section,
  Stack,
  Grid,
  Quote,
  Marquee,
  type SectionProps,
  type StackProps,
  type GridProps,
  type QuoteProps,
  type MarqueeProps,
} from './primitives';

// Re-export the prop types Claude needs to type its component calls.
// Keeping them re-exported from the SDK barrel means generated code
// never has to know about `@/lib/blocks/types` paths.
export type {
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
  DepthShowcaseProps,
  AuroraRibbonProps,
  ThemeOverrides,
  Cta,
  GalleryItem,
  ServiceItem,
  MenuItem,
  CalendarSlot,
} from '@/lib/blocks/types';

export type { Storefront } from '@/lib/brief';
export type { Product } from '@/lib/products';
