import { z } from 'zod';
import { PALETTE_IDS } from '@/lib/palettes';
import {
  ANIMATED_IMAGE_EFFECTS,
  ANIMATED_TEXT_EFFECTS,
  BACKGROUND_EFFECTS,
  BLOCK_TYPES,
  BLOCK_VARIANTS,
  CARD_EFFECTS,
  CURSOR_EFFECTS,
  GALLERY_EFFECTS,
  TEXT_EFFECTS,
} from './types';

/**
 * Zod is the single source of truth for what a block's props can look like.
 * Two consumers depend on it:
 *
 *   1. `saveDraftBlocks` server action validates the entire `blocks[]` array
 *      against `blockSchema` before writing to JSONB, so a malicious client
 *      can't smuggle a `{type:'hero', props:{href:'javascript:...'}}` row.
 *   2. The Phase-2 inspector reads the schema for the selected block to
 *      auto-generate fields (which fields are optional, max length, enums).
 *
 * Keep prop names in lockstep with `types.ts`.
 */

// Padding can be a legacy named token OR a raw px number from the
// numeric stepper. Bounded to a generous 2000px so a typo doesn't blow
// out the page, but the inspector itself imposes no soft cap.
const paddingTokenY = z.enum(['none', 'sm', 'md', 'lg', 'xl']);
const paddingTokenX = z.enum(['none', 'sm', 'md', 'lg']);
const paddingValueY = z.union([paddingTokenY, z.number().int().min(0).max(2000)]);
const paddingValueX = z.union([paddingTokenX, z.number().int().min(0).max(2000)]);

// Per-side padding (Framer-style). Same upper bound as the legacy axis
// tokens so a stored row never blows out the page; the inspector imposes
// no soft cap so editorially-large heros remain achievable.
const sidePadding = z.number().int().min(0).max(2000);
// Bounded gap matches the same ceiling — flex/grid blocks rarely go past
// a few hundred px and we want JSON blobs to stay sane.
const gapValue = z.number().int().min(0).max(2000);

const styleSchema = z
  .object({
    paddingY: paddingValueY.optional(),
    paddingX: paddingValueX.optional(),
    bg: z.string().max(64).optional(),
    textColor: z.string().max(64).optional(),
    backgroundCss: z.string().trim().max(4096).optional(),
    backgroundCssSize: z.string().trim().max(120).optional(),
    backgroundEffect: z.enum(BACKGROUND_EFFECTS).optional(),
    textEffect: z.enum(TEXT_EFFECTS).optional(),
    cardEffect: z.enum(CARD_EFFECTS).optional(),
    galleryEffect: z.enum(GALLERY_EFFECTS).optional(),
    align: z.enum(['start', 'center', 'end']).optional(),
    colorScheme: z.enum(['inherit', 'light', 'dark']).optional(),

    // Layout primitives mirror BlockStyle in types.ts. All optional so
    // existing JSONB rows validate unchanged.
    display: z.enum(['block', 'flex', 'grid', 'hidden']).optional(),
    flexDirection: z.enum(['row', 'column', 'row-reverse', 'column-reverse']).optional(),
    flexWrap: z.enum(['nowrap', 'wrap', 'wrap-reverse']).optional(),
    justifyContent: z.enum(['start', 'center', 'end', 'between', 'around', 'evenly']).optional(),
    alignItems: z.enum(['start', 'center', 'end', 'stretch', 'baseline']).optional(),
    gap: gapValue.optional(),

    paddingTop: sidePadding.optional(),
    paddingRight: sidePadding.optional(),
    paddingBottom: sidePadding.optional(),
    paddingLeft: sidePadding.optional(),

    // Pro variant — gated server-side in `saveDraftBlocks` against the
    // caller's plan; here we only validate the shape. A non-Pro caller
    // who smuggles `pro-aurora` past the schema gets it silently
    // downgraded to `'classic'` before the row hits JSONB.
    variant: z.enum(BLOCK_VARIANTS).optional(),
  })
  .strict()
  .optional();

const ctaSchema = z
  .object({
    label: z.string().trim().min(1).max(60),
    href: z.string().trim().max(2048),
    /** Optional in-page anchor target (a block id on the same page). */
    scrollTo: z.string().trim().max(64).optional(),
  })
  .strict();

