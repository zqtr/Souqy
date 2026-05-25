import { auth, clerkClient } from '@clerk/nextjs/server';
import { EmptyState, PageHeader } from '@/components/admin/primitives';
import { resolveSettingsContext } from '../_helpers';
import { TeamSettings } from '@/components/settings/TeamSettings';
import { getStorefrontOrgId, listMembers } from '@/lib/team/members';
import {
  UPGRADE_GROWTH_TOOLS_COPY,
  getPlan,
  planUnlocksTeamMembers,
} from '@/lib/billing';

export default async function TeamSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const { storefront } = await resolveSettingsContext(sp, '/account/settings/team');
  const { userId } = await auth();
  const plan = await getPlan(storefront.clerkUserId);

  if (!planUnlocksTeamMembers(plan)) {
    return (
      <>
        <PageHeader
          eyebrow="Platform - Team"
          title="Team"
          subtitle={UPGRADE_GROWTH_TOOLS_COPY}
        />
        <EmptyState
          eyebrow="Plan locked"
          title="Team members unlock on Pro+"
          body="Upgrade to Pro+ or Max+ to invite teammates and manage shared access."
          action={{ label: 'Compare plans', href: '/account/settings/plan' }}
        />
      </>
    );
  }

  const members = await listMembers(storefront.slug);
  const orgId = await getStorefrontOrgId(storefront.slug);

  // Resolve display info for each member from Clerk in one batch.
  const memberProfiles: Record<
    string,
    { email: string | null; name: string | null; imageUrl: string | null }
  > = {};
  let invitations: Array<{ id: string; emailAddress: string; role: string; status: string; createdAt: number }> = [];
  if (orgId) {
    try {
      const client = await clerkClient();
      const userIds = members.map((m) => m.clerkUserId);
      if (userIds.length > 0) {
        const list = await client.users.getUserList({ userId: userIds, limit: 100 });
        for (const u of list.data) {
          const email = u.primaryEmailAddress?.emailAddress
            ?? u.emailAddresses[0]?.emailAddress
            ?? null;
          const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || null;
          memberProfiles[u.id] = { email, name, imageUrl: u.imageUrl ?? null };
        }
      }
      const invs = await client.organizations.getOrganizationInvitationList({
        organizationId: orgId,
        status: ['pending'],
      });
      invitations = invs.data.map((i) => ({
        id: i.id,
        emailAddress: i.emailAddress,
        role: i.role,
        status: i.status ?? 'pending',
        createdAt: i.createdAt,
      }));
    } catch (err) {
      console.warn('[settings/team] clerk fetch failed', err);
    }
  }

  // Owner row is synthesised from briefs.clerk_user_id (it isn't in
  // storefront_members). Include it at the top of the list.
  const ownerProfile = await (async () => {
    try {
      const client = await clerkClient();
      const u = await client.users.getUser(storefront.clerkUserId);
      return {
        email: u.primaryEmailAddress?.emailAddress ?? null,
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || null,
        imageUrl: u.imageUrl ?? null,
      };
    } catch {
      return { email: null, name: null, imageUrl: null };
    }
  })();
  memberProfiles[storefront.clerkUserId] = ownerProfile;

  return (
    <>
      <PageHeader
        eyebrow="Platform · Team"
        title="Team"
        subtitle="Invite teammates, set their role, and choose what they can access."
      />
      <TeamSettings
        slug={storefront.slug}
        currentUserId={userId ?? ''}
        ownerUserId={storefront.clerkUserId}
        members={members}
        invitations={invitations}
        profiles={memberProfiles}
      />
    </>
  );
}
