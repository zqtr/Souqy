import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/admin/primitives';
import { getStorefrontsForUser } from '@/lib/brief';
import { env } from '@/lib/env';
import { WebsitesManager } from '@/components/settings/WebsitesManager';

export const dynamic = 'force-dynamic';

/**
 * Websites settings — the founder's portfolio of storefronts. Lists
 * every store they own with its publish state, live URL, and template,
 * and exposes per-row Unpublish (reversible) + Delete (irreversible)
 * affordances. The unpublished state is reflected by the public
 * renderer (`/brief/[slug]/[[...path]]`) which 404s when
 * `is_published = false`, so flipping the toggle here immediately
 * pulls the storefront from buyer view without losing the published
 * tree.
 */
export default async function WebsitesSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/settings/websites');

  const storefronts = await getStorefrontsForUser(userId);

  return (
    <>
      <PageHeader
        eyebrow="Store · Websites"
        title="Websites"
        subtitle="Every storefront on your account. Pause one to hide it from buyers, or delete to remove it permanently."
        primaryAction={{ label: 'Create another store', href: '/begin' }}
      />
      <WebsitesManager
        storefronts={storefronts.map((s) => ({
          slug: s.slug,
          businessName: s.businessName,
          isPublished: s.isPublished,
          templateId: s.templateId,
          locale: s.locale,
          createdAt: s.createdAt.toISOString(),
        }))}
        rootDomain={env.BRIEF_ROOT_DOMAIN}
      />
    </>
  );
}