// ============================================================================
// Per-block prop schemas
// ============================================================================

const heroProps = z
  .object({
    eyebrow: z.string().trim().max(80).optional(),
    title: z.string().trim().min(1).max(200),
    tagline: z.string().trim().max(280).optional(),
    layout: z.enum(['centered', 'inline', 'banner']).default('centered'),
    backgroundUrl: z.string().trim().max(2048).optional(),
    // Pattern-library CSS background shorthand. Bounded generously to
    // accommodate inline SVG data-URIs (the "noise" patterns clock in
    // around 400 chars; multi-layer mesh patterns ~600). 4 KB leaves
    // headroom for future patterns without bloating JSONB rows.
    backgroundCss: z.string().trim().max(4096).optional(),
    backgroundCssSize: z.string().trim().max(120).optional(),
    showLogo: z.boolean().optional(),
    showGlyph: z.boolean().optional(),
    showFounder: z.boolean().optional(),
    logoMode: z.enum(['hide', 'default', 'custom']).optional(),
    logoUrl: z.string().trim().max(2048).optional(),
    glyphMode: z.enum(['hide', 'default', 'custom']).optional(),
    glyphUrl: z.string().trim().max(2048).optional(),
    glyphText: z.string().trim().max(4).optional(),
    cta: ctaSchema.optional(),
  })
  .strict();

const bannerProps = z
  .object({
    // Allow empty while the user hasn't uploaded yet — the renderer falls
    // back to a neutral placeholder. Required-on-publish is enforced by the
    // editor's draft → publish gate, not the persistence schema.
    imageUrl: z.string().trim().max(2048).default(''),
    alt: z.string().trim().max(200).optional(),
    overlayTitle: z.string().trim().max(160).optional(),
    overlaySubtitle: z.string().trim().max(280).optional(),
    align: z.enum(['start', 'center', 'end']).optional(),
    scrim: z.enum(['none', 'soft', 'strong']).optional(),
    cta: ctaSchema.optional(),
  })
  .strict();

const textProps = z
  .object({
    eyebrow: z.string().trim().max(80).optional(),
    heading: z.string().trim().max(200).optional(),
    body: z.string().trim().min(1).max(4000),
    align: z.enum(['start', 'center', 'end']).optional(),
    emphasis: z.enum(['plain', 'serif']).optional(),
  })
  .strict();

const imageProps = z
  .object({
    // See bannerProps — empty allowed while the user hasn't uploaded yet.
    imageUrl: z.string().trim().max(2048).default(''),
    alt: z.string().trim().max(200).optional(),
    caption: z.string().trim().max(280).optional(),
    aspect: z.enum(['1/1', '4/3', '4/5', '3/4', '16/9', 'auto']).default('4/3'),
    width: z.enum(['narrow', 'wide', 'full']).optional(),
  })
  .strict();

const galleryProps = z
  .object({
    items: z
      .array(
        z
          .object({
            // Empty allowed while the slot is awaiting upload.
            imageUrl: z.string().trim().max(2048).default(''),
            alt: z.string().trim().max(200).optional(),
            caption: z.string().trim().max(160).optional(),
          })
          .strict(),
      )
      .max(60)
      .default([]),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    aspect: z.enum(['1/1', '4/5', '3/4', 'auto']).default('1/1'),
  })
  .strict();

const productGridProps = z
  .object({
    layout: z.enum(['cards', 'minimal', 'lookbook']).default('cards'),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    category: z.string().trim().max(80).optional(),
    categorySlug: z.string().trim().max(120).optional(),
    limit: z.number().int().positive().max(500).optional(),
    showInquire: z.boolean().optional(),
  })
  .strict();

const productListProps = z
  .object({
    groupByCategory: z.boolean().optional(),
    showImages: z.boolean().optional(),
    showPrices: z.boolean().optional(),
    category: z.string().trim().max(80).optional(),
    categorySlug: z.string().trim().max(120).optional(),
    limit: z.number().int().positive().max(500).optional(),
  })
  .strict();

const featuredProductProps = z
  .object({
    productId: z.string().uuid().optional(),
    categorySlug: z.string().trim().max(120).optional(),
    layout: z.enum(['split', 'stacked']).default('split'),
  })
  .strict();

