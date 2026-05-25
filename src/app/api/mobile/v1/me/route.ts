import {
  getMobileBilling,
  listMobileStores,
  mobileJson,
  mobileOptions,
  requireMobileUser,
} from '@/lib/mobile/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(): Response {
  return mobileOptions();
}

export async function GET(): Promise<Response> {
  const user = await requireMobileUser();
  if (!user.ok) return user.response;

  const [stores, billing] = await Promise.all([
    listMobileStores(user.user),
    getMobileBilling(user.user.userId),
  ]);
  return mobileJson({
    user: user.user,
    stores,
    billing,
    activeStore: stores[0]?.slug ?? null,
  });
}
