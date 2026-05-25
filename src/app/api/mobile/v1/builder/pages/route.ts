import {
  mobileError,
  mobileJson,
  mobileOptions,
  requireMobileStoreAccess,
  searchParam,
} from '@/lib/mobile/auth';
import { listPages } from '@/lib/storefrontPages';

/**
 * Mobile builder · list pages.
 *
 *   GET /api/mobile/v1/builder/pages?store=<slug>
 *
 * Returns every storefront page in publishing order (home first, then
 * the rest by `position`). Each row is the shape `StorefrontPage` —
 * the mobile canvas screen uses the `id`, `title`, `slug`, `status`,
 * and `isHome` fields to render the page list. Blocks are deliberately
 * NOT included here; fetch a single page via `[id]/route.ts` when the
 * merchant taps in.
 *
 * Auth: requires storefront access with the `builder.manage` capability
 * (owner short-circuits). 401 / 403 mapping handled by
 * `requireMobileStoreAccess`.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(): Response {
  return mobileOptions();
}

export async function GET(req: Request): Promise<Response> {
  const slug = searchParam(req, 'store');
  const gate = await requireMobileStoreAccess(slug, 'builder.edit');
  if (!gate.ok) return gate.response;

  try {
    const pages = await listPages(gate.access.storefront.slug);
    return mobileJson({
      pages: pages.map((page) => ({
        id: page.id,
        slug: page.slug,
        title: page.title,
        status: page.status,
        isHome: page.isHome,
        position: page.position,
        showInNav: page.showInNav,
        updatedAt: page.updatedAt,
      })),
    });
  } catch (err) {
    console.error('[mobile/builder/pages GET] failed', err);
    return mobileError(500, 'builder_pages_failed', 'Could not load pages.');
  }
}
