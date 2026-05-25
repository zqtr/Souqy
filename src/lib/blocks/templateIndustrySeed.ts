import type { BusinessType, Storefront, TemplateId } from '@/lib/brief';
import type { ProductWriteInput } from '@/lib/products';
import { getSeedImage } from '@/lib/products/seedImages';

/**
 * Demo product seed shape used at `/begin` and on template switch.
 *
 * The shape omits `imageUrl` because the static `INDUSTRY_BASE` and
 * `DEMOS` tables in `demoProducts.ts` don't know which template they
 * end up under — image URLs are stamped later by `withTemplateImages`
 * and `getSeedImage` (template + index → palette-matched SVG under
 * `public/seed-products/`). External CDNs (Unsplash) have been retired
 * to keep first-run storefronts fully offline-capable.
 *
 * Carries an optional Arabic pair so the seeder can pick the right copy
 * for the storefront's locale.
 */
export type SeedProduct = Omit<ProductWriteInput, 'imageUrl'> & {
  titleAr: string | null;
  descriptionAr: string | null;
};

/** Seed row after `withTemplateImages` has stamped a real image URL. */
export type SeedProductWithImage = SeedProduct & { imageUrl: string };

export type TemplateIndustrySeed = {
  eyebrow: string;
  title: string;
  tagline: string;
  manifesto: string;
  ctaLabel: string;
  inquiryTitle: string;
  inquiryBody: string;
  primaryCategory: string;
  secondaryCategory: string;
  tertiaryCategory: string;
  menuCategories: [string, string, string];
  serviceItems: Array<{ id: string; title: string; description: string; priceQar?: number }>;
  products: SeedProductWithImage[];
};

type IndustrySeedBase = Omit<TemplateIndustrySeed, 'eyebrow' | 'title' | 'tagline' | 'products'> & {
  products: SeedProduct[];
};

const DEFAULT_PRODUCTS: SeedProduct[] = [
  product('Signal Edition', 'A polished flagship offer tuned for launch-week conversion.', 420, '1523275335684-37898b6baf30', 'featured',
    { title: 'إصدار سيغنال', description: 'عرض رائد مصقول مُعَدّ لتحقيق أعلى التحويلات في أسبوع الإطلاق.' }),
  product('Orbit Bundle', 'A compact bundle for buyers who want the complete system.', 690, '1558655146-d09347e92766', 'featured',
    { title: 'حزمة أوربت', description: 'حزمة متكاملة للمشترين الذين يريدون النظام كاملاً.' }),
  product('Field Kit', 'A practical entry offer with premium packaging and support.', 260, '1516321318423-f06f85e504b3', 'new',
    { title: 'طقم البداية', description: 'عرض دخول عملي بتغليف فاخر ودعم كامل.' }),
  product('Private Build', 'A made-to-order experience for clients who want the best version.', 1200, '1497366754035-f200968a6e72', 'private',
    { title: 'تجربة خاصة', description: 'تجربة حسب الطلب للعملاء الذين يبحثون عن أرقى نسخة.' }),
  product('Studio Pass', 'Priority access, seasonal updates, and a direct founder line.', 180, '1518005020951-eccb494ad742', 'access',
    { title: 'بطاقة الاستوديو', description: 'دخول مبكر، تحديثات موسمية، وقناة مباشرة مع المؤسس.' }),
  product('Collector Set', 'Limited run, numbered, and prepared for gifting.', 860, '1524758631624-e2822e304c36', 'limited',
    { title: 'مجموعة المقتنين', description: 'إصدار محدود مرقّم، جاهز للإهداء.' }),
];