const serviceItem = z
  .object({
    id: z.string().trim().min(1).max(64),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(560).optional(),
    priceQar: z.number().nonnegative().max(10_000_000).optional(),
    status: z.enum(['active', 'sold_out']).optional(),
  })
  .strict();

const serviceListProps = z
  .object({
    category: z.string().trim().max(80).optional(),
    limit: z.number().int().positive().max(500).optional(),
    showInquire: z.boolean().optional(),
    items: z.array(serviceItem).max(60).optional(),
    heading: z.string().trim().max(160).optional(),
  })
  .strict();

const menuItem = z
  .object({
    id: z.string().trim().min(1).max(64),
    title: z.string().trim().min(1).max(160),
    titleAlt: z.string().trim().max(160).optional(),
    description: z.string().trim().max(560).optional(),
    category: z.string().trim().max(80).optional(),
    priceQar: z.number().nonnegative().max(10_000_000).optional(),
    status: z.enum(['active', 'sold_out']).optional(),
  })
  .strict();

const menuProps = z
  .object({
    category: z.string().trim().max(80).optional(),
    categorySlug: z.string().trim().max(120).optional(),
    groupByCategory: z.boolean().optional(),
    limit: z.number().int().positive().max(500).optional(),
    items: z.array(menuItem).max(80).optional(),
    heading: z.string().trim().max(160).optional(),
  })
  .strict();

const calendarSlot = z
  .object({
    id: z.string().trim().min(1).max(64),
    date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
    time: z.string().trim().max(40).optional(),
    label: z.string().trim().min(1).max(160),
    capacity: z.number().int().nonnegative().max(10_000).optional(),
    status: z.enum(['open', 'limited', 'full']).optional(),
  })
  .strict();

const calendarProps = z
  .object({
    category: z.string().trim().max(80).optional(),
    limit: z.number().int().positive().max(500).optional(),
    slots: z.array(calendarSlot).max(120).optional(),
    heading: z.string().trim().max(160).optional(),
  })
  .strict();

const contactCardProps = z
  .object({
    showPhone: z.boolean().optional(),
    showArea: z.boolean().optional(),
    showHours: z.boolean().optional(),
    showInstagram: z.boolean().optional(),
    label: z.string().trim().max(80).optional(),
    heading: z.string().trim().max(160).optional(),
    body: z.string().trim().max(560).optional(),
    phone: z.string().trim().max(64).optional(),
    area: z.string().trim().max(120).optional(),
    hours: z.string().trim().max(160).optional(),
    instagram: z.string().trim().max(80).optional(),
  })
  .strict();

const inquireCtaProps = z
  .object({
    label: z.string().trim().max(60).optional(),
    variant: z.enum(['primary', 'ghost']).optional(),
    eyebrow: z.string().trim().max(80).optional(),
    title: z.string().trim().max(160).optional(),
    body: z.string().trim().max(560).optional(),
    align: z.enum(['start', 'center', 'end']).optional(),
  })
  .strict();

const spacerProps = z
  .object({
    size: z.enum(['sm', 'md', 'lg', 'xl']).default('md'),
  })
  .strict();

const dividerProps = z
  .object({
    glyph: z.boolean().optional(),
    width: z.enum(['narrow', 'wide', 'full']).optional(),
  })
  .strict();

const dropProps = z
  .object({
    dropId: z.string().trim().min(1).max(64),
    heading: z.string().trim().max(160).optional(),
    subheading: z.string().trim().max(280).optional(),
  })
  .strict();

const animatedTextProps = z
  .object({
    text: z.string().trim().min(1).max(1000),
    eyebrow: z.string().trim().max(80).optional(),
    effect: z.enum(ANIMATED_TEXT_EFFECTS).default('reveal'),
    loop: z.boolean().optional(),
    speed: z.enum(['slow', 'medium', 'fast']).optional(),
    align: z.enum(['start', 'center', 'end']).optional(),
    emphasis: z.enum(['display', 'body']).optional(),
  })
  .strict();

const animatedImageProps = z
  .object({
    imageUrl: z.string().trim().max(2048).default(''),
    alt: z.string().trim().max(200).optional(),
    caption: z.string().trim().max(280).optional(),
    effect: z.enum(ANIMATED_IMAGE_EFFECTS).default('parallax'),
    intensity: z.enum(['subtle', 'medium', 'strong']).optional(),
    aspect: z.enum(['1/1', '4/3', '4/5', '3/4', '16/9', 'auto']).optional(),
    width: z.enum(['narrow', 'wide', 'full']).optional(),
  })
  .strict();

