import type { PaletteId } from './palettes';
import { TEMPLATE_IDS, type TemplateId } from './brief';
import type { ThemeOverrides } from './blocks/types';
import { PLAN_LIMITS, PLAN_RANK, planAtLeast, type Plan } from './plans';

/**
 * Templates are the founder's first design choice. Each one is a
 * pre-tuned bundle of palette + typography + section rhythm + a
 * realistic block stack (see `bootBlocksFromStorefront`) that resolves
 * products from the storefront's own catalogue rather than from inline
 * mock data.
 *
 * Internal ids are DB-persisted and stable. Display labels can move
 * freely, but template ids must not: they drive saved storefront rows,
 * subscription gates, and preview routes.
 *
 * The full lineup, in picker order:
 *
 *  - **atrium** → Executive Commerce OS — boardroom-grade store shell.
 *  - **souqline** → Fast Market — dense catalogue and quick-buy rhythm.
 *  - **studio** → Service Shop — packaged services, add-ons, bookings.
 *  - **lounge** → Minimal Checkout — monochrome product list and upsell.
 *  - **monoline** → Hospitality Commerce — menu, reservation, gift sets.
 *  - **kiosk** → Launch Lab — single-product drop and notify intent.
 *  - **bazaar** → Drop Engine — limited editions and urgency modules.
 *  - **harvest** → Maker Supply — provenance, bundles, artisan catalogue.
 *  - **vitrine** → Product Suite — premium B2B/productized offers.
 *  - **launchpad** → Digital Store — software, services, digital packs.
 *  - **frame** → Portfolio Shop — gallery-led commerce.
 *
 * Migration 015 maps every retired id (atelier → atrium, bento →
 * souqline, etc.) so existing storefronts keep rendering after deploy.
 * The 2026-04 additions (vitrine, monoline, harvest, launchpad, frame)
 * are net-new — no historical row holds these ids, so no further
 * migration is required. Renaming the *labels* in 2026-04 also did not
 * require a migration since ids are unchanged.
 *
 * Founders can rearrange or swap any block via the dashboard once the
 * draft is saved.
 */
export type TemplatePreset = {
  id: TemplateId;
  palette: PaletteId;
  /** Default theme overrides applied when this template is picked. */
  theme: ThemeOverrides;
  /** Display label used by the picker UI. */
  label: string;
  /** One-line vibe description for the picker. */
  description: string;
  /** Minimum plan tier required to pick this template. The Site
   *  inspector renders locked tiles with an upsell card for users
   *  whose current plan can't reach this tier; `switchBuilderTemplate`
   *  re-validates server-side. */
  tier: Plan;
  /**
   * Optional public path to a hero thumbnail (1280×800 webp) shown by
   * the /begin picker and the Site inspector. The picker gracefully
   * renders a CSS-only gradient swatch derived from `palette` while the
   * file is missing; drop the asset at the path below to opt in.
   */
  previewImage?: string;
};

