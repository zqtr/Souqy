'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';

import { hasDb } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit';
import { assertStorefrontOwner } from '@/lib/products';
import { blocksSchema } from '@/lib/blocks/schemas';
import {
  createPage,
  deletePage,
  getPageById,
  isReservedPageSlug,
  listPages,
  normalizePageSlug,
  publishPage as publishPageRow,
  renamePage,
  reorderPages,
  saveDraftBlocks as saveDraftBlocksRow,
  setHomePage as setHomePageRow,
  setPageSeo as setPageSeoRow,
  togglePageInNav as togglePageInNavRow,
  type StorefrontPage,
} from '@/lib/storefrontPages';
import {
  UPGRADE_GROWTH_TOOLS_COPY,
  getPlan,
  planUnlocksSeoSettings,
} from '@/lib/billing';

/**
 * Multi-page builder actions (M4 of the 2026-04 builder rebuild).
 *
 * Every action follows the Souqna server-action contract:
 *
 *   1. zod-validate input.
 *   2. Clerk auth → assert storefront ownership via
 *      `assertStorefrontOwner` (the multi-tenant boundary).
 *   3. Tagged-SQL data layer (`src/lib/storefrontPages.ts`).
 *   4. `recordAudit` for every mutating verb.
 *   5. `revalidatePath` for the dashboard + public storefront.
 *
 * The home-page row is special: `saveDraftBlocks` and `publishPage` in
 * the data layer mirror writes onto `briefs.draft_blocks` /
 * `briefs.published_blocks` so legacy readers (preview routes, Souqy
 * fallback, public renderer) keep returning fresh content until the
 * deprecation follow-up.
 */

const SlugSchema = z.string().trim().min(3).max(40);
const PageIdSchema = z.string().uuid();

const PageSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .transform((v) => normalizePageSlug(v))
  .refine((v) => v.length > 0, { message: 'Slug is required.' })
  .refine((v) => /^[a-z0-9-]+$/.test(v), {
    message: 'Slug can only contain lowercase letters, numbers, and dashes.',
  });

const TitleSchema = z.string().trim().min(1).max(120);

const ListSchema = z.object({ slug: SlugSchema });

const CreatePageSchema = z.object({
  slug: SlugSchema,
  pageSlug: PageSlugSchema,
  title: TitleSchema,
  duplicateFromPageId: PageIdSchema.optional(),
});

const RenamePageSchema = z.object({
  slug: SlugSchema,
  pageId: PageIdSchema,
  title: TitleSchema,
  pageSlug: PageSlugSchema.optional(),
});

const PageRefSchema = z.object({
  slug: SlugSchema,
  pageId: PageIdSchema,
});

const ReorderPagesSchema = z.object({
  slug: SlugSchema,
  pageIdsInOrder: z.array(PageIdSchema).min(1).max(50),
});

const TogglePageInNavSchema = z.object({
  slug: SlugSchema,
  pageId: PageIdSchema,
  showInNav: z.boolean(),
});

const SavePageDraftSchema = z.object({
  slug: SlugSchema,
  pageId: PageIdSchema,
  blocks: blocksSchema,
});

const SetPageSeoSchema = z.object({
  slug: SlugSchema,
  pageId: PageIdSchema,
  seo: z
    .object({
      title: z.string().trim().max(140).nullable().optional(),
      description: z.string().trim().max(260).nullable().optional(),
      image: z.string().trim().max(2048).nullable().optional(),
    })
    .strict(),
});

export type PagesActionResult<T = StorefrontPage> =
  | { status: 'success'; page: T }
  | { status: 'success-noop' }
  | { status: 'success-list'; pages: StorefrontPage[] }
  | { status: 'error'; message: string; field?: string };

async function gate(slug: string): Promise<
  | { ok: true; userId: string; ownerUserId: string }
  | { ok: false; message: string }