const INDUSTRY_BASE: Partial<Record<BusinessType, IndustrySeedBase>> = {
  graphic_design: {
    manifesto:
      'A design system should feel alive before anyone opens the proposal. Every product here is packaged like a launch asset: clear scope, fast delivery, and enough visual force to make the brand feel inevitable.',
    ctaLabel: 'Start a brief',
    inquiryTitle: 'Send the brief. We map the visual system.',
    inquiryBody:
      'Share the brand name, audience, deadline, and references. We reply with the sharpest next step.',
    primaryCategory: 'identity',
    secondaryCategory: 'campaigns',
    tertiaryCategory: 'motion',
    menuCategories: ['identity', 'campaigns', 'motion'],
    serviceItems: [
      {
        id: 'svc-identity',
        title: 'Brand identity sprint',
        description: 'Logo direction, color system, type pairing, and launch-ready guidelines.',
        priceQar: 1900,
      },
      {
        id: 'svc-campaign',
        title: 'Social campaign kit',
        description: 'Nine posts, three story frames, and a reusable visual rule set.',
        priceQar: 1200,
      },
      {
        id: 'svc-motion',
        title: 'Motion logo system',
        description: 'A short animated mark, transitions, and export-ready loops.',
        priceQar: 1700,
      },
    ],
    products: [
      product('Brand Identity Sprint', 'Logo, palette, type system, and compact guidelines in one focused sprint.', 1900, '1542744173-8e7e53415bb0', 'identity'),
      product('Launch Poster Kit', 'Three campaign posters shaped for print, web, and storefront launch.', 850, '1500530855697-b586d89ba3ee', 'campaigns'),
      product('Social Grid System', 'A modular feed system with reusable layouts and bilingual caption rhythm.', 950, '1618005198919-d3d4b5a92ead', 'campaigns'),
      product('Motion Logo Loop', 'A premium animated mark for reels, headers, and launch teasers.', 1500, '1535223289827-42f1e9919769', 'motion'),
      product('Packaging Visuals', 'Mockups, label language, and product-ready art direction.', 1300, '1512295767273-ac109ac3acfa', 'identity'),
      product('Pitch Deck Skin', 'A branded presentation system for launches, investor calls, and sales.', 1100, '1557804506-669a67965ba0', 'campaigns'),
    ],
  },
  cafe: {
    manifesto:
      'The page should feel like the first minute at the counter: warm, exact, and easy to order from. Menus become panels, specials become moments, and reservations stay one tap away.',
    ctaLabel: 'Reserve',
    inquiryTitle: 'Book the table or ask the counter.',
    inquiryBody: 'Tell us the date, party size, or menu question. We confirm quickly.',
    primaryCategory: 'starters',
    secondaryCategory: 'mains',
    tertiaryCategory: 'drinks',
    menuCategories: ['starters', 'mains', 'drinks'],
    serviceItems: [
      { id: 'svc-table', title: 'Table reservation', description: 'Dinner, dessert, or a quiet work table.', priceQar: 0 },
      { id: 'svc-catering', title: 'Office catering', description: 'Morning trays, lunch boxes, and drink service.', priceQar: 420 },
      { id: 'svc-private', title: 'Private tasting', description: 'A guided table for small groups.', priceQar: 650 },
    ],
    products: [
      product('Midnight Date Latte', 'Cold milk, espresso, Khalas date, and a cardamom finish.', 32, '1461023058943-07fcbe16d735', 'drinks'),
      product('Labneh Cloud Toast', 'Whipped labneh, zaatar oil, warm bread, and herbs.', 42, '1495474472287-4d71bcdd2085', 'starters'),
      product('Coal-Seared Halloumi', 'Charred halloumi, citrus, and pomegranate glaze.', 48, '1525610553991-2bede1a236e2', 'starters'),
      product('Pearl District Pasta', 'Creamy saffron sauce, mushrooms, and parmesan.', 78, '1473093295043-cdd812d0e601', 'mains'),
      product('Slow Lamb Bowl', 'Braised lamb, rice, yoghurt, and crisp onion.', 88, '1517248135467-4c7edcad34c4', 'mains'),
      product('Rose Spark Lemonade', 'Rose, lemon, mint, and sparkling water.', 28, '1503454537195-1dcabb73ffb9', 'drinks'),
    ],
  },
  perfume_oud: {
    manifesto:
      'Fragrance sells through atmosphere. The template should make each bottle feel collectible: notes first, material story second, and a private consultation always within reach.',
    ctaLabel: 'Request a scent',
    inquiryTitle: 'Find the note that stays.',
    inquiryBody: 'Tell us what you usually wear and the occasion. We suggest the right scent profile.',
    primaryCategory: 'oud',
    secondaryCategory: 'musk',
    tertiaryCategory: 'gift',
    menuCategories: ['oud', 'musk', 'gift'],
    serviceItems: [
      { id: 'svc-layering', title: 'Scent layering consult', description: 'A guided pairing of oud, musk, and citrus notes.', priceQar: 150 },
      { id: 'svc-gift', title: 'Gift concierge', description: 'Packaging, note card, and same-day local delivery.', priceQar: 80 },
      { id: 'svc-private', title: 'Private blend', description: 'A personal blend session for a signature scent.', priceQar: 900 },
    ],
    products: [
      product('Oud Signal 01', 'Smoked oud, amber resin, and a clean mineral finish.', 390, '1595425964071-2c1ecdd4b8a8', 'oud'),
      product('Musk Interface', 'White musk, iris, and polished woods for daily wear.', 290, '1592945403244-b3fbafd7f539', 'musk'),
      product('Amber Circuit', 'Warm amber, saffron, vanilla, and a late-night trail.', 340, '1608571423902-eed4a5ad8108', 'oud'),
      product('Rose Cache', 'Taif rose, soft musk, and a crystalline citrus edge.', 310, '1615634260167-c8cdede054de', 'musk'),
      product('Discovery Set', 'Five 3ml profiles packed for gifting or travel.', 180, '1606760227091-3dd870d97f1d', 'gift'),
      product('Majlis Gift Box', 'Oud, room spray, and incense in a premium box.', 620, '1607344645866-009c320b63e0', 'gift'),
    ],
  },
  photography: {
    manifesto:
      'Photography needs negative space, motion, and a direct route to commissions. Prints, sessions, and editorial assignments should feel like one coherent body of work.',
    ctaLabel: 'Book a shoot',
    inquiryTitle: 'Commission the next image.',
    inquiryBody: 'Send the date, location, and usage. We reply with availability and a clean quote.',
    primaryCategory: 'prints',
    secondaryCategory: 'sessions',
    tertiaryCategory: 'commissions',
    menuCategories: ['prints', 'sessions', 'commissions'],
    serviceItems: [
      { id: 'svc-portrait', title: 'Portrait session', description: 'One hour, controlled light, 15 edited images.', priceQar: 950 },
      { id: 'svc-product', title: 'Product shoot', description: 'Studio image set for ecommerce and campaigns.', priceQar: 1600 },
      { id: 'svc-editorial', title: 'Editorial day rate', description: 'Eight hours, location planning, 60 edited selects.', priceQar: 3800 },
    ],
    products: [
      product('Edition Print · Dune Line', 'Archival pigment print, signed and numbered.', 480, '1500530855697-b586d89ba3ee', 'prints'),
      product('Edition Print · Night Road', 'Fine-art print on cotton rag paper.', 520, '1518684079-3c830dcef090', 'prints'),
      product('Portrait Session', 'One hour, controlled light, 15 edited images.', 950, '1522204538344-922f76ecc041', 'sessions'),
      product('Product Image Set', 'Ecommerce and campaign-ready image pack.', 1600, '1524758631624-e2822e304c36', 'sessions'),
      product('Editorial Day Rate', 'A full-day assignment with planning and 60 selects.', 3800, '1462332420958-a05d1e002413', 'commissions'),
      product('Retouching Pass', 'Clean retouching for ten selected images.', 450, '1497366754035-f200968a6e72', 'commissions'),
    ],
  },
  clothing_store: {
    manifesto:
      'Fashion commerce needs quick sizing confidence, strong product photography, and room for capsules. The storefront treats every piece like a shoppable edit with clear prices and a fast route to inquiry.',
    ctaLabel: 'Shop the edit',
    inquiryTitle: 'Ask about size, fit, or styling.',
    inquiryBody: 'Send the piece name, size, and delivery area. We reply with availability and styling notes.',
    primaryCategory: 'new edit',
    secondaryCategory: 'sets',
    tertiaryCategory: 'accessories',
    menuCategories: ['new edit', 'sets', 'accessories'],
    serviceItems: [
      { id: 'svc-fit', title: 'Fit consult', description: 'Sizing and styling guidance before checkout.', priceQar: 0 },
      { id: 'svc-tailor', title: 'Alteration pass', description: 'Simple length or fit adjustment.', priceQar: 90 },
      { id: 'svc-gift', title: 'Gift wrap', description: 'Premium packaging and personal note.', priceQar: 45 },
    ],
    products: [
      product('Pearl Overshirt', 'Structured overshirt with a soft washed finish.', 340, '1515886657613-9f3515b0c78f', 'new edit'),
      product('Weekend Linen Set', 'Two-piece linen set made for warm evenings.', 520, '1529139574466-a303027c1d8b', 'sets'),
      product('Column Dress', 'Minimal evening dress with a clean straight line.', 620, '1485230895905-ec40ba36b9bc', 'new edit'),
      product('Studio Tote', 'Heavy canvas tote with internal laptop sleeve.', 180, '1516762689617-e1cffcef479d', 'accessories'),
      product('Soft Tailored Trouser', 'Relaxed trouser with a premium drape.', 390, '1506629905607-d405d7d3b0d2', 'sets'),
      product('Gift Card', 'A digital card for the next collection drop.', 250, '1512436991641-6745cdb1723f', 'accessories'),
    ],
  },
  ecommerce: {
    manifesto:
      'A general online store still needs a point of view. This seed creates clear shelves, a promotion moment, and practical product cards so the catalogue feels ready to sell from day one.',
    ctaLabel: 'Browse products',
    inquiryTitle: 'Need help choosing?',
    inquiryBody: 'Tell us what you are shopping for and the delivery area. We send the right recommendation.',
    primaryCategory: 'featured',
    secondaryCategory: 'bundles',
    tertiaryCategory: 'new',
    menuCategories: ['featured', 'bundles', 'new'],
    serviceItems: [
      { id: 'svc-gift', title: 'Gift concierge', description: 'Bundle selection, wrapping, and delivery note.', priceQar: 70 },
      { id: 'svc-priority', title: 'Priority delivery', description: 'Faster local dispatch when available.', priceQar: 45 },
      { id: 'svc-custom', title: 'Custom order', description: 'A tailored bundle built from the catalogue.', priceQar: 300 },
    ],
    products: DEFAULT_PRODUCTS,
  },
  home_kitchen: {
    manifesto:
      'Home and kitchen products sell best when buyers can picture the set in use. The template leads with bundles, practical categories, and warm product language.',
    ctaLabel: 'Build a set',
    inquiryTitle: 'Plan the table or kitchen shelf.',
    inquiryBody: 'Share the occasion, color direction, and quantity. We recommend the right set.',
    primaryCategory: 'table',
    secondaryCategory: 'kitchen',
    tertiaryCategory: 'gifts',
    menuCategories: ['table', 'kitchen', 'gifts'],
    serviceItems: [
      { id: 'svc-table', title: 'Table set consult', description: 'Pick a complete table direction.', priceQar: 0 },
      { id: 'svc-gift', title: 'Gift packing', description: 'Ready-to-gift wrapping and card.', priceQar: 50 },
      { id: 'svc-event', title: 'Event bundle', description: 'Grouped pieces for dinners and gatherings.', priceQar: 700 },
    ],
    products: [
      product('Stoneware Dinner Set', 'Four-place set with plates, bowls, and serving dish.', 480, '1517870843067-4c62c687eaa2', 'table'),
      product('Brass Coffee Tray', 'Polished tray sized for majlis service.', 260, '1512917774080-9991f1c4c750', 'table'),
      product('Ceramic Spice Jars', 'Set of six labeled jars with a matte glaze.', 210, '1556911220-bda9f7f7597e', 'kitchen'),
      product('Weekend Hosting Box', 'Candles, linen napkins, and table accents.', 390, '1513519245088-0e12902e5a38', 'gifts'),
      product('Marble Prep Board', 'Heavy stone board for prep or serving.', 320, '1514986888952-8cd320577b68', 'kitchen'),
      product('Tea Pairing Gift', 'Tea glasses, spoon set, and presentation box.', 240, '1523906630133-f6934a1ab2b9', 'gifts'),
    ],
  },
};

