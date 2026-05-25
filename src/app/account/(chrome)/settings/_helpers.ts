import { redirect } from 'next/navigation';
import {
  getStorefront,
  getStorefrontsForUser,
  type Storefront,
} from '@/lib/brief';
import { getAdminUserId } from '@/lib/adminAuth';

/**
 * Per-settings-page resolver. Every settings screen needs the same
 * "auth + active store + ownership check" boilerplate; centralising it
 * keeps the screens readable.
 */
export async function resolveSettingsContext(
  searchParams: { store?: string | string[] } | undefined,
  redirectPath: string,
): Promise<{
  storefront: Storefront;
  storefronts: Awaited<ReturnType<typeof getStorefrontsForUser>>;
}> {
  const userId = await getAdminUserId('account/settings/context');
  if (!userId) redirect(`/sign-in?redirect_url=${redirectPath}`);

  const requested = Array.isArray(searchParams?.store)
    ? searchParams!.store[0]
    : searchParams?.store;
  const storefronts = await getStorefrontsForUser(userId).catch((err) => {
    console.error('[admin/settings] resolve storefronts failed', err);
    return [] as Awaited<ReturnType<typeof getStorefrontsForUser>>;
  });
  if (storefronts.length === 0) {
    redirect('/begin');
  }
  const known = new Set(storefronts.map((s) => s.slug));
  const slug =
    requested && known.has(requested) ? requested : storefronts[0]!.slug;
  const storefront = await getStorefront(slug);
  if (!storefront || storefront.clerkUserId !== userId) {
    redirect('/account');
  }
  return { storefront, storefronts };
}
