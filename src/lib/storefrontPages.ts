import { unstable_noStore as noStore } from 'next/cache';
import { db } from './db';
import type { Block } from './blocks/types';

/**
 * Multi-page storefronts (M4 of the 2026-04 builder rebuild).
 *
 * Each storefront owns at least one `home` page; founders can add
 * additional pages for About, Lookbook, Press, etc. The block tree
 * persisted on each page is the same shape as the legacy
 * `briefs.draft_blocks` / `briefs.published_blocks` columns — which
 * remain populated by the home-page mirror so older readers (preview
 * routes, Souqy fallback, public storefront brief loaders) keep
 * functioning until the deprecation follow-up.
 *
 * Wire path:
 *   route handler / server action
 *     → src/app/actions/pages.ts (zod + auth + audit)
 *       → this file (tagged SQL only)
 *         → migration 018: storefront_pages table
 */

export type StorefrontPageStatus = 'draft' | 'published';

export type StorefrontPageSeo = {
  title: string | null;
  description: string | null;
  image: string | null;
};

export type StorefrontPage = {
  id: string;
  storefrontSlug: string;
  slug: string;
  title: string;
  draftBlocks: Block[];
  publishedBlocks: Block[] | null;
  status: StorefrontPageStatus;
  position: number;
  showInNav: boolean;
  isHome: boolean;
  seo: StorefrontPageSeo;
  createdAt: string;
  updatedAt: string;
};

/**
 * Slugs the public router owns. Builder pages cannot use these — the
 * server actions reject any attempt. `home` is included because the
 * system itself manages the home page row (created by migration 018's
 * backfill or by `seedBuilderIfEmpty`'s first-page bootstrap), not
 * the founder.
 *
 * Legal-looking slugs such as `terms`, `privacy`, `refund`, and
 * `shipping` are intentionally allowed: founders often need custom
 * policy pages at those canonical URLs. The public router falls back to
 * policy text only when no published custom page exists.
 */
export const RESERVED_PAGE_SLUGS = [
  'home',
  'checkout',
  'cart',
] as const;

export type ReservedPageSlug = (typeof RESERVED_PAGE_SLUGS)[number];

export function isReservedPageSlug(slug: string): boolean {
  return (RESERVED_PAGE_SLUGS as readonly string[]).includes(slug.toLowerCase());
}

/**
 * Lower-case → strip non `[a-z0-9]` runs into a single hyphen → trim
 * leading / trailing hyphens. Mirrors `categories.slugify` but is kept
 * local to the pages module so a future rule change here doesn't
 * accidentally break category slugs.
 */
export function normalizePageSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type StorefrontPageRow = {
  id: string;
  storefront_slug: string;
  slug: string;
  title: string;
  draft_blocks: unknown;
  published_blocks: unknown;
  status: StorefrontPageStatus;
  position: number;
  show_in_nav: boolean;
  is_home: boolean;
  seo_title: string | null;
  seo_description: string | null;
  seo_image: string | null;
  created_at: string;
  updated_at: string;
};