> {
  if (!hasDb()) return { ok: false, message: 'Database unavailable' };
  const { userId } = await auth();
  if (!userId) return { ok: false, message: 'Forbidden' };
  const owned = await assertStorefrontOwner(slug, userId);
  if (!owned) return { ok: false, message: 'Forbidden' };
  return { ok: true, userId, ownerUserId: owned.clerkUserId };
}

async function rateGate(scope: string, limit: number): Promise<boolean> {
  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    hdrs.get('x-real-ip') ??
    'unknown';
  return rateLimit(`${scope}:${ip}`, limit, 60_000).ok;
}

function revalidateBuilderAndPublic(slug: string): void {
  revalidatePath('/account/builder');
  revalidatePath('/account');
  revalidatePath(`/account/${slug}/preview`);
  revalidatePath(`/brief/${slug}`, 'layout');
}

function firstIssueMessage(err: z.ZodError): { message: string; field?: string } {
  const issue = err.issues[0];
  if (!issue) return { message: 'Invalid request' };
  return {
    message: issue.message,
    field: issue.path.length ? issue.path.join('.') : undefined,
  };
}

/**
 * List every page for a storefront, ordered home-first then by
 * `position`. Read-only — no audit, no rate-limit beyond Clerk's own.
 */
export async function listStorefrontPages(
  input: z.input<typeof ListSchema>,
): Promise<PagesActionResult> {
  const parsed = ListSchema.safeParse(input);
  if (!parsed.success) {
    const e = firstIssueMessage(parsed.error);
    return { status: 'error', message: e.message, field: e.field };
  }
  const owner = await gate(parsed.data.slug);
  if (!owner.ok) return { status: 'error', message: owner.message };
  const pages = await listPages(parsed.data.slug);
  return { status: 'success-list', pages };
}

/**
 * Create a new page on a storefront. Reserved slugs (`home`, checkout,
 * cart) are rejected — only the system creates the `home` row, via
 * `seedBuilderIfEmpty` or migration 018's backfill. Canonical policy
 * slugs such as `terms` are founder-owned pages when explicitly created.
 *
 * `duplicateFromPageId` clones the source page's published-or-draft
 * block tree + SEO into the new page as a draft. Cross-storefront
 * duplication is silently dropped by the data layer.
 */
export async function createStorefrontPage(
  input: z.input<typeof CreatePageSchema>,
): Promise<PagesActionResult> {
  const parsed = CreatePageSchema.safeParse(input);
  if (!parsed.success) {
    const e = firstIssueMessage(parsed.error);
    return { status: 'error', message: e.message, field: e.field };
  }
  const data = parsed.data;
  if (isReservedPageSlug(data.pageSlug)) {
    return {
      status: 'error',
      message: 'That page slug is reserved. Pick another.',
      field: 'pageSlug',
    };
  }
  if (!(await rateGate('pages-create', 30))) {
    return { status: 'error', message: 'Too many requests — try again in a moment.' };
  }
  const owner = await gate(data.slug);
  if (!owner.ok) return { status: 'error', message: owner.message };

  try {
    const page = await createPage({
      storefrontSlug: data.slug,
      slug: data.pageSlug,
      title: data.title,
      duplicateFromPageId: data.duplicateFromPageId,
    });
    await recordAudit({
      storefrontSlug: data.slug,
      clerkUserId: owner.userId,
      action: 'storefront.page.create',
      targetId: page.id,
      summary: `Created page "${page.title}" (/${page.slug})`,
      meta: {
        pageId: page.id,
        pageSlug: page.slug,
        duplicatedFrom: data.duplicateFromPageId ?? null,
      },
    });
    revalidateBuilderAndPublic(data.slug);
    return { status: 'success', page };
  } catch (err) {
    if (err instanceof Error && /unique|duplicate/i.test(err.message)) {
      return {
        status: 'error',
        message: 'A page with that slug already exists.',
        field: 'pageSlug',
      };
    }
    return { status: 'error', message: 'Could not create page.' };
  }
}

/**
 * Rename and/or re-slug a page. Re-slugging is rejected for the home
 * page (its slug is system-controlled) and for any reserved target slug.
 */