const productCardStackProps = z
  .object({
    productId: z.string().uuid().optional(),
    categorySlug: z.string().trim().max(120).optional(),
    backCards: z.union([z.literal(1), z.literal(2)]).optional(),
    eyebrow: z.string().trim().max(80).optional(),
    ctaLabel: z.string().trim().max(60).optional(),
    scrollTo: z.string().trim().max(64).optional(),
  })
  .strict();

const tiltImageProps = z
  .object({
    imageUrl: z.string().trim().max(2048).default(''),
    alt: z.string().trim().max(200).optional(),
    title: z.string().trim().max(160).optional(),
    subtitle: z.string().trim().max(280).optional(),
    scrim: z.enum(['none', 'soft', 'strong']).optional(),
    tiltDirection: z.enum(['left', 'right', 'none']).optional(),
    intensity: z.enum(['subtle', 'medium', 'strong']).optional(),
    aspect: z.enum(['1/1', '4/3', '4/5', '3/4', '16/9', 'auto']).optional(),
    width: z.enum(['narrow', 'wide', 'full']).optional(),
    cta: ctaSchema.optional(),
  })
  .strict();

const promoCardTag = z
  .object({
    id: z.string().trim().min(1).max(64),
    label: z.string().trim().min(1).max(40),
    color: z.string().trim().max(64).optional(),
    background: z.string().trim().max(64).optional(),
  })
  .strict();

const productPromoCardProps = z
  .object({
    productId: z.string().uuid().optional(),
    categorySlug: z.string().trim().max(120).optional(),
    tags: z.array(promoCardTag).max(3).optional(),
    tagPosition: z.enum(['top-start', 'top-end']).optional(),
    tagReveal: z.enum(['always', 'on-hover']).optional(),
    showAddToCart: z.boolean().optional(),
    accentColor: z.string().trim().max(64).optional(),
    intensity: z.enum(['subtle', 'medium', 'strong']).optional(),
    width: z.enum(['narrow', 'wide', 'full']).optional(),
  })
  .strict();

const spotlightCardProps = z
  .object({
    eyebrow: z.string().trim().max(80).optional(),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().max(560).optional(),
    cta: ctaSchema.optional(),
    showDate: z.boolean().optional(),
    dateMonth: z.string().trim().max(24).optional(),
    dateDay: z.string().trim().max(12).optional(),
    pattern: z.enum(['none', 'stripes', 'dots', 'grid']).optional(),
    tiltDirection: z.enum(['left', 'right', 'none']).optional(),
    intensity: z.enum(['subtle', 'medium', 'strong']).optional(),
    // Bounded so a typo doesn't blow out the JSONB row; CSS colour
    // strings rarely exceed ~32 chars (a hex/rgba/oklch literal).
    accentColor: z.string().trim().max(64).optional(),
    width: z.enum(['narrow', 'wide', 'full']).optional(),
  })
  .strict();

const mawidProps = z
  .object({
    eventId: z.string().trim().max(64).optional().default(''),
    productId: z.string().trim().max(120).optional(),
    startsAt: z.string().trim().max(80).optional(),
    variant: z.enum(['boxed', 'inline', 'banner']).optional(),
    heading: z.string().trim().max(160).optional(),
    subheading: z.string().trim().max(280).optional(),
  })
  .strict();

const taqimProps = z
  .object({
    bundleId: z.string().trim().max(64).optional(),
    anchorProductId: z.string().trim().max(120).optional(),
    variant: z.enum(['stack', 'cards', 'carousel']).optional(),
    heading: z.string().trim().max(160).optional(),
  })
  .strict();

const depthShowcaseProps = z
  .object({
    imageUrl: z.string().trim().min(1).max(2048),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(560).optional(),
    imageAlt: z.string().trim().max(180).optional(),
    width: z.enum(['narrow', 'wide', 'full']).optional(),
  })
  .strict();

const auroraRibbonProps = z
  .object({
    eyebrow: z.string().trim().max(80).optional(),
    title: z.string().trim().max(200).optional(),
    subtitle: z.string().trim().max(400).optional(),
    heightPx: z.number().int().min(120).max(320).optional(),
    brightness: z.number().min(0.3).max(1.4).optional(),
  })
  .strict();