export const templatePresets: Record<TemplateId, TemplatePreset> = {
  atrium: {
    id: 'atrium',
    palette: 'pearl_ink',
    theme: {
      palette: 'pearl_ink',
      headingWeight: 400,
      sectionSpacing: 'spacious',
    },
    label: 'Executive OS · نظام الإدارة',
    description:
      'Executive Commerce OS with a refined hero, KPI-style trust strip, featured offer, curated grid, and buyer-ready inquiry path. Premium enough for consulting, products, and serious ecommerce launches.',
    tier: 'free',
    // TODO(templates): drop a 1280x800 webp here. Internal id is still
    // `atrium` for DB stability — don't rename the folder.
    previewImage: '/templates/atrium/preview.webp',
  },
  souqline: {
    id: 'souqline',
    palette: 'sand_gold',
    theme: {
      palette: 'sand_gold',
      headingWeight: 500,
      sectionSpacing: 'comfortable',
    },
    label: 'Fast Market · سوق سريع',
    description:
      'Fast Market turns a large catalogue into clean lanes: category rail, promo banner, compact product cards, visible prices, and quick-buy pacing for stores that need shoppers to scan fast.',
    tier: 'free',
    previewImage: '/templates/souqline/preview.webp',
  },
  kiosk: {
    id: 'kiosk',
    palette: 'terracotta_kiln',
    theme: {
      palette: 'terracotta_kiln',
      headingWeight: 500,
      sectionSpacing: 'spacious',
    },
    label: 'Launch Lab · مختبر الإطلاق',
    description:
      'Launch Lab is built around one hero offer: cinematic motion, featured product, waitlist-ready CTA, related products, and a drop story that makes a new release feel intentional.',
    tier: 'pro',
    previewImage: '/templates/kiosk/preview.webp',
  },
  lounge: {
    id: 'lounge',
    palette: 'bone_obsidian',
    theme: {
      palette: 'bone_obsidian',
      headingWeight: 400,
      sectionSpacing: 'comfortable',
    },
    label: 'Minimal Checkout · دفع مختصر',
    description:
      'Minimal Checkout is a sharp monochrome shop with product rows, bundle logic, gallery proof, and a frictionless contact path. Quiet, premium, and designed around conversion clarity.',
    tier: 'starter',
    previewImage: '/templates/lounge/preview.webp',
  },
  studio: {
    id: 'studio',
    palette: 'coral_play',
    theme: {
      palette: 'coral_play',
      headingWeight: 500,
      sectionSpacing: 'comfortable',
    },
    label: 'Service Shop · متجر خدمات',
    description:
      'Service Shop packages appointments, creative services, add-ons, and bookable offers into a working storefront with service cards, calendar rhythm, productized extras, and inquiry capture.',
    tier: 'free',
    previewImage: '/templates/studio/preview.webp',
  },
  bazaar: {
    id: 'bazaar',
    palette: 'olive_brass',
    theme: {
      palette: 'olive_brass',
      headingWeight: 600,
      sectionSpacing: 'tight',
    },
    label: 'Drop Engine · محرك الدروب',
    description:
      'Drop Engine is a limited-edition commerce system with motion, collection shelves, urgency modules, seasonal banners, and product grids tuned for capsules and timed releases.',
    tier: 'pro',
    previewImage: '/templates/bazaar/preview.webp',
  },
  vitrine: {
    id: 'vitrine',
    palette: 'pearl_lagoon',
    theme: {
      palette: 'pearl_lagoon',
      headingWeight: 400,
      sectionSpacing: 'spacious',
    },
    label: 'Product Suite · حزمة المنتج',
    description:
      'Product Suite is a premium B2B commerce layout with a strong suite hero, comparison-style proof, gated Max+ commerce blocks, product mosaics, and high-intent CTAs for productized offers.',
    tier: 'atelier',
    // TODO(templates): drop a 1280x800 webp here. Folder kept as `vitrine` for stability.
    previewImage: '/templates/vitrine/preview.webp',
  },
  monoline: {
    id: 'monoline',
    palette: 'maroon_bone',
    theme: {
      palette: 'maroon_bone',
      headingWeight: 500,
      sectionSpacing: 'spacious',
    },
    label: 'Hospitality Commerce · تجارة الضيافة',
    description:
      'Hospitality Commerce blends menu products, reservation CTA, gift cards, local delivery messaging, and refined editorial pacing for cafes, restaurants, and food brands.',
    tier: 'starter',
    // TODO(templates): drop a 1280x800 webp here. Folder kept as `monoline` for stability.
    previewImage: '/templates/monoline/preview.webp',
  },
  harvest: {
    id: 'harvest',
    palette: 'sage_inlet',
    theme: {
      palette: 'sage_inlet',
      headingWeight: 500,
      sectionSpacing: 'comfortable',
    },
    label: 'Maker Supply · توريد الصانع',
    description:
      'Maker Supply gives artisan products a serious commerce structure: provenance story, process gallery, bundles, grouped catalogue, delivery reassurance, and maker-led calls to action.',
    tier: 'pro',
    // TODO(templates): drop a 1280x800 webp here. Folder kept as `harvest` for stability.
    previewImage: '/templates/harvest/preview.webp',
  },
  launchpad: {
    id: 'launchpad',
    palette: 'dune_blush',
    theme: {
      palette: 'dune_blush',
      headingWeight: 600,
      sectionSpacing: 'comfortable',
    },
    label: 'Digital Store · متجر رقمي',
    description:
      'Digital Store sells software, service packs, downloads, templates, and digital offers with feature-led commerce, animated positioning, product tiers, and demo-ready CTAs.',
    tier: 'atelier',
    // TODO(templates): drop a 1280x800 webp here. Folder kept as `launchpad` for stability.
    previewImage: '/templates/launchpad/preview.webp',
  },
  frame: {
    id: 'frame',
    palette: 'midnight_emerald',
    theme: {
      palette: 'midnight_emerald',
      headingWeight: 400,
      sectionSpacing: 'spacious',
      themeBehaviour: 'dark',
    },
    label: 'Portfolio Shop · متجر الأعمال',
    description:
      'Portfolio Shop turns a gallery into a store: prints, assets, sessions, commissions, image-led product cards, and premium dark presentation for creators who sell their work.',
    tier: 'atelier',
    // TODO(templates): drop a 1280x800 webp here. Folder kept as `frame` for stability.
    previewImage: '/templates/frame/preview.webp',
  },
};