const TEMPLATE_COPY: Record<TemplateId, { eyebrow: string; title: string; tagline: string }> = {
  atrium: {
    eyebrow: 'executive commerce os · نظام إدارة التجارة',
    title: 'A premium store with an operator’s spine.',
    tagline: 'Trust cues, featured offers, and a curated catalogue arranged for serious buyers.',
  },
  souqline: {
    eyebrow: 'fast market · سوق سريع',
    title: 'Browse fast. Choose faster.',
    tagline: 'Dense category lanes, product cards, and promo rhythm for high-volume selling.',
  },
  kiosk: {
    eyebrow: 'launch lab · مختبر الإطلاق',
    title: 'One offer, staged like a release.',
    tagline: 'Drop story, waitlist intent, related products, and a buyer path built for momentum.',
  },
  lounge: {
    eyebrow: 'minimal checkout · دفع مختصر',
    title: 'A quiet shop that removes every extra step.',
    tagline: 'Monochrome product rows, bundle logic, and a checkout path that stays visible.',
  },
  studio: {
    eyebrow: 'service shop · متجر خدمات',
    title: 'Services packaged like products.',
    tagline: 'Bookable offers, calendar rhythm, add-ons, and inquiry capture in one flow.',
  },
  bazaar: {
    eyebrow: 'drop engine · محرك الدروب',
    title: 'Limited editions with a live pulse.',
    tagline: 'Collection shelves, urgency modules, and seasonal commerce for capsule launches.',
  },
  vitrine: {
    eyebrow: 'product suite · حزمة المنتج',
    title: 'Premium offers arranged like a product suite.',
    tagline: 'Comparison-style proof, high-intent CTAs, and Max+ commerce blocks for complex offers.',
  },
  monoline: {
    eyebrow: 'hospitality commerce · تجارة الضيافة',
    title: 'A menu, a shop, and a reservation path.',
    tagline: 'Food, sets, gifts, local delivery, and booking intent with refined pacing.',
  },
  harvest: {
    eyebrow: 'maker supply · توريد الصانع',
    title: 'Material stories, made shoppable.',
    tagline: 'Provenance, process, bundles, and an artisan catalogue that feels ready to buy.',
  },
  launchpad: {
    eyebrow: 'digital store · متجر رقمي',
    title: 'Sell the offer like software.',
    tagline: 'Digital packs, service tiers, feature-led products, and demo-ready conversion points.',
  },
  frame: {
    eyebrow: 'portfolio shop · متجر الأعمال',
    title: 'A gallery that knows how to sell.',
    tagline: 'Prints, assets, sessions, and commissions presented with gallery-led restraint.',
  },
};