const showcase1Item = z
  .object({
    id: z.string().trim().max(64).optional(),
    title: z.string().trim().max(160).default(''),
    subtitle: z.string().trim().max(260).optional(),
    kicker: z.string().trim().max(80).optional(),
    imageUrl: z.string().trim().max(2048).default(''),
    href: z.string().trim().max(2048).optional(),
  })
  .strict();

const showcase1Props = z
  .object({
    eyebrow: z.string().trim().max(80).optional(),
    title: z.string().trim().max(220).optional(),
    description: z.string().trim().max(420).optional(),
    items: z.array(showcase1Item).max(8).optional(),
  })
  .strict();

const showcase2Image = z
  .object({
    id: z.string().trim().max(64).optional(),
    imageUrl: z.string().trim().max(2048).default(''),
    alt: z.string().trim().max(200).optional(),
    height: z.enum(['sm', 'md', 'lg']).optional(),
  })
  .strict();

const showcase2Props = z
  .object({
    eyebrow: z.string().trim().max(80).optional(),
    title: z.string().trim().max(220).optional(),
    cta: ctaSchema.optional(),
    items: z.array(showcase2Image).max(12).optional(),
  })
  .strict();

const showcase3Item = z
  .object({
    id: z.string().trim().max(64).optional(),
    title: z.string().trim().max(160).default(''),
    category: z.string().trim().max(80).optional(),
    imageUrl: z.string().trim().max(2048).default(''),
  })
  .strict();

const showcase3Props = z
  .object({
    title: z.string().trim().max(200).optional(),
    subtitle: z.string().trim().max(280).optional(),
    items: z.array(showcase3Item).min(1).max(6).optional(),
  })
  .strict();

const showcase4Project = z
  .object({
    id: z.string().trim().max(64).optional(),
    title: z.string().trim().max(160).default(''),
    client: z.string().trim().max(120).optional(),
    year: z.string().trim().max(24).optional(),
    tags: z.array(z.string().trim().max(40)).max(6).optional(),
    imageUrl: z.string().trim().max(2048).optional(),
    href: z.string().trim().max(2048).optional(),
  })
  .strict();

const showcase4Props = z
  .object({
    eyebrow: z.string().trim().max(120).optional(),
    title: z.string().trim().max(220).optional(),
    projects: z.array(showcase4Project).max(16).optional(),
  })
  .strict();

const showcase5Tab = z
  .object({
    id: z.string().trim().max(64).optional(),
    label: z.string().trim().max(40).default('Tab'),
    images: z.array(z.string().trim().max(2048)).max(12).default([]),
  })
  .strict();

const showcase5Props = z
  .object({
    eyebrow: z.string().trim().max(80).optional(),
    title: z.string().trim().max(220).optional(),
    description: z.string().trim().max(420).optional(),
    tabs: z.array(showcase5Tab).min(1).max(5).optional(),
  })
  .strict();

const ecommerceColor = z
  .object({
    name: z.string().trim().max(60).default('Color'),
    value: z.string().trim().max(80).default('#111111'),
    imageUrl: z.string().trim().max(2048).optional(),
  })
  .strict();

const ecommerceSize = z
  .object({
    label: z.string().trim().max(40).default('One size'),
    available: z.boolean().optional(),
  })
  .strict();

const ecommerceProduct = z
  .object({
    id: z.string().trim().max(64).optional(),
    name: z.string().trim().max(160).default(''),
    price: z.string().trim().max(60).optional(),
    priceQar: z.number().nonnegative().max(99_999_999).nullable().optional(),
    brand: z.string().trim().max(100).optional(),
    category: z.string().trim().max(80).optional(),
    tag: z.string().trim().max(80).optional(),
    imageUrl: z.string().trim().max(2048).optional(),
    images: z.array(z.string().trim().max(2048)).max(8).optional(),
    description: z.string().trim().max(420).optional(),
    details: z.array(z.string().trim().max(120)).max(8).optional(),
    colors: z.array(ecommerceColor).max(8).optional(),
    sizes: z.array(ecommerceSize).max(12).optional(),
    href: z.string().trim().max(2048).optional(),
    available: z.boolean().optional(),
    status: z.enum(['active', 'draft', 'sold_out']).optional(),
    createdAt: z.string().trim().max(80).optional(),
    isCustomizable: z.boolean().optional(),
    customizationLabel: z.string().trim().max(48).nullable().optional(),
    allowCustomSize: z.boolean().optional(),
    requiresHeightInput: z.boolean().optional(),
    heightInputLabel: z.string().trim().max(40).nullable().optional(),
    heightOptions: z.array(z.string().trim().max(40)).max(24).optional(),
  })
  .strict();