export async function renameStorefrontPage(
  input: z.input<typeof RenamePageSchema>,
): Promise<PagesActionResult> {
  const parsed = RenamePageSchema.safeParse(input);
  if (!parsed.success) {
    const e = firstIssueMessage(parsed.error);
    return { status: 'error', message: e.message, field: e.field };
  }
  const data = parsed.data;
  if (data.pageSlug && isReservedPageSlug(data.pageSlug)) {
    return {
      status: 'error',
      message: 'That page slug is reserved. Pick another.',
      field: 'pageSlug',
    };
  }
  if (!(await rateGate('pages-rename', 60))) {
    return { status: 'error', message: 'Too many requests — try again in a moment.' };
  }
  const owner = await gate(data.slug);
  if (!owner.ok) return { status: 'error', message: owner.message };
  const plan = await getPlan(owner.ownerUserId);
  if (!planUnlocksSeoSettings(plan)) {
    return { status: 'error', message: `${UPGRADE_GROWTH_TOOLS_COPY}.`, field: 'seo' };
  }

  const existing = await getPageById(data.pageId);
  if (!existing || existing.storefrontSlug !== data.slug) {
    return { status: 'error', message: 'Page not found.' };
  }
  if (existing.isHome && data.pageSlug && data.pageSlug !== 'home') {
    return {
      status: 'error',
      message: 'The home page slug cannot be changed.',
      field: 'pageSlug',
    };
  }

  try {
    const page = await renamePage(data.pageId, data.title, data.pageSlug);
    await recordAudit({
      storefrontSlug: data.slug,
      clerkUserId: owner.userId,
      action: 'storefront.page.rename',
      targetId: page.id,
      summary: `Renamed page to "${page.title}"${
        data.pageSlug ? ` (/${page.slug})` : ''
      }`,
      meta: { pageId: page.id, pageSlug: page.slug },
    });
    revalidateBuilderAndPublic(data.slug);
    return { status: 'success', page };
  } catch (err) {
    if (err instanceof Error && /unique|duplicate/i.test(err.message)) {
      return {
        status: 'error',
        message: 'A page with that slug already exists.',
        field: 'pageSlug',
      };
    }
    return { status: 'error', message: 'Rename failed.' };
  }
}

/**
 * Permanently delete a non-home page. The home page can never be
 * deleted via this action; the data-layer guard double-enforces it.
 */
export async function deleteStorefrontPage(
  input: z.input<typeof PageRefSchema>,
): Promise<PagesActionResult> {
  const parsed = PageRefSchema.safeParse(input);
  if (!parsed.success) {
    const e = firstIssueMessage(parsed.error);
    return { status: 'error', message: e.message, field: e.field };
  }
  const data = parsed.data;
  if (!(await rateGate('pages-delete', 20))) {
    return { status: 'error', message: 'Too many requests — try again in a moment.' };
  }
  const owner = await gate(data.slug);
  if (!owner.ok) return { status: 'error', message: owner.message };

  const existing = await getPageById(data.pageId);
  if (!existing || existing.storefrontSlug !== data.slug) {
    return { status: 'error', message: 'Page not found.' };
  }
  if (existing.isHome) {
    return { status: 'error', message: 'The home page cannot be deleted.' };
  }

  await deletePage(data.pageId);
  await recordAudit({
    storefrontSlug: data.slug,
    clerkUserId: owner.userId,
    action: 'storefront.page.delete',
    targetId: data.pageId,
    summary: `Deleted page "${existing.title}" (/${existing.slug})`,
    meta: { pageId: data.pageId, pageSlug: existing.slug },
  });
  revalidateBuilderAndPublic(data.slug);
  return { status: 'success-noop' };
}

/**
 * Promote a page to be the storefront's home. The previous home is
 * cleared atomically by the data layer; the home swap also forces
 * `position = 0` and `show_in_nav = false` on the new home so it
 * never duplicates itself in the public nav.
 */