export function getTemplateIndustrySeed(
  templateId: TemplateId,
  businessType: BusinessType,
  storefront?: Pick<Storefront, 'businessName' | 'tagline'>,
): TemplateIndustrySeed {
  const base = INDUSTRY_BASE[businessType] ?? {
    manifesto:
      'A modern storefront should explain the offer quickly, then reward a slower look. The page pairs premium surfaces with practical buying paths so the brand feels considered without becoming hard to use.',
    ctaLabel: 'Start an inquiry',
    inquiryTitle: 'Tell us what you need.',
    inquiryBody:
      'Send a short note with timing, budget, and the product or service you are considering. We reply with a clear next step.',
    primaryCategory: 'featured',
    secondaryCategory: 'new',
    tertiaryCategory: 'private',
    menuCategories: ['featured', 'new', 'private'] as [string, string, string],
    serviceItems: [
      {
        id: 'svc-consult',
        title: 'Consultation',
        description: 'A focused first session to choose the right product or service.',
        priceQar: 150,
      },
      {
        id: 'svc-build',
        title: 'Custom package',
        description: 'A tailored bundle shaped around the buyer, timeline, and use case.',
        priceQar: 900,
      },
      {
        id: 'svc-priority',
        title: 'Priority support',
        description: 'Faster replies, guided handoff, and launch-week support.',
        priceQar: 300,
      },
    ],
    products: DEFAULT_PRODUCTS,
  };
  const template = TEMPLATE_COPY[templateId];
  return {
    ...base,
    products: withTemplateImages(base.products, templateId),
    ...template,
    tagline: storefront?.tagline?.trim() || template.tagline,
  };
}