function parseBlocks(value: unknown): Block[] {
  if (Array.isArray(value)) return value as Block[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as Block[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseNullableBlocks(value: unknown): Block[] | null {
  if (value == null) return null;
  return parseBlocks(value);
}

function fromRow(row: StorefrontPageRow): StorefrontPage {
  return {
    id: row.id,
    storefrontSlug: row.storefront_slug,
    slug: row.slug,
    title: row.title,
    draftBlocks: parseBlocks(row.draft_blocks),
    publishedBlocks: parseNullableBlocks(row.published_blocks),
    status: row.status,
    position: row.position,
    showInNav: row.show_in_nav,
    isHome: row.is_home,
    seo: {
      title: row.seo_title,
      description: row.seo_description,
      image: row.seo_image,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPages(storefrontSlug: string): Promise<StorefrontPage[]> {
  noStore();
  const rows = (await db()`
    select * from storefront_pages
    where storefront_slug = ${storefrontSlug}
    order by is_home desc, position asc, created_at asc
  `) as unknown as StorefrontPageRow[];
  return rows.map(fromRow);
}

export async function getPageBySlug(
  storefrontSlug: string,
  pageSlug: string,
): Promise<StorefrontPage | null> {
  noStore();
  const rows = (await db()`
    select * from storefront_pages
    where storefront_slug = ${storefrontSlug}
      and slug = ${pageSlug}
    limit 1
  `) as unknown as StorefrontPageRow[];
  const row = rows[0];
  return row ? fromRow(row) : null;
}

export async function getHomePage(storefrontSlug: string): Promise<StorefrontPage | null> {
  noStore();
  const rows = (await db()`
    select * from storefront_pages
    where storefront_slug = ${storefrontSlug}
      and is_home = true
    limit 1
  `) as unknown as StorefrontPageRow[];
  const row = rows[0];
  return row ? fromRow(row) : null;
}

export async function getPageById(pageId: string): Promise<StorefrontPage | null> {
  noStore();
  const rows = (await db()`
    select * from storefront_pages
    where id = ${pageId}
    limit 1
  `) as unknown as StorefrontPageRow[];
  const row = rows[0];
  return row ? fromRow(row) : null;
}

/**
 * Resolve `position` for a brand-new page so it lands at the end of
 * the storefront's existing tree. Home keeps position=0; siblings
 * follow in insertion order.
 */
async function nextPagePosition(storefrontSlug: string): Promise<number> {
  const rows = (await db()`
    select coalesce(max(position), -1) + 1 as next_pos
    from storefront_pages
    where storefront_slug = ${storefrontSlug}
  `) as unknown as { next_pos: number }[];
  const next = rows[0]?.next_pos ?? 0;
  return next < 1 ? 1 : next;
}

export type CreatePageInput = {
  storefrontSlug: string;
  slug: string;
  title: string;
  /**
   * Optional source page to clone block trees + SEO from. The new page
   * always starts as a draft regardless of the source page's status —
   * publishing is an explicit, per-page step.
   */
  duplicateFromPageId?: string;
  /**
   * Internal escape hatch used by `seedBuilderIfEmpty` to create the
   * `home` row when the backfill hasn't run yet (e.g. fresh storefronts
   * created after migration 018). Founder-facing actions should leave
   * this false.
   */
  isHome?: boolean;
};

export async function createPage(input: CreatePageInput): Promise<StorefrontPage> {
  const isHome = input.isHome === true;
  const positionForHome = 0;
  const position = isHome ? positionForHome : await nextPagePosition(input.storefrontSlug);
  const showInNav = !isHome;

  const seed: {
    draftBlocks: Block[];
    publishedBlocks: Block[] | null;
    status: StorefrontPageStatus;
    seo: StorefrontPageSeo;
  } = {
    draftBlocks: [],
    publishedBlocks: null,
    status: 'draft',
    seo: { title: null, description: null, image: null },
  };

  if (input.duplicateFromPageId) {
    const source = await getPageById(input.duplicateFromPageId);
    if (source && source.storefrontSlug === input.storefrontSlug) {
      seed.draftBlocks = source.publishedBlocks ?? source.draftBlocks;
      seed.seo = { ...source.seo };
    }
  }

  const draftJson = JSON.stringify(seed.draftBlocks);
  const publishedJson = seed.publishedBlocks ? JSON.stringify(seed.publishedBlocks) : null;

  const rows = (await db()`
    insert into storefront_pages (
      storefront_slug, slug, title,
      draft_blocks, published_blocks, status,
      position, show_in_nav, is_home,
      seo_title, seo_description, seo_image
    ) values (
      ${input.storefrontSlug}, ${input.slug}, ${input.title},
      ${draftJson}::jsonb,
      ${publishedJson}::jsonb,
      ${seed.status},
      ${position}, ${showInNav}, ${isHome},
      ${seed.seo.title}, ${seed.seo.description}, ${seed.seo.image}
    )
    returning *
  `) as unknown as StorefrontPageRow[];
  const row = rows[0];
  if (!row) throw new Error('storefront_pages insert failed');
  return fromRow(row);
}

export async function renamePage(
  pageId: string,
  newTitle: string,
  newSlug?: string,
): Promise<StorefrontPage> {
  const rows = newSlug
    ? ((await db()`
        update storefront_pages
        set title = ${newTitle}, slug = ${newSlug}, updated_at = now()
        where id = ${pageId}
        returning *
      `) as unknown as StorefrontPageRow[])
    : ((await db()`
        update storefront_pages
        set title = ${newTitle}, updated_at = now()
        where id = ${pageId}
        returning *
      `) as unknown as StorefrontPageRow[]);
  const row = rows[0];
  if (!row) throw new Error('storefront_pages rename failed');
  return fromRow(row);
}

export async function deletePage(pageId: string): Promise<void> {
  await db()`
    delete from storefront_pages where id = ${pageId} and is_home = false
  `;
}

/**
 * Atomically swap the `is_home` flag — first clear the existing home
 * (if any), then set the requested page. The partial unique index
 * `storefront_pages_one_home_idx` guarantees at most one home row, so
 * the two statements together can't end up with two homes; a transient
 * "no home" window is harmless because public reads tolerate it.
 */
export async function setHomePage(storefrontSlug: string, pageId: string): Promise<void> {
  await db()`
    update storefront_pages
    set is_home = false, updated_at = now()
    where storefront_slug = ${storefrontSlug}
      and is_home = true
      and id <> ${pageId}
  `;
  await db()`
    update storefront_pages
    set is_home = true, position = 0, show_in_nav = false, updated_at = now()
    where storefront_slug = ${storefrontSlug}
      and id = ${pageId}
  `;
}

export async function reorderPages(
  storefrontSlug: string,
  pageIdsInOrder: readonly string[],
): Promise<void> {
  for (let i = 0; i < pageIdsInOrder.length; i += 1) {
    const id = pageIdsInOrder[i];
    if (!id) continue;
    await db()`
      update storefront_pages
      set position = ${i}, updated_at = now()
      where storefront_slug = ${storefrontSlug}
        and id = ${id}
    `;
  }
}

export async function togglePageInNav(
  pageId: string,
  showInNav: boolean,
): Promise<StorefrontPage> {
  const rows = (await db()`
    update storefront_pages
    set show_in_nav = ${showInNav}, updated_at = now()
    where id = ${pageId}
    returning *
  `) as unknown as StorefrontPageRow[];
  const row = rows[0];
  if (!row) throw new Error('storefront_pages toggle nav failed');
  return fromRow(row);
}

/**
 * Persist a page's draft block tree. When the page is the storefront's
 * home, mirror the new draft to `briefs.draft_blocks` so legacy
 * readers (the public renderer, the preview surface, Souqy fallback,
 * builder loaders that pre-date M4) continue to see fresh content.
 *
 * The mirror is non-critical — if the briefs update raced or failed
 * the page row is still authoritative for the new code paths. We don't
 * wrap them in a transaction because the Neon HTTP driver doesn't
 * make that ergonomic from the data layer; callers who need an
 * atomic "page + brief" guarantee can layer a transaction at the
 * action level later.
 */
export async function saveDraftBlocks(
  pageId: string,
  blocks: Block[],
): Promise<StorefrontPage> {
  const blocksJson = JSON.stringify(blocks);
  const rows = (await db()`
    update storefront_pages
    set draft_blocks = ${blocksJson}::jsonb, updated_at = now()
    where id = ${pageId}
    returning *
  `) as unknown as StorefrontPageRow[];
  const row = rows[0];
  if (!row) throw new Error('storefront_pages saveDraftBlocks failed');
  const page = fromRow(row);

  if (page.isHome) {
    await db()`
      update briefs
      set draft_blocks = ${blocksJson}::jsonb
      where slug = ${page.storefrontSlug}
    `;
  }

  return page;
}

/**
 * Copy `draft_blocks` → `published_blocks` for the page and flip its
 * status. Mirrors the home-page result onto `briefs.published_blocks`
 * + `is_published` + `published_at` so the public storefront's legacy
 * pipeline (and Souqy fallback) keep returning the latest live tree.
 */
export async function publishPage(pageId: string): Promise<StorefrontPage> {
  const rows = (await db()`
    update storefront_pages
    set published_blocks = draft_blocks,
        status           = 'published',
        updated_at       = now()
    where id = ${pageId}
    returning *
  `) as unknown as StorefrontPageRow[];
  const row = rows[0];
  if (!row) throw new Error('storefront_pages publishPage failed');
  const page = fromRow(row);

  if (page.isHome) {
    const publishedJson = JSON.stringify(page.publishedBlocks ?? []);
    await db()`
      update briefs
      set published_blocks = ${publishedJson}::jsonb,
          is_published     = true,
          published_at     = now()
      where slug = ${page.storefrontSlug}
    `;
  }

  return page;
}

export type SetPageSeoInput = {
  title?: string | null;
  description?: string | null;
  image?: string | null;
};

export async function setPageSeo(
  pageId: string,
  seo: SetPageSeoInput,
): Promise<StorefrontPage> {
  const rows = (await db()`
    update storefront_pages
    set seo_title       = ${seo.title ?? null},
        seo_description = ${seo.description ?? null},
        seo_image       = ${seo.image ?? null},
        updated_at      = now()
    where id = ${pageId}
    returning *
  `) as unknown as StorefrontPageRow[];
  const row = rows[0];
  if (!row) throw new Error('storefront_pages setPageSeo failed');
  return fromRow(row);
}

/**
 * Resolver used by page-aware builder actions: "give me the home page,
 * creating it on the fly if a freshly-provisioned storefront predates
 * the migration's backfill". Returns the row so callers can pass its
 * id to the per-page write helpers above.
 */
export async function ensureHomePage(
  storefrontSlug: string,
  seedDraftBlocks: Block[] = [],
): Promise<StorefrontPage> {
  const existing = await getHomePage(storefrontSlug);
  if (existing) return existing;
  const draftJson = JSON.stringify(seedDraftBlocks);
  const rows = (await db()`
    insert into storefront_pages (
      storefront_slug, slug, title,
      draft_blocks, published_blocks, status,
      position, show_in_nav, is_home
    ) values (
      ${storefrontSlug}, 'home', 'Home',
      ${draftJson}::jsonb, null, 'draft',
      0, false, true
    )
    on conflict (storefront_slug, slug) do update
      set is_home = true, updated_at = now()
    returning *
  `) as unknown as StorefrontPageRow[];
  const row = rows[0];
  if (!row) throw new Error('storefront_pages ensureHomePage failed');
  return fromRow(row);
}