export async function setStorefrontHomePage(
  input: z.input<typeof PageRefSchema>,
): Promise<PagesActionResult> {
  const parsed = PageRefSchema.safeParse(input);
  if (!parsed.success) {
    const e = firstIssueMessage(parsed.error);
    return { status: 'error', message: e.message, field: e.field };
  }
  const data = parsed.data;
  if (!(await rateGate('pages-set-home', 20))) {
    return { status: 'error', message: 'Too many requests — try again in a moment.' };
  }
  const owner = await gate(data.slug);
  if (!owner.ok) return { status: 'error', message: owner.message };

  const existing = await getPageById(data.pageId);
  if (!existing || existing.storefrontSlug !== data.slug) {
    return { status: 'error', message: 'Page not found.' };
  }
  if (existing.isHome) {
    return { status: 'success-noop' };
  }

  await setHomePageRow(data.slug, data.pageId);
  await recordAudit({
    storefrontSlug: data.slug,
    clerkUserId: owner.userId,
    action: 'storefront.page.set_home',
    targetId: data.pageId,
    summary: `Set home page to "${existing.title}"`,
    meta: { pageId: data.pageId, pageSlug: existing.slug },
  });
  revalidateBuilderAndPublic(data.slug);
  return { status: 'success-noop' };
}

export async function reorderStorefrontPages(
  input: z.input<typeof ReorderPagesSchema>,
): Promise<PagesActionResult> {
  const parsed = ReorderPagesSchema.safeParse(input);
  if (!parsed.success) {
    const e = firstIssueMessage(parsed.error);
    return { status: 'error', message: e.message, field: e.field };
  }
  const data = parsed.data;
  if (!(await rateGate('pages-reorder', 60))) {
    return { status: 'error', message: 'Too many requests — try again in a moment.' };
  }
  const owner = await gate(data.slug);
  if (!owner.ok) return { status: 'error', message: owner.message };

  await reorderPages(data.slug, data.pageIdsInOrder);
  await recordAudit({
    storefrontSlug: data.slug,
    clerkUserId: owner.userId,
    action: 'storefront.page.reorder',
    targetId: data.slug,
    summary: `Reordered ${data.pageIdsInOrder.length} pages`,
    meta: { pageIds: data.pageIdsInOrder },
  });
  revalidateBuilderAndPublic(data.slug);
  return { status: 'success-noop' };
}

export async function toggleStorefrontPageInNav(
  input: z.input<typeof TogglePageInNavSchema>,
): Promise<PagesActionResult> {
  const parsed = TogglePageInNavSchema.safeParse(input);
  if (!parsed.success) {
    const e = firstIssueMessage(parsed.error);
    return { status: 'error', message: e.message, field: e.field };
  }
  const data = parsed.data;
  if (!(await rateGate('pages-toggle-nav', 60))) {
    return { status: 'error', message: 'Too many requests — try again in a moment.' };
  }
  const owner = await gate(data.slug);
  if (!owner.ok) return { status: 'error', message: owner.message };

  const existing = await getPageById(data.pageId);
  if (!existing || existing.storefrontSlug !== data.slug) {
    return { status: 'error', message: 'Page not found.' };
  }
  if (existing.isHome) {
    return {
      status: 'error',
      message: 'The home page is rendered at the storefront root, not in the nav.',
    };
  }

  const page = await togglePageInNavRow(data.pageId, data.showInNav);
  await recordAudit({
    storefrontSlug: data.slug,
    clerkUserId: owner.userId,
    action: 'storefront.page.toggle_nav',
    targetId: page.id,
    summary: `${page.showInNav ? 'Showed' : 'Hid'} "${page.title}" in nav`,
    meta: { pageId: page.id, showInNav: page.showInNav },
  });
  revalidateBuilderAndPublic(data.slug);
  return { status: 'success', page };
}

/**
 * Persist a page's draft block tree. For the home page this also
 * mirrors the draft onto `briefs.draft_blocks` so legacy readers (the
 * public storefront's brief loader, preview routes, Souqy fallback)
 * keep returning fresh content.
 */
