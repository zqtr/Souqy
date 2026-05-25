/**
 * Plan model — types, ranks and per-tier marketing copy. Pure data
 * with no DB / `server-only` dependencies, so this module is safe to
 * import from client components (the SiteInspector template picker,
 * the /settings/plan comparison strip, the BlockInspector lock chips).
 *
 * Server-side gating logic (`getPlan`, `setPlan`, `gateAtelierPro`)
 * lives in `src/lib/billing.ts` and re-exports the symbols defined
 * here, so the public API surface for any caller is `@/lib/billing`
 * unless the caller specifically needs the data-only flavour from a
 * client bundle.
 *
 * See `src/lib/billing.ts` for the full tier blurb.
 */

export type Plan = 'free' | 'starter' | 'pro' | 'atelier';
export const PLANS = ['free', 'starter', 'pro', 'atelier'] as const satisfies readonly Plan[];

/**
 * Numeric rank for tier comparisons. Higher = more capability. Use
 * `planAtLeast` rather than direct rank arithmetic at call sites — keeps
 * the gating intent obvious and lets us reorder tiers later without
 * combing the codebase for off-by-one mistakes.
 *
 * The internal IDs (`starter`, `pro`, `atelier`) are deliberately kept
 * stable across the 2026-04 rebrand to "Pro / Pro+ / Max+" so existing
 * `user_plans` rows, gates, and event props don't have to be migrated.
 * The display labels in `PLAN_LIMITS[…].label` carry the new names.
 */
export const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  atelier: 3,
};

/**
 * When true, every user passes general `planAtLeast` checks (templates,
 * integrations that key off tier) and storefront caps use the top tier.
 * Souqy uses `planUnlocksSouqy` below so it stays Pro+ gated.
 * Flip to `false` when paid limits should apply again.
 */
export const PLAN_GATES_DISABLED = false;

/**
 * Annual billing discount — applied uniformly across the three paid
 * tiers. We round each per-month annual rate to the nearest integer
 * (no QAR fractions in the UI) so the comparison strip stays clean.
 * Change once here and every surface picks it up.
 */
export const ANNUAL_DISCOUNT_PCT = 35;

export type BillingCycle = 'monthly' | 'annual';
export type PlanAnalyticsLevel = 'none' | 'basic' | 'advanced';
export type PlanIntegrationLevel = 'none' | 'basic' | 'growth' | 'advanced';
export type PlanSupportLevel = 'community' | 'email' | 'priority' | 'dedicated';

export const UPGRADE_GROWTH_TOOLS_COPY = 'Upgrade to unlock growth tools';

/**
 * Per-tier hard caps and marketing copy. The `templateCount` is derived
 * from the `tier` field on `templatePresets` (in `src/lib/templates.ts`)
 * but kept here too so the plan page can render its comparison strip
 * without importing the (much larger) templates module.
 */
export const PLAN_LIMITS: Record<
  Plan,
  {
    storefronts: number;
    productCap: number;
    monthlyOrderCap: number;
    templateCount: number;
    monthlyPriceQar: number;
    transactionFeeBps: number;
    aiCreditsMonthly: number;
    analytics: PlanAnalyticsLevel;
    integrations: PlanIntegrationLevel;
    support: PlanSupportLevel;
    canRemoveBranding: boolean;
    canUseCustomDomain: boolean;
    canUseDiscounts: boolean;
    canUseSeoSettings: boolean;
    canUseTeamMembers: boolean;
    canUseAutomationFlows: boolean;
    canUseApiAccess: boolean;
    canUseWhiteLabel: boolean;
    canUseBulkOperations: boolean;
    label: string;
    labelAr: string;
    blurb: string;
    blurbAr: string;
  }