/**
 * Build a single seed row. The fifth argument (`_imageId`) is the
 * pre-2026-05 Unsplash photo id, kept in the signature so existing
 * callers don't have to rearrange. It is ignored — `imageUrl` is left
 * empty here and filled by `withTemplateImages` once the templateId
 * (which `INDUSTRY_BASE` doesn't know about) becomes available.
 *
 * Pass an optional `ar` pair to provide an Arabic locale variant. When
 * absent, the seeder falls back to the English text for `ar` storefronts
 * — preferable to a hard error during the create-storefront hot path.
 */
function product(
  title: string,
  description: string,
  priceQar: number,
  _imageId: string,
  category: string,
  ar?: { title: string; description: string },
): SeedProduct {
  return {
    title,
    description,
    titleAr: ar?.title ?? null,
    descriptionAr: ar?.description ?? null,
    priceQar,
    category,
    eventAt: null,
    status: 'active',
  };
}

/**
 * Stamp a template-keyed image URL onto every seed row by index. Lets
 * the static `INDUSTRY_BASE` entries stay templateId-agnostic — the
 * resolver (`getTemplateIndustrySeed`) knows the active templateId and
 * paints images on the way out. Five SVGs per template; rows beyond
 * index 4 wrap modularly via `getSeedImage`.
 */
export function withTemplateImages(
  rows: SeedProduct[],
  templateId: TemplateId,
): SeedProductWithImage[] {
  return rows.map((row, index) => ({
    ...row,
    imageUrl: getSeedImage(templateId, index),
  }));
}