export async function savePageDraft(
  input: z.input<typeof SavePageDraftSchema>,
): Promise<PagesActionResult> {
  const parsed = SavePageDraftSchema.safeParse(input);
  if (!parsed.success) {
    const e = firstIssueMessage(parsed.error);
    return { status: 'error', message: e.message, field: e.field };
  }
  const data = parsed.data;
  if (!(await rateGate('pages-save-draft', 240))) {
    return { status: 'error', message: 'Too many edits — try again in a moment.' };
  }
  const owner = await gate(data.slug);
  if (!owner.ok) return { status: 'error', message: owner.message };

  const existing = await getPageById(data.pageId);
  if (!existing || existing.storefrontSlug !== data.slug) {
    return { status: 'error', message: 'Page not found.' };
  }

  const page = await saveDraftBlocksRow(data.pageId, data.blocks);
  await recordAudit({
    storefrontSlug: data.slug,
    clerkUserId: owner.userId,
    action: 'storefront.page.save_draft',
    targetId: page.id,
    summary: `Saved draft on "${page.title}"`,
    meta: { pageId: page.id, pageSlug: page.slug, blockCount: page.draftBlocks.length },
  });
  revalidateBuilderAndPublic(data.slug);
  return { status: 'success', page };
}

/**
 * Promote the page's draft → published. For the home page this also
 * mirrors `published_blocks` + `is_published` + `published_at` onto
 * the briefs row.
 */
export async function publishStorefrontPage(
  input: z.input<typeof PageRefSchema>,
): Promise<PagesActionResult> {
  const parsed = PageRefSchema.safeParse(input);
  if (!parsed.success) {
    const e = firstIssueMessage(parsed.error);
    return { status: 'error', message: e.message, field: e.field };
  }
  const data = parsed.data;
  if (!(await rateGate('pages-publish', 30))) {
    return { status: 'error', message: 'Too many publishes — try again in a moment.' };
  }
  const owner = await gate(data.slug);
  if (!owner.ok) return { status: 'error', message: owner.message };

  const existing = await getPageById(data.pageId);
  if (!existing || existing.storefrontSlug !== data.slug) {
    return { status: 'error', message: 'Page not found.' };
  }

  const page = await publishPageRow(data.pageId);
  await recordAudit({
    storefrontSlug: data.slug,
    clerkUserId: owner.userId,
    action: 'storefront.page.publish',
    targetId: page.id,
    summary: `Published "${page.title}"`,
    meta: { pageId: page.id, pageSlug: page.slug, isHome: page.isHome },
  });
  revalidateBuilderAndPublic(data.slug);
  return { status: 'success', page };
}

export async function setStorefrontPageSeo(
  input: z.input<typeof SetPageSeoSchema>,
): Promise<PagesActionResult> {
  const parsed = SetPageSeoSchema.safeParse(input);
  if (!parsed.success) {
    const e = firstIssueMessage(parsed.error);
    return { status: 'error', message: e.message, field: e.field };
  }
  const data = parsed.data;
  if (!(await rateGate('pages-seo', 60))) {
    return { status: 'error', message: 'Too many requests — try again in a moment.' };
  }
  const owner = await gate(data.slug);
  if (!owner.ok) return { status: 'error', message: owner.message };

  const existing = await getPageById(data.pageId);
  if (!existing || existing.storefrontSlug !== data.slug) {
    return { status: 'error', message: 'Page not found.' };
  }

  const page = await setPageSeoRow(data.pageId, {
    title: data.seo.title ?? null,
    description: data.seo.description ?? null,
    image: data.seo.image ?? null,
  });
  await recordAudit({
    storefrontSlug: data.slug,
    clerkUserId: owner.userId,
    action: 'storefront.page.set_seo',
    targetId: page.id,
    summary: `Updated SEO on "${page.title}"`,
    meta: { pageId: page.id },
  });
  revalidateBuilderAndPublic(data.slug);
  return { status: 'success', page };
}