> = {
  free: {
    storefronts: 1,
    productCap: 10,
    monthlyOrderCap: 25,
    templateCount: 1,
    monthlyPriceQar: 0,
    transactionFeeBps: 500,
    aiCreditsMonthly: 0,
    analytics: 'none',
    integrations: 'none',
    support: 'community',
    canRemoveBranding: false,
    canUseCustomDomain: false,
    canUseDiscounts: false,
    canUseSeoSettings: false,
    canUseTeamMembers: false,
    canUseAutomationFlows: false,
    canUseApiAccess: false,
    canUseWhiteLabel: false,
    canUseBulkOperations: false,
    label: 'Free',
    labelAr: 'مجاني',
    blurb:
      'Start with one branded storefront, 10 products, one template, and 25 orders per month. Upgrade to unlock growth tools.',
    blurbAr: 'متجر واحد، ثلاثة قوالب بدائية، أداة البناء كاملة. مثالي لأول مئة عملية بيع.',
  },
  starter: {
    storefronts: 2,
    productCap: Number.POSITIVE_INFINITY,
    monthlyOrderCap: Number.POSITIVE_INFINITY,
    templateCount: 5,
    monthlyPriceQar: 49,
    transactionFeeBps: 300,
    aiCreditsMonthly: 100,
    analytics: 'basic',
    integrations: 'basic',
    support: 'email',
    canRemoveBranding: true,
    canUseCustomDomain: true,
    canUseDiscounts: true,
    canUseSeoSettings: true,
    canUseTeamMembers: false,
    canUseAutomationFlows: false,
    canUseApiAccess: false,
    canUseWhiteLabel: false,
    canUseBulkOperations: false,
    label: 'Pro',
    labelAr: 'برو',
    blurb:
      'Launch with more storefronts, a custom domain, commerce templates, and email plus chat support.',
    blurbAr:
      'ثلاثة متاجر، وقوالب تجارة حديثة، ونطاقات مخصصة، ومكتبة التطبيقات الأساسية للإطلاق بالذكاء الاصطناعي.',
  },
  pro: {
    storefronts: 8,
    productCap: Number.POSITIVE_INFINITY,
    monthlyOrderCap: Number.POSITIVE_INFINITY,
    templateCount: 8,
    monthlyPriceQar: 145,
    transactionFeeBps: 100,
    aiCreditsMonthly: Number.POSITIVE_INFINITY,
    analytics: 'advanced',
    integrations: 'growth',
    support: 'priority',
    canRemoveBranding: true,
    canUseCustomDomain: true,
    canUseDiscounts: true,
    canUseSeoSettings: true,
    canUseTeamMembers: true,
    canUseAutomationFlows: true,
    canUseApiAccess: false,
    canUseWhiteLabel: false,
    canUseBulkOperations: false,
    label: 'Pro+',
    labelAr: 'برو +',
    blurb:
      'Add Souqy, AI assets, product copy, and growth apps for serious ecommerce growth.',
    blurbAr: 'عشرة متاجر، أنماط مميزة، أصول هوية ذكية، سير عمل مشغّل سوقي، وتكاملات للنمو.',
  },
  atelier: {
    storefronts: Number.POSITIVE_INFINITY,
    productCap: Number.POSITIVE_INFINITY,
    monthlyOrderCap: Number.POSITIVE_INFINITY,
    templateCount: 11,
    monthlyPriceQar: 235,
    transactionFeeBps: 0,
    aiCreditsMonthly: Number.POSITIVE_INFINITY,
    analytics: 'advanced',
    integrations: 'advanced',
    support: 'dedicated',
    canRemoveBranding: true,
    canUseCustomDomain: true,
    canUseDiscounts: true,
    canUseSeoSettings: true,
    canUseTeamMembers: true,
    canUseAutomationFlows: true,
    canUseApiAccess: true,
    canUseWhiteLabel: true,
    canUseBulkOperations: true,
    label: 'Max+',
    labelAr: 'ماكس +',
    blurb:
      'Scale operations with every template, premium blocks, monthly-payment offers, integrations, and team support.',
    blurbAr:
      'متاجر غير محدودة، كل القوالب، ٨ مكوّنات مميزة، عروض دفع شهرية، ودعم للفريق.',
  },
};

/**
 * Effective per-month price for a given tier on a given billing cycle.
 * Annual cycle applies `ANNUAL_DISCOUNT_PCT` and rounds to the nearest
 * integer QAR. Free is always 0 regardless of cycle.
 */
export function priceFor(plan: Plan, cycle: BillingCycle): number {
  const monthly = PLAN_LIMITS[plan].monthlyPriceQar;
  if (monthly === 0) return 0;
  if (cycle === 'monthly') return monthly;
  return Math.round(monthly * (1 - ANNUAL_DISCOUNT_PCT / 100));
}

/**
 * Annual total for a given tier (per-month annual price × 12). Returned
 * as an integer QAR. Useful for "billed yearly · 13,950 QAR" copy.
 */
export function annualTotalFor(plan: Plan): number {
  return priceFor(plan, 'annual') * 12;
}

/**
 * The QAR a founder saves per year by paying annually instead of
 * monthly. Used by the upsell badge on the plan page so the discount
 * lands as a concrete number rather than a percentage abstraction.
 */
export function annualSavingsFor(plan: Plan): number {
  const monthlyTotal = PLAN_LIMITS[plan].monthlyPriceQar * 12;
  return Math.max(0, monthlyTotal - annualTotalFor(plan));
}

