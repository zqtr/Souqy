import { unstable_noStore as noStore } from 'next/cache';
import { db } from './db';

/**
 * First-class categories per storefront — replaces the legacy free-text
 * `products.category` column. Migration 011 created the tables and back-
 * filled rows from any existing distinct strings, so this module is the
 * canonical read/write path going forward.
 *
 * The legacy `products.category` text column is still kept in sync by
 * `setProductCategories` so the public storefront surfaces (Menu archetype,
 * homepage filter chips) keep rendering without changes.
 */

export type Category = {
  id: string;
  storefrontSlug: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  position: number;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type CategoryRow = {
  id: string;
  storefront_slug: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  product_count?: string | number | null;
};

function fromRow(row: CategoryRow): Category {
  return {
    id: row.id,
    storefrontSlug: row.storefront_slug,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.image_url,
    position: row.position,
    productCount: row.product_count != null ? Number(row.product_count) : 0,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export type CategoryWriteInput = {
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
};

/**
 * Cross-storefront read for /account scaffolding. Joined against briefs
 * to filter by Clerk owner, with the live product count attached so the
 * Categories tab can render counts without a per-row roundtrip.
 */
export type CategoryWithStorefront = Category & {
  storefrontName: string;
};

export async function getCategoriesForUser(
  clerkUserId: string,
): Promise<CategoryWithStorefront[]> {
  if (!clerkUserId) return [];
  noStore();
  const rows = (await db()`
    select c.*,
           b.business_name,
           coalesce(pc.cnt, 0) as product_count
    from categories c
    join briefs b on b.slug = c.storefront_slug
    left join (
      select category_id, count(*) as cnt
      from product_categories
      group by category_id
    ) pc on pc.category_id = c.id
    where b.clerk_user_id = ${clerkUserId}
      and b.expires_at > now()
    order by b.created_at desc, c.position asc, c.created_at asc
  `) as unknown as (CategoryRow & { business_name: string })[];
  return rows.map((row) => ({
    ...fromRow(row),
    storefrontName: row.business_name,
  }));
}

/**
 * Build a `categorySlug → Set<productId>` map for one storefront. Used
 * by the public storefront block pipeline so product-bearing blocks can
 * filter by `categorySlug` (a stable handle) instead of a free-text
 * category match. Returns an empty map when the storefront has no
 * categories yet — every block degrades to the legacy text-match path.
 */
export async function getStorefrontCategoryProductMap(
  slug: string,
): Promise<Map<string, Set<string>>> {
  noStore();
  const rows = (await db()`
    select c.slug as category_slug, pc.product_id
    from categories c
    join product_categories pc on pc.category_id = c.id
    where c.storefront_slug = ${slug}
  `) as unknown as { category_slug: string; product_id: string }[];
  const out = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = out.get(r.category_slug) ?? new Set<string>();
    set.add(r.product_id);
    out.set(r.category_slug, set);
  }
  return out;
}

export async function getCategories(slug: string): Promise<Category[]> {
  noStore();
  const rows = (await db()`
    select c.*, coalesce(pc.cnt, 0) as product_count
    from categories c
    left join (
      select category_id, count(*) as cnt
      from product_categories
      group by category_id
    ) pc on pc.category_id = c.id
    where c.storefront_slug = ${slug}
    order by c.position asc, c.created_at asc
  `) as unknown as CategoryRow[];
  return rows.map(fromRow);
}

export async function getCategory(
  slug: string,
  id: string,
): Promise<Category | null> {
  noStore();
  const rows = (await db()`
    select c.*, coalesce(pc.cnt, 0) as product_count
    from categories c
    left join (
      select category_id, count(*) as cnt
      from product_categories
      group by category_id
    ) pc on pc.category_id = c.id
    where c.storefront_slug = ${slug} and c.id = ${id}
    limit 1
  `) as unknown as CategoryRow[];
  const row = rows[0];
  return row ? fromRow(row) : null;
}

/**
 * Returns the set of category ids currently linked to a product. Used by
 * the product modal to seed the picker chips when editing an existing
 * product.
 */
export async function getProductCategoryIds(
  productId: string,
): Promise<string[]> {
  noStore();
  const rows = (await db()`
    select category_id from product_categories where product_id = ${productId}
  `) as unknown as { category_id: string }[];
  return rows.map((r) => r.category_id);
}

export async function getProductCategoryIdsBatch(
  productIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (productIds.length === 0) return out;
  noStore();
  const rows = (await db()`
    select product_id, category_id from product_categories
    where product_id = any(${productIds})
  `) as unknown as { product_id: string; category_id: string }[];
  for (const r of rows) {
    const arr = out.get(r.product_id) ?? [];
    arr.push(r.category_id);
    out.set(r.product_id, arr);
  }
  return out;
}

export async function insertCategory(
  storefrontSlug: string,
  c: CategoryWriteInput,
): Promise<Category> {
  const tail = (await db()`
    select coalesce(max(position), -1) + 1 as next
    from categories where storefront_slug = ${storefrontSlug}
  `) as unknown as { next: number }[];
  const next = Number(tail[0]?.next ?? 0);
  const rows = (await db()`
    insert into categories (
      storefront_slug, name, slug, description, image_url, position
    ) values (
      ${storefrontSlug}, ${c.name}, ${c.slug}, ${c.description}, ${c.imageUrl}, ${next}
    )
    returning *, 0 as product_count
  `) as unknown as CategoryRow[];
  const row = rows[0];
  if (!row) throw new Error('insert failed');
  return fromRow(row);
}

export async function updateCategoryRow(
  storefrontSlug: string,
  id: string,
  c: CategoryWriteInput,
): Promise<Category | null> {
  const rows = (await db()`
    update categories set
      name        = ${c.name},
      slug        = ${c.slug},
      description = ${c.description},
      image_url   = ${c.imageUrl},
      updated_at  = now()
    where storefront_slug = ${storefrontSlug} and id = ${id}
    returning *
  `) as unknown as CategoryRow[];
  const row = rows[0];
  if (!row) return null;
  // The legacy `products.category` text column also needs to follow
  // a rename so storefront/Menu surfaces keep matching the new label.
  await db()`
    update products
    set category = ${c.name}, updated_at = now()
    from product_categories pc
    where pc.product_id = products.id
      and pc.category_id = ${id}
      and products.storefront_slug = ${storefrontSlug}
  `;
  return fromRow({ ...row, product_count: 0 });
}

export async function deleteCategoryRow(
  storefrontSlug: string,
  id: string,
): Promise<boolean> {
  // Wipe the legacy text column for any product whose ONLY category was
  // this one. If a product had multiple, we promote the next one's name.
  // Done in two steps so the SQL stays portable on the Neon HTTP driver.
  const affectedRows = (await db()`
    select pc.product_id
    from product_categories pc
    where pc.category_id = ${id}
  `) as unknown as { product_id: string }[];

  const rows = (await db()`
    delete from categories
    where storefront_slug = ${storefrontSlug} and id = ${id}
    returning id
  `) as unknown as { id: string }[];
  if (rows.length === 0) return false;

  for (const { product_id } of affectedRows) {
    const remaining = (await db()`
      select c.name
      from product_categories pc
      join categories c on c.id = pc.category_id
      where pc.product_id = ${product_id}
      order by c.position asc, c.created_at asc
      limit 1
    `) as unknown as { name: string }[];
    const nextName = remaining[0]?.name ?? null;
    await db()`
      update products
      set category = ${nextName}, updated_at = now()
      where storefront_slug = ${storefrontSlug} and id = ${product_id}
    `;
  }
  return true;
}

export async function reorderCategoryRows(
  slug: string,
  orderedIds: string[],
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    if (!id) continue;
    await db()`
      update categories
      set position = ${i}, updated_at = now()
      where storefront_slug = ${slug} and id = ${id}
    `;
  }
}

/**
 * Replace the join rows for a product. Also rewrites `products.category`
 * to the first selected category's name so legacy storefront surfaces
 * (Menu archetype, homepage chips) keep rendering without changes.
 *
 * Caller is responsible for ownership check before invoking.
 */
export async function setProductCategories(
  storefrontSlug: string,
  productId: string,
  categoryIds: string[],
): Promise<void> {
  await db()`
    delete from product_categories where product_id = ${productId}
  `;
  let firstName: string | null = null;
  if (categoryIds.length > 0) {
    // Insert in submitted order; Postgres preserves insertion timestamps
    // for free since we don't store ordering on the join itself.
    for (const cid of categoryIds) {
      await db()`
        insert into product_categories (product_id, category_id)
        values (${productId}, ${cid})
        on conflict (product_id, category_id) do nothing
      `;
    }
    const rows = (await db()`
      select name from categories
      where storefront_slug = ${storefrontSlug}
        and id = ${categoryIds[0]}
      limit 1
    `) as unknown as { name: string }[];
    firstName = rows[0]?.name ?? null;
  }
  await db()`
    update products
    set category = ${firstName}, updated_at = now()
    where storefront_slug = ${storefrontSlug} and id = ${productId}
  `;
}

/**
 * Slugify a category name. Lower-cases, replaces non-alphanumeric runs
 * with a single hyphen, and trims leading/trailing hyphens. If the
 * result is empty, falls back to `category`.
 */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'category';
}

/**
 * Resolve a unique slug per storefront. If the desired slug already
 * exists (and isn't on `excludeId`), append `-2`, `-3`, … until free.
 */
export async function uniqueSlug(
  storefrontSlug: string,
  desired: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(desired);
  let candidate = base;
  let n = 2;
  // Bounded loop — 100 attempts is fine, the founder isn't going to
  // create that many similarly-named categories in practice.
  for (let i = 0; i < 100; i++) {
    const rows = (await db()`
      select id from categories
      where storefront_slug = ${storefrontSlug} and slug = ${candidate}
      limit 1
    `) as unknown as { id: string }[];
    const taken = rows[0];
    if (!taken || taken.id === excludeId) return candidate;
    candidate = `${base}-${n++}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}
