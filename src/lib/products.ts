import { cache } from 'react';
import { unstable_noStore as noStore } from 'next/cache';
import { db } from './db';
import { getStorefront } from './brief';
import { dispatchAppEventDetached } from './apps/dispatch';
import {
  type Capability,
  type Role,
  hasCapability,
  isRole,
  sanitizeCapabilities,
} from './team/capabilities';
import {
  DEFAULT_PRODUCT_HEIGHT_OPTIONS,
  normalizeHeightInputLabel,
  normalizeHeightOptions,
  normalizeSizeOptions,
} from './productOptions';

/**
 * Product catalogue per storefront.
 *
 * Generic enough to cover every archetype: a title, optional description, an
 * optional image, an optional price in QAR, an optional category (used by Menu
 * to group rows), and an optional `eventAt` consumed only by the Calendar
 * archetype. `position` drives display order; `status` lets the founder hide
 * a row without deleting it.
 */
export type ProductStatus = 'active' | 'draft' | 'sold_out';
export type PricingMode = 'one_time' | 'monthly_payment';

export type Product = {
  id: string;
  storefrontSlug: string;
  title: string;
  description: string | null;
  priceQar: number | null;
  pricingMode: PricingMode;
  monthlyPriceQar: number | null;
  imageUrl: string | null;
  category: string | null;
  eventAt: Date | null;
  status: ProductStatus;
  isCustomizable: boolean;
  customizationLabel: string | null;
  sizeOptions: string[];
  allowCustomSize: boolean;
  requiresHeightInput: boolean;
  heightInputLabel: string | null;
  heightOptions: string[];
  position: number;
  source: string;
  sourceUrl?: string | null;
  /** True when this row was inserted by `seedTemplateDemoProducts`. Drives
   *  the "remove demo content" affordance on /account/products. Stays
   *  false for everything else, including products imported via apps. */
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ProductRow = {
  id: string;
  storefront_slug: string;
  title: string;
  description: string | null;
  price_qar: string | null;
  pricing_mode?: PricingMode | null;
  monthly_price_qar?: string | null;
  image_url: string | null;
  category: string | null;
  event_at: string | null;
  status: ProductStatus;
  is_customizable?: boolean | null;
  customization_label?: string | null;
  size_options?: unknown;
  allow_custom_size?: boolean | null;
  requires_height_input?: boolean | null;
  height_input_label?: string | null;
  height_options?: unknown;
  position: number;
  source: string | null;
  source_url?: string | null;
  is_demo?: boolean | null;
  created_at: string;
  updated_at: string;
};

function parseSizeOptions(value: unknown): string[] {
  if (typeof value !== 'string') return normalizeSizeOptions(value);
  try {
    return normalizeSizeOptions(JSON.parse(value));
  } catch {
    return normalizeSizeOptions([]);
  }
}

function parseHeightOptions(value: unknown): string[] {
  if (typeof value !== 'string') return normalizeHeightOptions(value);
  try {
    return normalizeHeightOptions(JSON.parse(value));
  } catch {
    return normalizeHeightOptions([]);
  }
}

function fromRow(row: ProductRow): Product {
  const sizeOptions = parseSizeOptions(row.size_options);
  const heightOptions = parseHeightOptions(row.height_options);
  return {
    id: row.id,
    storefrontSlug: row.storefront_slug,
    title: row.title,
    description: row.description,
    priceQar: row.price_qar !== null ? Number(row.price_qar) : null,
    pricingMode: row.pricing_mode === 'monthly_payment' ? 'monthly_payment' : 'one_time',
    monthlyPriceQar:
      row.monthly_price_qar !== null && row.monthly_price_qar !== undefined
        ? Number(row.monthly_price_qar)
        : null,
    imageUrl: row.image_url,
    category: row.category,
    eventAt: row.event_at ? new Date(row.event_at) : null,
    status: row.status,
    isCustomizable: row.is_customizable === true,
    customizationLabel: row.customization_label ?? null,
    sizeOptions,
    allowCustomSize: row.allow_custom_size === true,
    requiresHeightInput: row.requires_height_input === true,
    heightInputLabel: row.height_input_label ?? null,
    heightOptions,
    position: row.position,
    source: row.source ?? 'manual',
    sourceUrl: row.source_url ?? null,
    isDemo: row.is_demo === true,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export type ProductWriteInput = {
  title: string;
  description: string | null;
  priceQar: number | null;
  pricingMode?: PricingMode;
  monthlyPriceQar?: number | null;
  imageUrl: string | null;
  category: string | null;
  eventAt: Date | null;
  status: ProductStatus;
  isCustomizable?: boolean;
  customizationLabel?: string | null;
  sizeOptions?: string[];
  allowCustomSize?: boolean;
  requiresHeightInput?: boolean;
  heightInputLabel?: string | null;
  heightOptions?: string[];
  /** Only the demo seeder sets this true. Surfaces "sample product"
   *  banners on the merchant dashboard and gates the bulk-clear action. */
  isDemo?: boolean;
  source?: string;
  sourceUrl?: string | null;
};

/**
 * Public storefront read — returns only `active` and `sold_out` products,
 * ordered for display. Drafts are owner-only.
 */
export const getPublicProducts = cache(async (slug: string): Promise<Product[]> => {
  noStore();
  const rows = (await db()`
    select * from products
    where storefront_slug = ${slug}
      and status in ('active','sold_out')
    order by position asc, created_at asc
  `) as unknown as ProductRow[];
  return rows.map(fromRow);
});

/**
 * Owner read — every row, including drafts.
 */
export async function getAllProducts(slug: string): Promise<Product[]> {
  noStore();
  const rows = (await db()`
    select * from products
    where storefront_slug = ${slug}
    order by position asc, created_at asc
  `) as unknown as ProductRow[];
  return rows.map(fromRow);
}

export async function countMerchantProducts(slug: string): Promise<number> {
  noStore();
  const rows = (await db()`
    select count(*)::int as n
    from products
    where storefront_slug = ${slug}
      and coalesce(is_demo, false) = false
  `) as unknown as { n: number }[];
  return Number(rows[0]?.n ?? 0);
}

/**
 * Cross-storefront read for the /account Products tab. Joins products
 * against the owning brief so the founder's full catalogue can be shown
 * in one list, with the storefront name attached to each row.
 *
 * Sort: newest storefront first, then per-storefront `position` so the
 * group ordering still matches what the dashboard surface shows.
 */
export type ProductWithStorefront = Product & {
  storefrontName: string;
  storefrontLocale: 'en' | 'ar';
};

export async function getProductsForUser(clerkUserId: string): Promise<ProductWithStorefront[]> {
  if (!clerkUserId) return [];
  noStore();
  const rows = (await db()`
    select p.*, b.business_name, b.locale, b.created_at as storefront_created_at
    from products p
    join briefs b on b.slug = p.storefront_slug
    where b.clerk_user_id = ${clerkUserId}
      and b.expires_at > now()
    order by b.created_at desc, p.position asc, p.created_at asc
  `) as unknown as (ProductRow & {
    business_name: string;
    locale: 'en' | 'ar';
    storefront_created_at: string;
  })[];
  return rows.map((row) => ({
    ...fromRow(row),
    storefrontName: row.business_name,
    storefrontLocale: row.locale,
  }));
}

export async function getProduct(slug: string, id: string): Promise<Product | null> {
  noStore();
  const rows = (await db()`
    select * from products
    where storefront_slug = ${slug} and id = ${id}
    limit 1
  `) as unknown as ProductRow[];
  const row = rows[0];
  return row ? fromRow(row) : null;
}

export async function insertProduct(slug: string, p: ProductWriteInput): Promise<Product> {
  // Append new products to the end of the list by default.
  const isCustomizable = p.isCustomizable === true;
  const customizationLabel = isCustomizable ? (p.customizationLabel ?? null) : null;
  const sizeOptions = JSON.stringify(normalizeSizeOptions(p.sizeOptions ?? []));
  const allowCustomSize =
    p.allowCustomSize === true && normalizeSizeOptions(p.sizeOptions ?? []).length > 0;
  const requiresHeightInput = p.requiresHeightInput === true;
  const heightInputLabel = requiresHeightInput ? normalizeHeightInputLabel(p.heightInputLabel) : null;
  const normalizedHeightOptions = normalizeHeightOptions(p.heightOptions ?? []);
  const heightOptions = JSON.stringify(
    requiresHeightInput
      ? normalizedHeightOptions.length > 0
        ? normalizedHeightOptions
        : DEFAULT_PRODUCT_HEIGHT_OPTIONS
      : [],
  );
  const tail = (await db()`
    select coalesce(max(position), -1) + 1 as next from products where storefront_slug = ${slug}
  `) as unknown as { next: number }[];
  const next = Number(tail[0]?.next ?? 0);
  const rows = (await db()`
    insert into products (
      storefront_slug, title, description, price_qar, image_url,
      pricing_mode, monthly_price_qar,
      category, event_at, status, is_customizable, customization_label, size_options, allow_custom_size,
      requires_height_input, height_input_label, height_options,
      position, is_demo, source, source_url
    ) values (
      ${slug}, ${p.title}, ${p.description}, ${p.priceQar}, ${p.imageUrl},
      ${p.pricingMode ?? 'one_time'}, ${p.monthlyPriceQar ?? null},
      ${p.category}, ${p.eventAt}, ${p.status}, ${isCustomizable}, ${customizationLabel}, ${sizeOptions}::jsonb, ${allowCustomSize},
      ${requiresHeightInput}, ${heightInputLabel}, ${heightOptions}::jsonb,
      ${next}, ${p.isDemo === true}, ${p.source ?? 'manual'}, ${p.sourceUrl ?? null}
    )
    returning *
  `) as unknown as ProductRow[];
  const row = rows[0];
  if (!row) throw new Error('insert failed');
  const product = fromRow(row);
  if (product.status !== 'draft') {
    dispatchAppEventDetached({
      kind: 'product.created',
      storefrontSlug: slug,
      product,
    });
  }
  return product;
}

export async function updateProductRow(
  slug: string,
  id: string,
  p: ProductWriteInput,
): Promise<Product | null> {
  const isCustomizable = p.isCustomizable === true;
  const customizationLabel = isCustomizable ? (p.customizationLabel ?? null) : null;
  const sizeOptions = JSON.stringify(normalizeSizeOptions(p.sizeOptions ?? []));
  const allowCustomSize =
    p.allowCustomSize === true && normalizeSizeOptions(p.sizeOptions ?? []).length > 0;
  const requiresHeightInput = p.requiresHeightInput === true;
  const heightInputLabel = requiresHeightInput ? normalizeHeightInputLabel(p.heightInputLabel) : null;
  const normalizedHeightOptions = normalizeHeightOptions(p.heightOptions ?? []);
  const heightOptions = JSON.stringify(
    requiresHeightInput
      ? normalizedHeightOptions.length > 0
        ? normalizedHeightOptions
        : DEFAULT_PRODUCT_HEIGHT_OPTIONS
      : [],
  );
  const rows = (await db()`
    update products set
      title       = ${p.title},
      description = ${p.description},
      price_qar   = ${p.priceQar},
      pricing_mode = ${p.pricingMode ?? 'one_time'},
      monthly_price_qar = ${p.monthlyPriceQar ?? null},
      image_url   = ${p.imageUrl},
      category    = ${p.category},
      event_at    = ${p.eventAt},
      status      = ${p.status},
      is_customizable = ${isCustomizable},
      customization_label = ${customizationLabel},
      size_options = ${sizeOptions}::jsonb,
      allow_custom_size = ${allowCustomSize},
      requires_height_input = ${requiresHeightInput},
      height_input_label = ${heightInputLabel},
      height_options = ${heightOptions}::jsonb,
      source_url  = ${p.sourceUrl ?? null},
      updated_at  = now()
    where storefront_slug = ${slug} and id = ${id}
    returning *
  `) as unknown as ProductRow[];
  const row = rows[0];
  return row ? fromRow(row) : null;
}

export async function deleteProductRow(slug: string, id: string): Promise<boolean> {
  const deleted = await deleteProductRowWithSnapshot(slug, id);
  return deleted !== null;
}

export async function deleteProductRowWithSnapshot(
  slug: string,
  id: string,
): Promise<Product | null> {
  const rows = (await db()`
    delete from products
    where storefront_slug = ${slug} and id = ${id}
    returning *
  `) as unknown as ProductRow[];
  const row = rows[0];
  return row ? fromRow(row) : null;
}

/**
 * Reorder products by accepting an ordered list of IDs. We rewrite the
 * `position` column for every product in the storefront in one transaction.
 */
export async function reorderProductRows(slug: string, orderedIds: string[]): Promise<void> {
  // Neon HTTP driver doesn't expose multi-statement transactions; the loop is
  // fine for our scale (a single founder, modest catalogue). Each update is
  // scoped to (slug, id) so a stale ID can't mutate someone else's row.
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    if (!id) continue;
    await db()`
      update products
      set position = ${i}, updated_at = now()
      where storefront_slug = ${slug} and id = ${id}
    `;
  }
}

/**
 * Ownership gate — every product server action calls this first. Returns the
 * storefront row if the signed-in Clerk user owns it, or null. Callers must
 * treat null as 401/403.
 */
export async function assertStorefrontOwner(slug: string, clerkUserId: string | null) {
  if (!clerkUserId) return null;
  const sf = await getStorefront(slug);
  if (!sf || sf.clerkUserId !== clerkUserId) return null;
  return sf;
}

/**
 * Shared-access gate.
 *
 * Resolves whether `clerkUserId` may exercise `capability` on `slug`.
 * Owner short-circuits the membership table: the user identified by
 * `briefs.clerk_user_id` is always treated as role='owner' with every
 * capability. Non-owners must have a row in `storefront_members` whose
 * effective capability set (role preset + jsonb overrides) grants the
 * requested capability.
 *
 * Returns null on deny so callers can mirror the existing
 * assertStorefrontOwner pattern (null → 401/403).
 */
export type StorefrontAccess =
  Awaited<ReturnType<typeof getStorefront>> extends infer SF
    ? SF extends null | undefined
      ? never
      : {
          storefront: NonNullable<SF>;
          role: Role;
          capabilities: Partial<Record<Capability, boolean>>;
        }
    : never;

export async function assertStorefrontAccess(
  slug: string,
  clerkUserId: string | null,
  capability: Capability,
): Promise<StorefrontAccess | null> {
  if (!clerkUserId) return null;
  const sf = await getStorefront(slug);
  if (!sf) return null;
  if (sf.clerkUserId === clerkUserId) {
    return { storefront: sf, role: 'owner', capabilities: {} } as StorefrontAccess;
  }
  const rows = (await db()`
    select role, capabilities
    from storefront_members
    where storefront_slug = ${slug} and clerk_user_id = ${clerkUserId}
    limit 1
  `) as Array<{ role: string; capabilities: unknown }>;
  const row = rows[0];
  if (!row || !isRole(row.role)) return null;
  const caps = sanitizeCapabilities(row.capabilities);
  if (!hasCapability({ role: row.role, capabilities: caps }, capability)) return null;
  return { storefront: sf, role: row.role, capabilities: caps } as StorefrontAccess;
}

/**
 * Bulk-clear seeded demo products. Returns the ids that were removed so
 * the caller can write a single summary audit row rather than one per
 * deletion. Scoped to a single storefront — never call without a slug.
 */
export async function deleteDemoProducts(slug: string): Promise<string[]> {
  const rows = (await db()`
    delete from products
    where storefront_slug = ${slug} and is_demo = true
    returning id
  `) as unknown as { id: string }[];
  return rows.map((row) => row.id);
}

/**
 * Top products by order count over the given window. Joins the live
 * `products` catalogue against `checkout_order_items` so a renamed or
 * deleted product still surfaces by its current row (the item's
 * `product_id` is a soft FK and goes null on delete — those orphans
 * are filtered out here).
 *
 * Drives the dashboard home "Top products" card and any future merch
 * leaderboard. The 30-day window is owned by the caller so the same
 * helper can power a 7-day or 90-day chart later.
 */
export type TopProductByOrders = {
  product: Product;
  ordersCount: number;
  revenueQar: number;
};

export async function topProductsByOrders(
  slug: string,
  sinceDays: number,
  limit = 3,
): Promise<TopProductByOrders[]> {
  noStore();
  const rows = (await db()`
    select p.*,
           count(i.id)::int as orders_count,
           coalesce(sum(i.price_qar_snapshot * i.quantity), 0)::int as revenue_qar
    from products p
    join checkout_order_items i on i.product_id = p.id
    join checkout_orders o on o.id = i.order_id
    where p.storefront_slug = ${slug}
      and o.storefront_slug = ${slug}
      and o.created_at >= now() - (${sinceDays}::int * interval '1 day')
      and o.order_status <> 'cancelled'
    group by p.id
    order by orders_count desc, revenue_qar desc
    limit ${limit}
  `) as unknown as (ProductRow & {
    orders_count: number;
    revenue_qar: number;
  })[];
  return rows.map((row) => ({
    product: fromRow(row),
    ordersCount: Number(row.orders_count ?? 0),
    revenueQar: Number(row.revenue_qar ?? 0),
  }));
}
