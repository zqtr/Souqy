import { randomUUID } from 'node:crypto';
import type { Storefront, TemplateId } from '@/lib/brief';
import type { Block } from './types';
import { getTemplateIndustrySeed } from './templateIndustrySeed';

// Stable hotlinked Unsplash CDN URLs. Verified live (2026-04) — see the
// per-template `*_HERO`, `*_BANNER`, `*_ANIM` constants below for the
// exact photo ids in use. Picsum is the fallback for grids/galleries
// where the photo is just decorative; its URL is stable by `seed`.
const unsplash = (id: string, w = 1600, q = 80) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=${q}`;

const picsum = (seed: string, w = 1200, h = 800) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

// ── Per-template themed image bank. Heroes / banners / animatedImages
// use Unsplash so the photo carries the template's identity. Galleries
// use Picsum because the slot is decorative and the founder is expected
// to swap each tile to their own work.

// Executive OS / atrium — premium commerce operating shell
const ATRIUM_HERO = unsplash('1490481651871-ab68de25d43d');

// Fast Market / souqline — Doha-wide delivery / market scene
const SOUQ_BANNER = unsplash('1473093226795-af9932fe5856');

// Launch Lab / kiosk — terracotta-tinted launch bench
const WORKSHOP_HERO = unsplash('1556909114-f6e7ad7d3136');
const WORKSHOP_ANIM = unsplash('1542816417-0983c9c9ad53');

// Minimal Checkout / lounge — pure-monochrome commerce scene
const MONO_HERO = unsplash('1493857671505-72967e2e2760');

// Hospitality Commerce / monoline — refined table setting
const WAJBA_IMAGE = unsplash('1414235077428-338989a2e8c0');

// Maker Supply / harvest — material provenance scene
const KHOR_HERO = unsplash('1500382017468-9049fed747ef');
const KHOR_BANNER = unsplash('1497436072909-60f360e1d4b1');

// Drop Engine / bazaar — olive-brass lookbook + drop banner
const BAZAAR_ANIM = unsplash('1581338834647-b0fb40704e21');
const BAZAAR_BANNER = unsplash('1485968579580-b6d095142e6e');

// Product Suite / vitrine — polished banner cover
const ZUBARA_BANNER = unsplash('1469334031218-e382a71b716b');

// Digital Store / launchpad — sun-dune digital offer hero
const ZIKREET_ANIM = unsplash('1454789415558-bdda08f4eabb');

// Portfolio Shop / frame — dark fine-art kenburns
const ORYX_ANIM = unsplash('1518684079-3c830dcef090');

/**
 * Seed a builder draft from an existing storefront row.
 *
 * Called the first time a founder opens the builder for a storefront
 * whose `draft_blocks` is empty. The seed is keyed strictly on
 * **template** so the /begin templates produce visibly distinct
 * first-runs — and match the realistic preview the founder picked
 * inside the intake.
 *
 *   - atrium    → editorial boutique:    hero + product mosaic + gallery + contact + inquire
 *   - souqline  → dense market grid:     hero strip + productGrid(12) + banner + productList + contact
 *   - kiosk     → single-product launch: featuredProduct + hero + lookbook + productList(4) + inquire
 *   - lounge    → hospitality / cafe:    hero + 3 menu blocks (by categorySlug) + gallery + contact
 *   - studio    → services + bookings:   hero + serviceList placeholders + calendar + grid + inquire + contact
 *   - bazaar    → lookbook + drops:      gallery + drop + grid by categorySlug + banner + list + contact
 *   - vitrine   → editorial fashion:     banner + hero + serif manifesto + 4-up gallery + lookbook grid + grouped list + contact + inquire
 *   - monoline  → minimalist studio:     centered hero + serif manifesto + spacer + wide image + divider + minimal grid + spacer + ghost inquire + contact
 *   - harvest   → artisan marketplace:   banner hero + workshop story + process gallery + lookbook grid + grouped list + delivery banner + contact + inquire
 *   - launchpad → tech / SaaS:           animatedText hero + features text + cards grid + animatedText cue + list(3) + inquire + contact
 *   - frame     → photography portfolio: animatedImage hero + sub-hero + 4-up gallery + featured stacked + prints grid + commissions text + inquire + contact
 *
 * **Critical contract** (enforced by code review): every product-bearing
 * block in this file must leave its data props empty (`items` undefined,
 * `productId` undefined) so the runtime falls back to real `products`.
 * The only inline content allowed is hero/banner/contactCard copy,
 * gallery image placeholders, drop schedule placeholders, and
 * serviceList placeholder rows (per `types.ts` serviceList ignores DB).
 *
 * Block ids are fresh UUIDs every call; callers must persist immediately
 * to make ids stable across reloads. Founders can rearrange or swap any
 * block from the dashboard once the draft is saved.
 */
export function bootBlocksFromStorefront(s: Storefront): Block[] {
  const template: TemplateId = s.templateId ?? 'atrium';
  switch (template) {
    case 'souqline':
      return seedSouqline(s);
    case 'kiosk':
      return seedKiosk(s);
    case 'lounge':
      return seedLounge(s);
    case 'studio':
      return seedStudio(s);
    case 'bazaar':
      return seedBazaar(s);
    case 'vitrine':
      return seedVitrine(s);
    case 'monoline':
      return seedMonoline(s);
    case 'harvest':
      return seedHarvest(s);
    case 'launchpad':
      return seedLaunchpad(s);
    case 'frame':
      return seedFrame(s);
    case 'atrium':
    default:
      return seedAtrium(s);
  }
}

// Stable Picsum seeds make the gallery feel populated out of the box
// (every founder sees the same neutral plates per template). The
// renderer still handles empty `imageUrl`s for legacy / hand-cleared
// rows so a founder who deletes every photo doesn't get a broken page.
function picsumGallery(template: string, count: number) {
  return Array.from({ length: count }).map((_, i) => ({
    imageUrl: picsum(`souqna-${template}-${i + 1}`, 1200, 1500),
    alt: '',
    caption: '',
  }));
}

// ============================================================================
// Atrium — editorial boutique. Full-bleed hero, asymmetric product
// mosaic (via the lookbook product-grid layout), category-grouped
// product list as the "sticky" rail, captioned gallery, contact, inquire.
// ============================================================================

function seedAtrium(s: Storefront): Block[] {
  const seed = getTemplateIndustrySeed('atrium', s.businessType, s);
  const inquireId = randomUUID();
  return [
    {
      id: randomUUID(),
      type: 'hero',
      props: {
        eyebrow: seed.eyebrow,
        title: seed.title,
        tagline: seed.tagline,
        layout: 'banner',
        backgroundUrl: ATRIUM_HERO,
        showLogo: true,
        showGlyph: false,
        showFounder: true,
        cta: {
          label: seed.ctaLabel,
          href: '#',
          scrollTo: inquireId,
        },
      },
      style: { paddingY: 'xl', align: 'center', variant: 'pro-silk' },
    },
    {
      id: randomUUID(),
      type: 'productGrid',
      props: {
        layout: 'lookbook',
        columns: 3,
        categorySlug: seed.primaryCategory,
        showInquire: true,
      },
      style: { paddingY: 'lg' },
    },
    {
      id: randomUUID(),
      type: 'text',
      props: {
        eyebrow: 'operator view',
        heading: 'A commerce workspace buyers can trust.',
        body: seed.manifesto,
        align: 'start',
        emphasis: 'serif',
      },
      style: { paddingY: 'lg' },
    },
    {
      id: randomUUID(),
      type: 'productList',
      props: {
        groupByCategory: true,
        showImages: true,
        showPrices: true,
        categorySlug: seed.secondaryCategory,
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'gallery',
      props: {
        columns: 3,
        aspect: '4/5',
        items: picsumGallery('diwan', 6),
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'contactCard',
      props: {
        showPhone: true,
        showArea: true,
        showHours: true,
        showInstagram: true,
      },
      style: { paddingY: 'md' },
    },
    {
      id: inquireId,
      type: 'inquireCta',
      props: {
        eyebrow: 'visit · inquire',
        title: seed.inquiryTitle,
        body: seed.inquiryBody,
        label: seed.ctaLabel,
        variant: 'primary',
        align: 'center',
      },
      style: { paddingY: 'lg', variant: 'pro-chroma' },
    },
  ];
}

// ============================================================================
// Souqline — dense market grid, RTL-first. Hero strip, big product grid
// (limit 12), evocative chip strip (text), banner, "new arrivals"
// product list, contact card.
// ============================================================================

function seedSouqline(s: Storefront): Block[] {
  const seed = getTemplateIndustrySeed('souqline', s.businessType, s);
  return [
    {
      id: randomUUID(),
      type: 'hero',
      props: {
        eyebrow: seed.eyebrow,
        title: seed.title,
        tagline: seed.tagline,
        layout: 'inline',
        showLogo: true,
        showGlyph: true,
        showFounder: false,
      },
      style: { paddingY: 'lg', variant: 'pro-bars' },
    },
    {
      id: randomUUID(),
      type: 'productGrid',
      props: {
        layout: 'cards',
        columns: 4,
        limit: 12,
        categorySlug: seed.primaryCategory,
        showInquire: true,
      },
      style: { paddingY: 'sm' },
    },
    {
      id: randomUUID(),
      type: 'text',
      props: {
        eyebrow: 'scan lanes · مسارات التصفح',
        heading: 'Fast categories, zero dead ends.',
        body:
          `${seed.primaryCategory} / ${seed.secondaryCategory} / ${seed.tertiaryCategory}. The storefront opens like a compact buying dashboard, then lets the buyer slow down where it matters.`,
        align: 'start',
        emphasis: 'plain',
      },
      style: {
        paddingY: 'sm',
        paddingX: 'md',
        bg: 'gold',
        textColor: 'ink',
      },
    },
    {
      id: randomUUID(),
      type: 'banner',
      props: {
        imageUrl: SOUQ_BANNER,
        alt: 'Doha-wide delivery',
        overlayTitle: 'Doha-wide delivery · توصيل في الدوحة',
        overlaySubtitle: seed.manifesto,
        align: 'start',
        scrim: 'soft',
      },
      style: { paddingY: 'md', variant: 'pro-halftone' },
    },
    {
      id: randomUUID(),
      type: 'productList',
      props: {
        groupByCategory: false,
        showImages: true,
        showPrices: true,
        limit: 8,
        categorySlug: seed.secondaryCategory,
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'contactCard',
      props: {
        showPhone: true,
        showArea: true,
        showHours: true,
        showInstagram: true,
      },
      style: { paddingY: 'md' },
    },
  ];
}

// ============================================================================
// Kiosk — single-product launch. Featured product (no productId, falls
// back to first active), large full-bleed hero, lookbook gallery, "more
// from us" product list (limit 4), inquire CTA.
// ============================================================================

function seedKiosk(s: Storefront): Block[] {
  const seed = getTemplateIndustrySeed('kiosk', s.businessType, s);
  const inquireId = randomUUID();
  return [
    // Pro+ template — leads with motion while keeping Max+ premium
    // commerce blocks out of the seed.
    {
      id: randomUUID(),
      type: 'animatedImage',
      props: {
        imageUrl: WORKSHOP_ANIM,
        alt: 'Cinematic launch object',
        caption: '',
        effect: 'kenburns',
        intensity: 'subtle',
        aspect: '16/9',
        width: 'full',
      },
      style: { paddingY: 'lg', variant: 'pro-metallic' },
    },
    {
      id: randomUUID(),
      type: 'animatedText',
      props: {
        eyebrow: seed.eyebrow,
        text: seed.title,
        effect: 'kinetic',
        speed: 'medium',
        align: 'center',
        emphasis: 'display',
      },
      style: { paddingY: 'md', align: 'center' },
    },
    {
      id: randomUUID(),
      type: 'featuredProduct',
      props: {
        layout: 'split',
        categorySlug: seed.primaryCategory,
      },
      style: { paddingY: 'lg' },
    },
    {
      id: randomUUID(),
      type: 'hero',
      props: {
        eyebrow: 'launch window · نافذة الإطلاق',
        title: seed.title,
        tagline: seed.tagline,
        layout: 'banner',
        backgroundUrl: WORKSHOP_HERO,
        showLogo: false,
        showGlyph: true,
        showFounder: false,
        cta: {
          label: seed.ctaLabel,
          href: '#',
          scrollTo: inquireId,
        },
      },
      style: { paddingY: 'xl', align: 'center', variant: 'pro-grain' },
    },
    {
      id: randomUUID(),
      type: 'productList',
      props: {
        categorySlug: seed.secondaryCategory,
        showPrices: true,
        limit: 4,
      },
      style: { paddingY: 'lg' },
    },
    {
      id: randomUUID(),
      type: 'gallery',
      props: {
        columns: 2,
        aspect: '4/5',
        items: picsumGallery('workshop', 4),
      },
      style: { paddingY: 'lg' },
    },
    {
      id: randomUUID(),
      type: 'productList',
      props: {
        groupByCategory: false,
        showImages: true,
        showPrices: true,
        limit: 4,
      },
      style: { paddingY: 'md' },
    },
    {
      id: inquireId,
      type: 'inquireCta',
      props: {
        eyebrow: 'press · acquisition · waitlist',
        title: seed.inquiryTitle,
        body: seed.inquiryBody,
        label: seed.ctaLabel,
        variant: 'primary',
        align: 'center',
      },
      style: { paddingY: 'lg' },
    },
  ];
}

// ============================================================================
// Lounge — hospitality / cafe. Hero + three menu blocks each pinned to
// a different category via `categorySlug` (props.items intentionally
// empty so the DB drives every row), gallery, contact card with hours.
//
// The category slugs below are the conventional starting set the
// dashboard creates for new lounges; if the founder renames or removes
// them, the menu falls back to all products in the category-text path.
// ============================================================================

function seedLounge(s: Storefront): Block[] {
  const seed = getTemplateIndustrySeed('lounge', s.businessType, s);
  return [
    {
      id: randomUUID(),
      type: 'hero',
      props: {
        eyebrow: seed.eyebrow,
        title: seed.title,
        tagline: seed.tagline,
        layout: 'banner',
        backgroundUrl: MONO_HERO,
        showLogo: true,
        showGlyph: true,
        showFounder: true,
      },
      style: { paddingY: 'lg', align: 'center', variant: 'pro-chroma' },
    },
    {
      id: randomUUID(),
      type: 'menu',
      props: {
        heading: seed.menuCategories[0],
        groupByCategory: false,
        categorySlug: seed.menuCategories[0],
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'menu',
      props: {
        heading: seed.menuCategories[1],
        groupByCategory: false,
        categorySlug: seed.menuCategories[1],
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'menu',
      props: {
        heading: seed.menuCategories[2],
        groupByCategory: false,
        categorySlug: seed.menuCategories[2],
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'gallery',
      props: {
        columns: 3,
        aspect: '1/1',
        items: picsumGallery('mono', 6),
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'contactCard',
      props: {
        showPhone: true,
        showArea: true,
        showHours: true,
        showInstagram: true,
        heading: seed.inquiryTitle,
        body: seed.inquiryBody,
      },
      style: { paddingY: 'md' },
    },
  ];
}

// ============================================================================
// Studio — services + bookings. Hero, serviceList with three placeholder
// rows for the founder to fill (per types.ts serviceList ignores DB),
// calendar block (heading only), productGrid filtered by
// `categorySlug='services'` for extras, inquireCta, contactCard.
// ============================================================================

function seedStudio(s: Storefront): Block[] {
  const seed = getTemplateIndustrySeed('studio', s.businessType, s);
  const inquireId = randomUUID();
  return [
    {
      id: randomUUID(),
      type: 'hero',
      props: {
        eyebrow: seed.eyebrow,
        title: seed.title,
        tagline: seed.tagline,
        layout: 'centered',
        showLogo: false,
        showGlyph: false,
        showFounder: true,
      },
      style: { paddingY: 'lg', align: 'center', variant: 'pro-halftone' },
    },
    {
      id: randomUUID(),
      type: 'serviceList',
      props: {
        heading: 'Service modules',
        showInquire: true,
        items: seed.serviceItems,
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'calendar',
      props: {
        heading: 'Next two weeks',
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'productGrid',
      props: {
        layout: 'cards',
        columns: 3,
        categorySlug: seed.primaryCategory,
        showInquire: true,
      },
      style: { paddingY: 'md' },
    },
    {
      id: inquireId,
      type: 'inquireCta',
      props: {
        eyebrow: 'book · ask',
        title: seed.inquiryTitle,
        body: seed.inquiryBody,
        label: seed.ctaLabel,
        variant: 'primary',
        align: 'center',
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'contactCard',
      props: {
        showPhone: true,
        showArea: true,
        showHours: true,
        showInstagram: true,
      },
      style: { paddingY: 'md' },
    },
  ];
}

// ============================================================================
// Bazaar — lookbook + drops. Gallery hero, `drop` block (dropId blank
// until the founder creates one in the Drop Manager app), productGrid
// by categorySlug for "featured collections", banner, productList,
// contact card.
// ============================================================================

function seedBazaar(s: Storefront): Block[] {
  const seed = getTemplateIndustrySeed('bazaar', s.businessType, s);
  const dropAnchor = randomUUID();
  return [
    // Pro template — kicks off with an animatedImage parallax over the
    // gallery so the lookbook reads as cinematic on first scroll.
    {
      id: randomUUID(),
      type: 'animatedImage',
      props: {
        imageUrl: BAZAAR_ANIM,
        alt: 'Lookbook cover',
        caption: '',
        effect: 'parallax',
        intensity: 'medium',
        aspect: '16/9',
        width: 'full',
      },
      style: { paddingY: 'lg' },
    },
    {
      id: randomUUID(),
      type: 'animatedText',
      props: {
        eyebrow: seed.eyebrow,
        text: seed.title,
        effect: 'kinetic',
        speed: 'medium',
        align: 'center',
        emphasis: 'display',
      },
      style: { paddingY: 'md', align: 'center' },
    },
    {
      id: randomUUID(),
      type: 'gallery',
      props: {
        columns: 3,
        aspect: '4/5',
        items: picsumGallery('harvest', 6),
      },
      style: { paddingY: 'lg' },
    },
    {
      id: randomUUID(),
      type: 'hero',
      props: {
        eyebrow: 'drop index',
        title: seed.title,
        tagline: seed.tagline,
        layout: 'inline',
        showLogo: true,
        showGlyph: false,
        showFounder: false,
        cta: {
          label: seed.ctaLabel,
          href: '#',
          scrollTo: dropAnchor,
        },
      },
      style: { paddingY: 'md' },
    },
    {
      id: dropAnchor,
      type: 'drop',
      props: {
        dropId: '',
        heading: 'Next signal drop',
        subheading: seed.manifesto,
      },
      style: { paddingY: 'lg' },
    },
    {
      id: randomUUID(),
      type: 'productGrid',
      props: {
        layout: 'lookbook',
        columns: 3,
        categorySlug: seed.primaryCategory,
        showInquire: true,
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'banner',
      props: {
        imageUrl: BAZAAR_BANNER,
        alt: 'Press and acquisitions',
        overlayTitle: seed.inquiryTitle,
        overlaySubtitle: seed.inquiryBody,
        align: 'start',
        scrim: 'soft',
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'productList',
      props: {
        groupByCategory: true,
        showImages: true,
        showPrices: true,
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'contactCard',
      props: {
        showPhone: true,
        showArea: true,
        showHours: true,
        showInstagram: true,
      },
      style: { paddingY: 'md' },
    },
  ];
}

// ============================================================================
// Vitrine — editorial fashion. Banner cover (overlay copy + scrim) over a
// secondary inline hero, serif manifesto, four-up lookbook gallery,
// asymmetric product mosaic (lookbook layout), grouped collection list,
// contact card, inquire CTA. Heavy on imagery + typography; product
// resolution stays runtime-driven.
// ============================================================================

function seedVitrine(s: Storefront): Block[] {
  const seed = getTemplateIndustrySeed('vitrine', s.businessType, s);
  const inquireId = randomUUID();
  return [
    {
      id: randomUUID(),
      type: 'banner',
      props: {
        imageUrl: ZUBARA_BANNER,
        alt: 'Coastal cover',
        overlayTitle: seed.title,
        overlaySubtitle: seed.tagline,
        align: 'start',
        scrim: 'soft',
        cta: {
          label: seed.ctaLabel,
          href: '#',
          scrollTo: inquireId,
        },
      },
      style: { paddingY: 'lg', variant: 'pro-silk' },
    },
    {
      id: randomUUID(),
      type: 'hero',
      props: {
        eyebrow: seed.eyebrow,
        title: seed.title,
        tagline: seed.tagline,
        layout: 'inline',
        showLogo: true,
        showGlyph: false,
        showFounder: false,
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'text',
      props: {
        eyebrow: 'suite logic · نظام العروض',
        heading: 'A premium offer system with a boardroom finish.',
        body: seed.manifesto,
        align: 'start',
        emphasis: 'serif',
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'productCardStack',
      props: {
        categorySlug: seed.primaryCategory,
        backCards: 2,
        eyebrow: 'suite focus',
        ctaLabel: seed.ctaLabel,
        scrollTo: inquireId,
      },
      style: { paddingY: 'md', variant: 'pro-metallic' },
    },
    {
      id: randomUUID(),
      type: 'gallery',
      props: {
        columns: 4,
        aspect: '4/5',
        items: picsumGallery('zubara', 8),
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'productGrid',
      props: {
        layout: 'lookbook',
        columns: 3,
        categorySlug: seed.primaryCategory,
        showInquire: true,
      },
      style: { paddingY: 'lg' },
    },
    {
      id: randomUUID(),
      type: 'productList',
      props: {
        groupByCategory: true,
        showImages: true,
        showPrices: true,
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'contactCard',
      props: {
        showPhone: true,
        showArea: true,
        showHours: true,
        showInstagram: true,
      },
      style: { paddingY: 'md' },
    },
    {
      id: inquireId,
      type: 'inquireCta',
      props: {
        eyebrow: 'fit · alterations · press',
        title: seed.inquiryTitle,
        body: seed.inquiryBody,
        label: seed.ctaLabel,
        variant: 'primary',
        align: 'center',
      },
      style: { paddingY: 'lg' },
    },
  ];
}

// ============================================================================
// Monoline — minimalist studio / agency. Quiet centered hero, serif
// manifesto, large vertical breathing room (spacer), a wide editorial
// image, glyph divider, portfolio-style minimal product grid, ghost
// inquire, contact card. Leans on the whitespace blocks (spacer,
// divider, image) that no other template currently exercises in its
// first-run.
// ============================================================================

function seedMonoline(s: Storefront): Block[] {
  const seed = getTemplateIndustrySeed('monoline', s.businessType, s);
  const inquireId = randomUUID();
  return [
    {
      id: randomUUID(),
      type: 'hero',
      props: {
        eyebrow: seed.eyebrow,
        title: seed.title,
        tagline: seed.tagline,
        layout: 'centered',
        showLogo: true,
        showGlyph: false,
        showFounder: false,
        cta: {
          label: seed.ctaLabel,
          href: '#',
          scrollTo: inquireId,
        },
      },
      style: { paddingY: 'xl', align: 'center' },
    },
    {
      id: randomUUID(),
      type: 'text',
      props: {
        eyebrow: 'hospitality note · عنّا',
        body: seed.manifesto,
        align: 'center',
        emphasis: 'serif',
      },
      style: { paddingY: 'lg' },
    },
    {
      id: randomUUID(),
      type: 'spacer',
      props: {
        size: 'xl',
      },
    },
    {
      id: randomUUID(),
      type: 'image',
      props: {
        imageUrl: WAJBA_IMAGE,
        alt: 'Hospitality commerce table',
        caption: 'A recent service moment — swap the photo and caption from the inspector.',
        aspect: '16/9',
        width: 'wide',
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'divider',
      props: {
        glyph: true,
        width: 'narrow',
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'productGrid',
      props: {
        layout: 'minimal',
        columns: 3,
        categorySlug: seed.primaryCategory,
      },
      style: { paddingY: 'lg' },
    },
    {
      id: randomUUID(),
      type: 'spacer',
      props: {
        size: 'md',
      },
    },
    {
      id: inquireId,
      type: 'inquireCta',
      props: {
        eyebrow: 'private line',
        title: seed.inquiryTitle,
        body: seed.inquiryBody,
        label: seed.ctaLabel,
        variant: 'ghost',
        align: 'center',
      },
      style: { paddingY: 'lg' },
    },
    {
      id: randomUUID(),
      type: 'contactCard',
      props: {
        showPhone: true,
        showArea: true,
        showHours: true,
        showInstagram: true,
      },
      style: { paddingY: 'md' },
    },
  ];
}

// ============================================================================
// Harvest — artisan marketplace. Banner-led hero with the maker's name
// in the founder slot, "from the workshop" serif story, process gallery
// (4 col, 1/1), lookbook product grid, grouped collection list,
// delivery banner near the bottom, contact, inquire. Earthy palette, no
// pro-only blocks — works on starter.
// ============================================================================

function seedHarvest(s: Storefront): Block[] {
  const seed = getTemplateIndustrySeed('harvest', s.businessType, s);
  const inquireId = randomUUID();
  return [
    {
      id: randomUUID(),
      type: 'hero',
      props: {
        eyebrow: seed.eyebrow,
        title: seed.title,
        tagline: seed.tagline,
        layout: 'banner',
        backgroundUrl: KHOR_HERO,
        showLogo: true,
        showGlyph: true,
        showFounder: true,
        cta: {
          label: seed.ctaLabel,
          href: '#',
          scrollTo: inquireId,
        },
      },
      style: { paddingY: 'xl', align: 'start', variant: 'pro-grain' },
    },
    {
      id: randomUUID(),
      type: 'text',
      props: {
        eyebrow: 'provenance layer',
        heading: 'Every offer has a material story.',
        body: seed.manifesto,
        align: 'start',
        emphasis: 'serif',
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'gallery',
      props: {
        columns: 4,
        aspect: '1/1',
        items: picsumGallery('khor', 8),
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'productGrid',
      props: {
        layout: 'lookbook',
        columns: 3,
        categorySlug: seed.primaryCategory,
        showInquire: true,
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'productList',
      props: {
        groupByCategory: true,
        showImages: true,
        showPrices: true,
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'banner',
      props: {
        imageUrl: KHOR_BANNER,
        alt: 'Mangrove inlet',
        overlayTitle: seed.inquiryTitle,
        overlaySubtitle: seed.inquiryBody,
        align: 'start',
        scrim: 'soft',
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'contactCard',
      props: {
        showPhone: true,
        showArea: true,
        showHours: true,
        showInstagram: true,
      },
      style: { paddingY: 'md' },
    },
    {
      id: inquireId,
      type: 'inquireCta',
      props: {
        eyebrow: 'order · ask',
        title: seed.inquiryTitle,
        body: seed.inquiryBody,
        label: seed.ctaLabel,
        variant: 'primary',
        align: 'center',
      },
      style: { paddingY: 'lg' },
    },
  ];
}

// ============================================================================
// Launchpad — tech / SaaS landing. Animated headline (kinetic, display)
// as the hero, "what you get" text intro, three-up cards grid (features
// resolve from the founder's products — most SaaS storefronts model
// each plan/feature as a product), a smaller animatedText cue mid-page,
// trimmed product list, primary inquire, contact. Pro tier — relies on
// AnimatedText, which downgrades server-side to plain text on lower
// plans so the seed never breaks for a plan downgrade.
// ============================================================================

function seedLaunchpad(s: Storefront): Block[] {
  const seed = getTemplateIndustrySeed('launchpad', s.businessType, s);
  const inquireId = randomUUID();
  return [
    // AnimatedImage hero pairs with the kinetic headline below — added
    // 2026-04 so every paid template surfaces both motion primitives
    // (workstream B). On a churned-down free plan the save-time pass
    // swaps it for a plain image.
    {
      id: randomUUID(),
      type: 'animatedImage',
      props: {
        imageUrl: ZIKREET_ANIM,
        alt: 'Sand dunes at dawn',
        caption: '',
        effect: 'parallax',
        intensity: 'medium',
        aspect: '16/9',
        width: 'full',
      },
      style: { paddingY: 'lg' },
    },
    {
      id: randomUUID(),
      // Eyebrow is fixed bilingual copy rather than `s.businessName`
      // because the eyebrow schema caps at 80 chars and businessName
      // can stretch to 160 — the brand still leads the page via the
      // storefront chrome's logo + the contactCard at the bottom.
      type: 'animatedText',
      props: {
        eyebrow: seed.eyebrow,
        text: seed.title,
        effect: 'kinetic',
        speed: 'medium',
        align: 'center',
        emphasis: 'display',
      },
      style: { paddingY: 'xl', align: 'center' },
    },
    {
      id: randomUUID(),
      type: 'text',
      props: {
        eyebrow: 'digital shelf architecture',
        heading: seed.tagline,
        body: seed.manifesto,
        align: 'center',
        emphasis: 'plain',
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'productGrid',
      props: {
        layout: 'cards',
        columns: 3,
        categorySlug: seed.primaryCategory,
        showInquire: true,
      },
      style: { paddingY: 'lg' },
    },
    {
      id: randomUUID(),
      type: 'productPromoCard',
      props: {
        categorySlug: seed.primaryCategory,
        width: 'wide',
        showAddToCart: true,
        accentColor: '#D4AF37',
        intensity: 'medium',
        tags: [
          { id: 'digital', label: 'Digital' },
          { id: 'max', label: 'Max+' },
        ],
      },
      style: { paddingY: 'md', variant: 'pro-chroma' },
    },
    {
      id: randomUUID(),
      type: 'animatedText',
      props: {
        eyebrow: 'why now',
        text: seed.inquiryTitle,
        effect: 'reveal',
        speed: 'medium',
        align: 'center',
        emphasis: 'body',
      },
      style: { paddingY: 'lg', align: 'center' },
    },
    {
      id: randomUUID(),
      type: 'productList',
      props: {
        groupByCategory: false,
        showImages: false,
        showPrices: true,
        limit: 3,
      },
      style: { paddingY: 'md' },
    },
    {
      id: inquireId,
      type: 'inquireCta',
      props: {
        eyebrow: 'demo · trial',
        title: seed.inquiryTitle,
        body: seed.inquiryBody,
        label: seed.ctaLabel,
        variant: 'primary',
        align: 'center',
      },
      style: { paddingY: 'lg' },
    },
    {
      id: randomUUID(),
      type: 'contactCard',
      props: {
        showPhone: true,
        showArea: false,
        showHours: true,
        showInstagram: true,
      },
      style: { paddingY: 'md' },
    },
  ];
}

// ============================================================================
// Frame — photography portfolio. Animated kenburns image as the hero
// surface, a small inline sub-hero with the studio's name, four-up
// gallery (4/5 aspect for portrait work), a featured edition stacked
// for impact, prints-grid for buyable work, a serif body for
// commissions, inquire, contact. Pro tier — relies on AnimatedImage,
// which downgrades server-side to a still on lower plans.
// ============================================================================

function seedFrame(s: Storefront): Block[] {
  const seed = getTemplateIndustrySeed('frame', s.businessType, s);
  const inquireId = randomUUID();
  return [
    {
      id: randomUUID(),
      type: 'animatedImage',
      props: {
        imageUrl: ORYX_ANIM,
        alt: 'Oryx in the morning desert',
        caption: '',
        effect: 'kenburns',
        intensity: 'subtle',
        aspect: '16/9',
        width: 'full',
      },
      style: { paddingY: 'lg', variant: 'pro-metallic' },
    },
    // Pair the kenburns image with a reveal headline so the page
    // surfaces both motion primitives (workstream B). Downgrades to a
    // plain text block on free plans via the save-time pass.
    {
      id: randomUUID(),
      type: 'animatedText',
      props: {
        eyebrow: seed.eyebrow,
        text: seed.title,
        effect: 'reveal',
        speed: 'medium',
        align: 'center',
        emphasis: 'display',
      },
      style: { paddingY: 'md', align: 'center' },
    },
    {
      id: randomUUID(),
      type: 'hero',
      props: {
        eyebrow: 'portfolio signal',
        title: seed.title,
        tagline: seed.tagline,
        layout: 'inline',
        showLogo: true,
        showGlyph: false,
        showFounder: true,
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'gallery',
      props: {
        columns: 4,
        aspect: '4/5',
        items: picsumGallery('oryx', 8),
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'featuredProduct',
      props: {
        layout: 'stacked',
        categorySlug: seed.primaryCategory,
      },
      style: { paddingY: 'lg' },
    },
    {
      id: randomUUID(),
      type: 'productPromoCard',
      props: {
        categorySlug: seed.primaryCategory,
        width: 'full',
        showAddToCart: true,
        accentColor: '#C9A961',
        intensity: 'subtle',
        tags: [
          { id: 'edition', label: 'Edition' },
          { id: 'shop', label: 'Shop' },
        ],
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'productGrid',
      props: {
        layout: 'lookbook',
        columns: 2,
        categorySlug: seed.secondaryCategory,
        showInquire: true,
      },
      style: { paddingY: 'md' },
    },
    {
      id: randomUUID(),
      type: 'text',
      props: {
        eyebrow: 'prints · commissions',
        heading: seed.inquiryTitle,
        body: seed.manifesto,
        align: 'start',
        emphasis: 'serif',
      },
      style: { paddingY: 'md' },
    },
    {
      id: inquireId,
      type: 'inquireCta',
      props: {
        eyebrow: 'commissions · editorial',
        title: seed.inquiryTitle,
        body: seed.inquiryBody,
        label: seed.ctaLabel,
        variant: 'primary',
        align: 'center',
      },
      style: { paddingY: 'lg' },
    },
    {
      id: randomUUID(),
      type: 'contactCard',
      props: {
        showPhone: true,
        showArea: true,
        showHours: false,
        showInstagram: true,
      },
      style: { paddingY: 'md' },
    },
  ];
}
