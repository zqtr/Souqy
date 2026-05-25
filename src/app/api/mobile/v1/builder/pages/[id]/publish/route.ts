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
  publishPage,
} from '@/lib/storefrontPages';
import { recordAudit } from '@/lib/audit';

/**
 * Mobile builder · publish a single page.
 *
 *   POST /api/mobile/v1/builder/pages/[id]/publish?store=<slug>
 *
 * Copies the page's `draft_blocks` over `published_blocks` and flips
 * `status` to `published`. For the home page, `publishPage` also
 * mirrors the tree onto `briefs.published_blocks` so the legacy
 * pipeline (and the Souqy fallback) keep returning the latest live
 * tree.
 *
 * The web action `publishStorefront` does substantially more
 * (domain provisioning, side-effect dispatch). The mobile MVP keeps
 * to the page-level publish; the merchant can still trigger a full
 * publish via the web builder if they need domain DNS work.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(): Response {
  return mobileOptions();
}

const Schema = z.object({
  store: z.string().trim().min(1).max(64).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return mobileError(400, 'invalid_publish', 'Invalid publish request.');
  }
  const slug = parsed.data.store ?? searchParam(req, 'store');
  const gate = await requireMobileStoreAccess(slug, 'builder.edit');
  if (!gate.ok) return gate.response;

  const existing = await getPageById(params.id);
  if (!existing || existing.storefrontSlug !== gate.access.storefront.slug) {
    return mobileError(404, 'not_found', 'Page not found.');
  }

  try {
    const page = await publishPage(params.id);
    await recordAudit({
      storefrontSlug: gate.access.storefront.slug,
      clerkUserId: gate.user.userId,
      action: 'storefront.builder.publish',
      targetId: params.id,
      summary: 'Page published from mobile',
      meta: { pageId: params.id, source: 'mobile' },
    });
    revalidatePath('/account/builder');
    revalidatePath(`/account/${gate.access.storefront.slug}/preview`);
    return mobileJson({ page });
  } catch (err) {
    console.error('[mobile/builder/pages publish] failed', err);
    return mobileError(500, 'publish_failed', 'Could not publish page.');
  }
}