const ecommerceCategory = z
  .object({
    id: z.string().trim().max(64).optional(),
    label: z.string().trim().max(100).default(''),
    tag: z.string().trim().max(100).optional(),
    imageUrl: z.string().trim().max(2048).optional(),
    href: z.string().trim().max(2048).optional(),
  })
  .strict();

const ecommerceBlockProps = z
  .object({
    eyebrow: z.string().trim().max(80).optional(),
    title: z.string().trim().max(220).optional(),
    subtitle: z.string().trim().max(420).optional(),
    cta: ctaSchema.optional(),
    productIds: z.array(z.string().uuid()).max(24).optional(),
    products: z.array(ecommerceProduct).max(12).optional(),
    categories: z.array(ecommerceCategory).max(12).optional(),
    tabs: z.array(z.string().trim().max(40)).max(8).optional(),
  })
  .strict();

/**
 * Per-block schema map. The discriminated-union schema below pivots on
 * `type` to apply the right `props` validator.
 */
export const blockPropsByType = {
  hero: heroProps,
  banner: bannerProps,
  text: textProps,
  image: imageProps,
  gallery: galleryProps,
  productGrid: productGridProps,
  productList: productListProps,
  featuredProduct: featuredProductProps,
  serviceList: serviceListProps,
  menu: menuProps,
  calendar: calendarProps,
  contactCard: contactCardProps,
  inquireCta: inquireCtaProps,
  spacer: spacerProps,
  divider: dividerProps,
  drop: dropProps,
  animatedText: animatedTextProps,
  animatedImage: animatedImageProps,
  productCardStack: productCardStackProps,
  tiltImage: tiltImageProps,
  spotlightCard: spotlightCardProps,
  productPromoCard: productPromoCardProps,
  mawid: mawidProps,
  taqim: taqimProps,
  depthShowcase: depthShowcaseProps,
  auroraRibbon: auroraRibbonProps,
  showcase1: showcase1Props,
  showcase2: showcase2Props,
  showcase3: showcase3Props,
  showcase4: showcase4Props,
  showcase5: showcase5Props,
  ecommerce1: ecommerceBlockProps,
  ecommerce2: ecommerceBlockProps,
  ecommerce3: ecommerceBlockProps,
  ecommerce4: ecommerceBlockProps,
  ecommerce5: ecommerceBlockProps,
  ecommerce6: ecommerceBlockProps,
  ecommerce7: ecommerceBlockProps,
} as const;

const baseBlock = {
  id: z.string().uuid(),
  style: styleSchema,
};

