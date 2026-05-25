import { getAppState, setAppState, updateAppSettings } from './installed';

/**
 * Taqim plugin runtime — bundles & complete-the-look.
 *
 * A "bundle" is a small set of products sold together at a tuned price
 * (fixed total, percent off the sum, or amount off the sum), with
 * optional placement targeting (anchor product ids) and a stock
 * policy that hides the bundle when any item is out of stock.
 *
 * Settings live in `app_state` at (slug, 'taqim', 'settings') so the
 * storefront block can read every bundle in one round-trip without
 * paginating across `app_state` keys. We mirror the latest blob into
 * `installed_apps.settings` for the same single-source-of-truth reason
 * Mawid does.
 */

const APP_ID = 'taqim';
const SETTINGS_KEY = 'settings';

export type TaqimKind = 'fixed' | 'pickN' | 'fbt';
export type TaqimLayout = 'stack' | 'cards' | 'carousel';
export type TaqimRadius = 'sm' | 'md' | 'lg';
export type TaqimStockPolicy = 'hideIfAnyOOS' | 'showDisabled';

export type TaqimBundleItem = {
  productId: string;
  /** Optional variant id when the storefront's variant model lands. */
  variantId?: string;
  /** When true the item is considered required to assemble the bundle. */
  required?: boolean;
};

export type TaqimPricing =
  | { mode: 'fixed'; price: number }
  | { mode: 'percentOff'; percent: number }
  | { mode: 'amountOff'; amount: number };

export type TaqimBundle = {
  id: string;
  name: string;
  kind: TaqimKind;
  items: TaqimBundleItem[];
  /** PDP / placement targeting. When empty, the block must be placed
   *  explicitly via the builder. */
  anchorProductIds: string[];
  pricing: TaqimPricing;
  titleEn: string;
  titleAr: string;
  subtitleEn: string;
  subtitleAr: string;
  ctaEn: string;
  ctaAr: string;
  stockPolicy: TaqimStockPolicy;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TaqimAppearance = {
  layout: TaqimLayout;
  radius: TaqimRadius;
  /** CSS colour or palette token. */
  accent: string;
  /** Bilingual savings badge templates. `{amount}` is interpolated. */
  savingsTemplateEn: string;
  savingsTemplateAr: string;
};

export type TaqimSettings = {
  enabled: boolean;
  appearance: TaqimAppearance;
  bundles: TaqimBundle[];
};

export const DEFAULT_TAQIM_APPEARANCE: TaqimAppearance = {
  layout: 'cards',
  radius: 'md',
  accent: 'var(--sf-accent)',
  savingsTemplateEn: 'Save QAR {amount}',
  savingsTemplateAr: 'وفّر {amount} ريال',
};

export const DEFAULT_TAQIM_SETTINGS: TaqimSettings = {
  enabled: true,
  appearance: DEFAULT_TAQIM_APPEARANCE,
  bundles: [],
};

function isKind(v: unknown): v is TaqimKind {
  return v === 'fixed' || v === 'pickN' || v === 'fbt';
}
function isLayout(v: unknown): v is TaqimLayout {
  return v === 'stack' || v === 'cards' || v === 'carousel';
}
function isRadius(v: unknown): v is TaqimRadius {
  return v === 'sm' || v === 'md' || v === 'lg';
}
function isStockPolicy(v: unknown): v is TaqimStockPolicy {
  return v === 'hideIfAnyOOS' || v === 'showDisabled';
}

function resolvePricing(value: unknown): TaqimPricing {
  if (!value || typeof value !== 'object') return { mode: 'percentOff', percent: 10 };
  const v = value as { mode?: unknown; price?: unknown; percent?: unknown; amount?: unknown };
  if (v.mode === 'fixed') {
    return {
      mode: 'fixed',
      price: typeof v.price === 'number' && v.price >= 0 ? v.price : 0,
    };
  }
  if (v.mode === 'amountOff') {
    return {
      mode: 'amountOff',
      amount: typeof v.amount === 'number' && v.amount >= 0 ? v.amount : 0,
    };
  }
  return {
    mode: 'percentOff',
    percent:
      typeof v.percent === 'number' && v.percent >= 0 && v.percent <= 100
        ? v.percent
        : 10,
  };
}

function resolveItem(value: unknown): TaqimBundleItem | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<TaqimBundleItem>;
  if (typeof v.productId !== 'string' || !v.productId) return null;
  return {
    productId: v.productId,
    variantId: typeof v.variantId === 'string' ? v.variantId : undefined,
    required: v.required === true ? true : undefined,
  };
}

function resolveBundle(value: unknown): TaqimBundle | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<TaqimBundle>;
  if (typeof v.id !== 'string' || !v.id) return null;
  const items = Array.isArray(v.items)
    ? v.items
        .map(resolveItem)
        .filter((i): i is TaqimBundleItem => i !== null)
    : [];
  const anchors = Array.isArray(v.anchorProductIds)
    ? (v.anchorProductIds as unknown[]).filter(
        (a): a is string => typeof a === 'string' && a.length > 0,
      )
    : [];
  return {
    id: v.id,
    name: typeof v.name === 'string' ? v.name.slice(0, 120) : '',
    kind: isKind(v.kind) ? v.kind : 'fixed',
    items,
    anchorProductIds: anchors,
    pricing: resolvePricing(v.pricing),
    titleEn: typeof v.titleEn === 'string' ? v.titleEn.slice(0, 120) : '',
    titleAr: typeof v.titleAr === 'string' ? v.titleAr.slice(0, 120) : '',
    subtitleEn: typeof v.subtitleEn === 'string' ? v.subtitleEn.slice(0, 280) : '',
    subtitleAr: typeof v.subtitleAr === 'string' ? v.subtitleAr.slice(0, 280) : '',
    ctaEn: typeof v.ctaEn === 'string' && v.ctaEn ? v.ctaEn.slice(0, 60) : 'Inquire',
    ctaAr: typeof v.ctaAr === 'string' && v.ctaAr ? v.ctaAr.slice(0, 60) : 'استفسر',
    stockPolicy: isStockPolicy(v.stockPolicy) ? v.stockPolicy : 'hideIfAnyOOS',
    enabled: v.enabled !== false,
    createdAt:
      typeof v.createdAt === 'string' ? v.createdAt : new Date().toISOString(),
    updatedAt:
      typeof v.updatedAt === 'string' ? v.updatedAt : new Date().toISOString(),
  };
}

