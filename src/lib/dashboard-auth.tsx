import type { ReactElement } from 'react';
import { redirect } from 'next/navigation';
import { auth, clerkClient, currentUser, verifyToken } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { getStorefront, type Storefront } from '@/lib/brief';
import { DashboardAuthPanel } from '@/components/dashboard/DashboardAuthPanel';
import { env } from '@/lib/env';

export type DashboardAuthResult =
  | { ok: true; storefront: Storefront; userId: string }
  | { ok: false; panel: ReactElement };

type DashboardUser = {
  userId: string;
  email: string | null;
};

type ClerkUserProfile = {
  primaryEmailAddressId?: string | null;
  emailAddresses?: Array<{
    id?: string | null;
    emailAddress?: string | null;
    verification?: { status?: string | null } | null;
  }>;
};

/**
 * Clerk session gate for every dashboard page. Two outcomes:
 *
 *  - Storefront slug doesn't exist → soft "not found" panel (we don't 404
 *    because a stale link from an old founder shouldn't burn the slug).
 *  - Visitor isn't signed in → redirect to /sign-in?redirect_url=...
 *  - Signed-in but not the owner → soft auth panel in the storefront's locale.
 *
 * Returning the Clerk userId alongside the storefront lets pages call
 * server actions without re-fetching the session.
 */
export async function requireStorefrontOwner(
  slug: string,
  /** absolute path used as redirect target after sign-in */
  returnTo: string,
): Promise<DashboardAuthResult> {
  const storefront = await getStorefront(slug);

  const user = await resolveDashboardUser();
  if (!user) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
  }

  if (!storefront) {
    return { ok: false, panel: <DashboardAuthPanel locale="en" reason="missing" /> };
  }

  const emailMatch =
    user.email &&
    storefront.contactEmail.toLowerCase() === user.email.toLowerCase();

  if (storefront.clerkUserId !== user.userId && !emailMatch) {
    return { ok: false, panel: <DashboardAuthPanel locale={storefront.locale} reason="forbidden" /> };
  }

  return { ok: true, storefront, userId: user.userId };
}

async function resolveDashboardUser(): Promise<DashboardUser | null> {
  const { userId } = await auth();
  if (userId) {
    const user = await currentUser().catch(() => null);
    return { userId, email: primaryEmail(user) };
  }

  const token = await readBearerToken();
  if (!token || !env.CLERK_SECRET_KEY) return null;

  const verified = await verifyToken(token, {
    secretKey: env.CLERK_SECRET_KEY,
  }).catch(() => null);
  const bearerUserId = verified?.sub ?? null;
  if (!bearerUserId) return null;

  const user = await clerkClient()
    .then((client) => client.users.getUser(bearerUserId))
    .catch(() => null);

  return { userId: bearerUserId, email: primaryEmail(user) };
}

async function readBearerToken(): Promise<string | null> {
  const authorization = (await headers()).get('authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

function primaryEmail(user: ClerkUserProfile | null | undefined): string | null {
  const emails = user?.emailAddresses ?? [];
  const primary = emails.find((email) => email.id === user?.primaryEmailAddressId);
  if (primary?.verification?.status === 'verified' && primary.emailAddress) {
    return primary.emailAddress;
  }

  return primary?.emailAddress ?? emails.find((email) => email.verification?.status === 'verified')?.emailAddress ?? emails[0]?.emailAddress ?? null;
}
