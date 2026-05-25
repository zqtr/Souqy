import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
  mobileError,
  mobileJson,
  mobileOptions,
  requireMobileStoreAccess,
  searchParam,
} from '@/lib/mobile/auth';
import {
  getPageById,
  saveDraftBlocks,
  setPageSeo,
  type StorefrontPage,
} from '@/lib/storefrontPages';
import { blocksSchema } from '@/lib/blocks/schemas';
import { recordAudit } from '@/lib/audit';

/**
 * Mobile builder · page detail + save draft.
 *
 *   GET    /api/mobile/v1/builder/pages/[id]?store=<slug> — full page
 *   PATCH  /api/mobile/v1/builder/pages/[id]               — save draft
 *
 * The PATCH body is a complete blocks array (replaces the page's
 * `draft_blocks` in one shot) — same shape the web builder sends.
 * Blocks are validated against the canonical `blocksSchema` so the
 * mobile client can never persist a shape the storefront renderer
 * would choke on.
 *
 * Auth: `builder.manage` capability on the active storefront. The
 * gate also verifies the page belongs to that storefront before we
 * touch the row.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(): Response {
  return mobileOptions();
}

const SeoSchema = z
  .object({
    title: z.string().trim().max(140).nullable().optional(),
    description: z.string().trim().max(260).nullable().optional(),
    image: z.string().trim().max(2048).nullable().optional(),
    ogImage: z.string().trim().max(2048).nullable().optional(),
  })
  .strict();

const PatchSchema = z
  .object({
    store: z.string().trim().min(1).max(64).optional(),
    blocks: blocksSchema.optional(),
    seo: SeoSchema.optional(),
  })
  .refine((value) => value.blocks || value.seo, {
    message: 'Provide blocks or SEO fields.',
  });

async function ensurePageBelongsToStore(
  pageId: string,
  storefrontSlug: string,
): Promise<StorefrontPage | null> {
  const page = await getPageById(pageId);
  if (!page) return null;
  if (page.storefrontSlug !== storefrontSlug) return null;
  return page;
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const slug = searchParam(req, 'store');
  const gate = await requireMobileStoreAccess(slug, 'builder.edit');
  if (!gate.ok) return gate.response;

  const page = await ensurePageBelongsToStore(params.id, gate.access.storefront.slug);
  if (!page) return mobileError(404, 'not_found', 'Page not found.');

  return mobileJson({ page });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return mobileError(400, 'invalid_page_patch', 'Invalid page update payload.');
  }
  const slug = parsed.data.store ?? searchParam(req, 'store');
  const gate = await requireMobileStoreAccess(slug, 'builder.edit');
  if (!gate.ok) return gate.response;

  const page = await ensurePageBelongsToStore(params.id, gate.access.storefront.slug);
  if (!page) return mobileError(404, 'not_found', 'Page not found.');

  try {
    let saved = page;
    if (parsed.data.blocks) {
      saved = await saveDraftBlocks(params.id, parsed.data.blocks);
      await recordAudit({
        storefrontSlug: gate.access.storefront.slug,
        clerkUserId: gate.user.userId,
        action: 'storefront.builder.save',
        targetId: params.id,
        summary: 'Builder draft saved from mobile',
        meta: {
          pageId: params.id,
          blockCount: parsed.data.blocks.length,
          source: 'mobile',
        },
      });
    }
    if (parsed.data.seo) {
      saved = await setPageSeo(params.id, {
        title: parsed.data.seo.title ?? null,
        description: parsed.data.seo.description ?? null,
        image: parsed.data.seo.image ?? parsed.data.seo.ogImage ?? null,
      });
      await recordAudit({
        storefrontSlug: gate.access.storefront.slug,
        clerkUserId: gate.user.userId,
        action: 'storefront.page.set_seo',
        targetId: params.id,
        summary: 'Page SEO saved from mobile',
        meta: { pageId: params.id, source: 'mobile' },
      });
    }
    revalidatePath('/account/builder');
    revalidatePath(`/account/${gate.access.storefront.slug}/preview`);
    return mobileJson({ page: saved });
  } catch (err) {
    console.error('[mobile/builder/pages PATCH] save failed', err);
    return mobileError(500, 'save_failed', 'Could not save draft.');
  }
}