/**
 * The set of templates a given plan can pick from. Cumulative — a Pro
 * user can pick anything available to Starter or Free, plus Pro
 * exclusives. The order matches `TEMPLATE_IDS` so the picker rail
 * always renders the same lineup.
 */
export function templatesForPlan(plan: Plan): TemplateId[] {
  return TEMPLATE_IDS.filter((id) =>
    planAtLeast(plan, templatePresets[id].tier),
  );
}

/**
 * Picker order is deliberately plan-led: free options first, then Pro,
 * Pro+ and Max+. Within a tier we keep labels alphabetical so adding a
 * new paid template does not reshuffle lower-tier rows.
 */
export function compareTemplatesByTier(a: TemplateId, b: TemplateId): number {
  const ap = templatePresets[a];
  const bp = templatePresets[b];
  const rank = PLAN_RANK[ap.tier] - PLAN_RANK[bp.tier];
  if (rank !== 0) return rank;
  return ap.label.localeCompare(bp.label, 'en');
}

export function sortedTemplateIdsForPicker(ids: readonly TemplateId[] = TEMPLATE_IDS): TemplateId[] {
  return [...ids].sort(compareTemplatesByTier);
}

export function tierDisplayLabel(plan: Plan): { en: string; ar: string } {
  const limits = PLAN_LIMITS[plan];
  return { en: limits.label, ar: limits.labelAr };
}

/**
 * True when the caller's plan is at or above the template's required
 * tier. Used by the picker UI (locked tile state) and re-enforced by
 * the `switchBuilderTemplate` server action.
 */
export function isTemplateUnlocked(templateId: TemplateId, plan: Plan): boolean {
  const preset = templatePresets[templateId];
  if (!preset) return false;
  return planAtLeast(plan, preset.tier);
}

/**
 * The smallest plan that includes the given template — useful for
 * upsell copy ("Available on Pro · upgrade").
 */
export function minPlanForTemplate(templateId: TemplateId): Plan {
  return templatePresets[templateId]?.tier ?? 'starter';
}

// `PLAN_RANK` is exported here for the rare caller that needs raw
// numeric tier rank without bouncing through `@/lib/plans`. Kept as a
// passthrough rather than re-defining the constant locally.
export { PLAN_RANK };