export const blockSchema = z.discriminatedUnion('type', [
  z.object({ ...baseBlock, type: z.literal('hero'), props: heroProps }),
  z.object({ ...baseBlock, type: z.literal('banner'), props: bannerProps }),
  z.object({ ...baseBlock, type: z.literal('text'), props: textProps }),
  z.object({ ...baseBlock, type: z.literal('image'), props: imageProps }),
  z.object({ ...baseBlock, type: z.literal('gallery'), props: galleryProps }),
  z.object({ ...baseBlock, type: z.literal('productGrid'), props: productGridProps }),
  z.object({ ...baseBlock, type: z.literal('productList'), props: productListProps }),
  z.object({ ...baseBlock, type: z.literal('featuredProduct'), props: featuredProductProps }),
  z.object({ ...baseBlock, type: z.literal('serviceList'), props: serviceListProps }),
  z.object({ ...baseBlock, type: z.literal('menu'), props: menuProps }),
  z.object({ ...baseBlock, type: z.literal('calendar'), props: calendarProps }),
  z.object({ ...baseBlock, type: z.literal('contactCard'), props: contactCardProps }),
  z.object({ ...baseBlock, type: z.literal('inquireCta'), props: inquireCtaProps }),
  z.object({ ...baseBlock, type: z.literal('spacer'), props: spacerProps }),
  z.object({ ...baseBlock, type: z.literal('divider'), props: dividerProps }),
  z.object({ ...baseBlock, type: z.literal('drop'), props: dropProps }),
  z.object({ ...baseBlock, type: z.literal('animatedText'), props: animatedTextProps }),
  z.object({ ...baseBlock, type: z.literal('animatedImage'), props: animatedImageProps }),
  z.object({
    ...baseBlock,
    type: z.literal('productCardStack'),
    props: productCardStackProps,
  }),
  z.object({ ...baseBlock, type: z.literal('tiltImage'), props: tiltImageProps }),
  z.object({
    ...baseBlock,
    type: z.literal('spotlightCard'),
    props: spotlightCardProps,
  }),
  z.object({
    ...baseBlock,
    type: z.literal('productPromoCard'),
    props: productPromoCardProps,
  }),
  z.object({ ...baseBlock, type: z.literal('mawid'), props: mawidProps }),
  z.object({ ...baseBlock, type: z.literal('taqim'), props: taqimProps }),
  z.object({
    ...baseBlock,
    type: z.literal('depthShowcase'),
    props: depthShowcaseProps,
  }),
  z.object({
    ...baseBlock,
    type: z.literal('auroraRibbon'),
    props: auroraRibbonProps,
  }),
  z.object({ ...baseBlock, type: z.literal('showcase1'), props: showcase1Props }),
  z.object({ ...baseBlock, type: z.literal('showcase2'), props: showcase2Props }),
  z.object({ ...baseBlock, type: z.literal('showcase3'), props: showcase3Props }),
  z.object({ ...baseBlock, type: z.literal('showcase4'), props: showcase4Props }),
  z.object({ ...baseBlock, type: z.literal('showcase5'), props: showcase5Props }),
  z.object({ ...baseBlock, type: z.literal('ecommerce1'), props: ecommerceBlockProps }),
  z.object({ ...baseBlock, type: z.literal('ecommerce2'), props: ecommerceBlockProps }),
  z.object({ ...baseBlock, type: z.literal('ecommerce3'), props: ecommerceBlockProps }),
  z.object({ ...baseBlock, type: z.literal('ecommerce4'), props: ecommerceBlockProps }),
  z.object({ ...baseBlock, type: z.literal('ecommerce5'), props: ecommerceBlockProps }),
  z.object({ ...baseBlock, type: z.literal('ecommerce6'), props: ecommerceBlockProps }),
  z.object({ ...baseBlock, type: z.literal('ecommerce7'), props: ecommerceBlockProps }),
]);

export const blocksSchema = z.array(blockSchema).max(200);

export const themeOverridesSchema = z
  .object({
    palette: z.enum(PALETTE_IDS).optional(),
    // Bumped from 64 → 4096 in 2026-04 to accept full CSS background
    // shorthand strings from the pattern library (multi-layer
    // gradients + inline SVG data-URIs). Existing storefronts whose
    // `pageBg` is a 7-char hex like `#1f1b16` validate unchanged; the
    // wider bound is a strict superset.
    pageBg: z.string().trim().max(4096).optional(),
    backgroundEffect: z.enum(BACKGROUND_EFFECTS).optional(),
    cursorEffect: z.enum(CURSOR_EFFECTS).optional(),
    headingWeight: z.union([z.literal(400), z.literal(500), z.literal(600)]).optional(),
    sectionSpacing: z.enum(['tight', 'comfortable', 'spacious']).optional(),
    policyDisplayMode: z.enum(['full', 'columns']).optional(),
    themeBehaviour: z.enum(['auto', 'light', 'dark']).optional(),
    seo: z
      .object({
        title: z.string().trim().max(140).optional(),
        description: z.string().trim().max(260).optional(),
        ogImage: z.string().trim().max(2048).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type ParsedBlock = z.infer<typeof blockSchema>;
export type ParsedBlocks = z.infer<typeof blocksSchema>;
export type ParsedThemeOverrides = z.infer<typeof themeOverridesSchema>;

/** Cheap runtime guard for the `BLOCK_TYPES` const. */
export function isBlockType(v: unknown): v is (typeof BLOCK_TYPES)[number] {
  return typeof v === 'string' && (BLOCK_TYPES as readonly string[]).includes(v);
}
