import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { getAdminUserId } from '@/lib/adminAuth';

export const metadata: Metadata = {
  title: 'Souqna · admin',
  robots: { index: false, follow: false },
};

/**
 * Account-tree gate. The whole `/account/*` subtree is owner-only, so
 * we run the Clerk check once here instead of repeating it in every
 * leaf page.
 *
 * This layout deliberately does NOT render `<html>` / `<body>`. The
 * builder iframe pages under `/account/[slug]/preview` and the souqy
 * preview at `/account/[slug]/souqy` render their own document via
 * `DashboardDocument`, so the document shell lives one level deeper:
 *
 *   - `/account/(chrome)/layout.tsx`  → html + body + sidebar + topbar
 *   - `/account/builder/layout.tsx`   → html + body, full-bleed, no chrome
 *   - `/account/[slug]/preview/page.tsx` → DashboardDocument
 *
 * All three layouts independently produce a complete document.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getAdminUserId('account/layout');
  if (!userId) {
    redirect('/sign-in?redirect_url=/account');
  }
  const headerStore = await headers();
  const pathname = headerStore.get('x-souqna-pathname') ?? '/account';
  const search = headerStore.get('x-souqna-search') ?? '';
  const phoneGatePath = '/account/phone-required';
  const isPhoneGate = pathname === phoneGatePath || pathname.startsWith(`${phoneGatePath}/`);
  if (!isPhoneGate) {
    const user = await currentUser();
    const requiresPhone =
      user?.unsafeMetadata?.phoneRequiredReason === 'whatsapp_notifications';
    const verifiedPhone =
      user?.primaryPhoneNumber?.verification?.status === 'verified'
        ? user.primaryPhoneNumber
        : user?.phoneNumbers?.find((phone) => phone.verification?.status === 'verified');
    if (requiresPhone && !verifiedPhone) {
      const redirectUrl = `${pathname}${search}`;
      redirect(`/account/phone-required?redirect_url=${encodeURIComponent(redirectUrl)}`);
    }
  }
  return <>{children}</>;
}