export function normaliseSettings(value: unknown): TaqimSettings {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<TaqimSettings>;
  const a = (v.appearance && typeof v.appearance === 'object'
    ? v.appearance
    : {}) as Partial<TaqimAppearance>;
  return {
    enabled: v.enabled !== false,
    appearance: {
      layout: isLayout(a.layout) ? a.layout : DEFAULT_TAQIM_APPEARANCE.layout,
      radius: isRadius(a.radius) ? a.radius : DEFAULT_TAQIM_APPEARANCE.radius,
      accent:
        typeof a.accent === 'string' && a.accent.trim()
          ? a.accent.slice(0, 64)
          : DEFAULT_TAQIM_APPEARANCE.accent,
      savingsTemplateEn:
        typeof a.savingsTemplateEn === 'string' && a.savingsTemplateEn
          ? a.savingsTemplateEn.slice(0, 80)
          : DEFAULT_TAQIM_APPEARANCE.savingsTemplateEn,
      savingsTemplateAr:
        typeof a.savingsTemplateAr === 'string' && a.savingsTemplateAr
          ? a.savingsTemplateAr.slice(0, 80)
          : DEFAULT_TAQIM_APPEARANCE.savingsTemplateAr,
    },
    bundles: Array.isArray(v.bundles)
      ? (v.bundles
          .map(resolveBundle)
          .filter((b): b is TaqimBundle => b !== null) as TaqimBundle[])
      : [],
  };
}

export async function getTaqimSettings(storefrontSlug: string): Promise<TaqimSettings> {
  try {
    const row = await getAppState(storefrontSlug, APP_ID, SETTINGS_KEY);
    return normaliseSettings(row?.value);
  } catch (err) {
    console.warn('[taqim] settings read failed', err);
    return DEFAULT_TAQIM_SETTINGS;
  }
}

export async function saveTaqimSettings(
  storefrontSlug: string,
  patch: TaqimSettings,
): Promise<TaqimSettings> {
  const next = normaliseSettings(patch);
  await setAppState(
    storefrontSlug,
    APP_ID,
    SETTINGS_KEY,
    next as unknown as Record<string, unknown>,
  );
  try {
    await updateAppSettings(
      storefrontSlug,
      APP_ID,
      next as unknown as Record<string, unknown>,
    );
  } catch (err) {
    console.warn('[taqim] mirror to installed_apps failed', err);
  }
  return next;
}

export function emptyBundle(now = new Date()): TaqimBundle {
  return {
    id: generateBundleId(),
    name: '',
    kind: 'fixed',
    items: [],
    anchorProductIds: [],
    pricing: { mode: 'percentOff', percent: 10 },
    titleEn: 'Complete the look',
    titleAr: 'أكمل الإطلالة',
    subtitleEn: '',
    subtitleAr: '',
    ctaEn: 'Inquire',
    ctaAr: 'استفسر',
    stockPolicy: 'hideIfAnyOOS',
    enabled: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function getBundleById(settings: TaqimSettings, id: string): TaqimBundle | null {
  return settings.bundles.find((b) => b.id === id) ?? null;
}

/**
 * Picks the first enabled bundle anchored to `productId`. Used by the
 * Taqim block when no `bundleId` was set in the inspector — gives
 * founders a "drop the block, it auto-picks" path on PDP-style pages.
 */
export function pickBundleForProduct(
  settings: TaqimSettings,
  productId: string,
): TaqimBundle | null {
  return (
    settings.bundles.find(
      (b) => b.enabled && b.anchorProductIds.includes(productId),
    ) ?? null
  );
}

/**
 * Sums product prices, applies the bundle's pricing mode, and returns
 * a `{ subtotal, total, savings }` triple in QAR. Negative values are
 * clamped to zero so a misconfigured discount never produces a
 * negative total on the storefront.
 */
export function computeBundleTotals(
  bundle: TaqimBundle,
  productPrices: Map<string, number>,
): { subtotal: number; total: number; savings: number } {
  let subtotal = 0;
  for (const item of bundle.items) {
    const p = productPrices.get(item.productId);
    if (typeof p === 'number') subtotal += p;
  }
  let total = subtotal;
  if (bundle.pricing.mode === 'fixed') {
    total = bundle.pricing.price;
  } else if (bundle.pricing.mode === 'percentOff') {
    total = subtotal * (1 - bundle.pricing.percent / 100);
  } else {
    total = subtotal - bundle.pricing.amount;
  }
  if (total < 0) total = 0;
  return { subtotal, total, savings: Math.max(0, subtotal - total) };
}

function generateBundleId(): string {
  const bytes = new Uint8Array(8);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