/**
 * Tier comparison helper. Use this anywhere a feature is unlocked from
 * a given tier upward — it keeps the intent self-documenting and
 * insulates call sites from any future tier reordering.
 *
 *   planAtLeast('pro', 'pro')      // true
 *   planAtLeast('starter', 'pro')  // false
 *   planAtLeast('atelier', 'pro')  // true
 */
export function planAtLeast(plan: Plan, min: Plan): boolean {
  if (PLAN_GATES_DISABLED) return true;
  return PLAN_RANK[plan] >= PLAN_RANK[min];
}

/**
 * Souqy must remain a real Pro+ gate even while broader plan gates are
 * relaxed for launch/testing. Internal `pro` is the public "Pro +" tier.
 */
export function planUnlocksSouqy(plan: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK.pro;
}

export const PREMIUM_BLOCK_TYPES = [
  'productCardStack',
  'productPromoCard',
  'ecommerce1',
  'ecommerce2',
  'ecommerce3',
  'ecommerce4',
  'ecommerce5',
  'ecommerce6',
] as const;

export type PremiumBlockType = (typeof PREMIUM_BLOCK_TYPES)[number];

export function isPremiumBlockType(type: string): type is PremiumBlockType {
  return (PREMIUM_BLOCK_TYPES as readonly string[]).includes(type);
}

export function planUnlocksPremiumBlocks(plan: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK.pro;
}

export function planUnlocksMonthlyPayments(plan: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK.atelier;
}

export function planUnlocksBrandingRemoval(plan: Plan): boolean {
  return PLAN_LIMITS[plan].canRemoveBranding;
}

export function planUnlocksCustomDomain(plan: Plan): boolean {
  return PLAN_LIMITS[plan].canUseCustomDomain;
}

export function planUnlocksAnalytics(plan: Plan): boolean {
  return PLAN_LIMITS[plan].analytics !== 'none';
}

export function planUnlocksIntegrations(plan: Plan): boolean {
  return PLAN_LIMITS[plan].integrations !== 'none';
}

export function planUnlocksDiscounts(plan: Plan): boolean {
  return PLAN_LIMITS[plan].canUseDiscounts;
}

export function planUnlocksSeoSettings(plan: Plan): boolean {
  return PLAN_LIMITS[plan].canUseSeoSettings;
}

export function planUnlocksTeamMembers(plan: Plan): boolean {
  return PLAN_LIMITS[plan].canUseTeamMembers;
}

export function planUnlocksAutomationFlows(plan: Plan): boolean {
  return PLAN_LIMITS[plan].canUseAutomationFlows;
}

export function planUnlocksApiAccess(plan: Plan): boolean {
  return PLAN_LIMITS[plan].canUseApiAccess;
}

export function productCapForPlan(plan: Plan): number {
  if (PLAN_GATES_DISABLED) return PLAN_LIMITS.atelier.productCap;
  return PLAN_LIMITS[plan].productCap;
}

export function monthlyOrderCapForPlan(plan: Plan): number {
  if (PLAN_GATES_DISABLED) return PLAN_LIMITS.atelier.monthlyOrderCap;
  return PLAN_LIMITS[plan].monthlyOrderCap;
}

export function platformFeeBpsForPlan(plan: Plan): number {
  return PLAN_LIMITS[plan].transactionFeeBps;
}

export function platformFeeForTotal(totalQar: number, plan: Plan): number {
  const safeTotal = Math.max(0, Math.round(totalQar));
  return Math.round((safeTotal * platformFeeBpsForPlan(plan)) / 10_000);
}

export function sellerNetForTotal(totalQar: number, plan: Plan): number {
  const safeTotal = Math.max(0, Math.round(totalQar));
  return Math.max(0, safeTotal - platformFeeForTotal(safeTotal, plan));
}

export function aiCreditsForPlan(plan: Plan): number {
  return PLAN_LIMITS[plan].aiCreditsMonthly;
}

/**
 * Enforced storefront count cap for {@link plan}. When {@link PLAN_GATES_DISABLED}
 * is on, mirrors the atelier tier (unlimited).
 */
export function storefrontCapForPlan(plan: Plan): number {
  if (PLAN_GATES_DISABLED) return PLAN_LIMITS.atelier.storefronts;
  return PLAN_LIMITS[plan].storefronts;
}

/**
 * The smallest tier that includes the given feature/template. Used by
 * upsell cards to render "Available on Pro" rather than hardcoding the
 * tier name at every call site.
 */
export function planLabel(plan: Plan): string {
  return PLAN_LIMITS[plan].label;
}
