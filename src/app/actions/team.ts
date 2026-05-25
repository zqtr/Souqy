'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/rate-limit';
import { hasDb } from '@/lib/db';
import { recordAudit } from '@/lib/audit';
import { assertStorefrontAccess, assertStorefrontOwner } from '@/lib/products';
import {
  ROLES,
  type Capability,
  type Role,
  sanitizeCapabilities,
} from '@/lib/team/capabilities';
import {
  deleteMember,
  getStorefrontOrgId,
  setStorefrontOrg,
  updateMemberRoleAndCaps,
} from '@/lib/team/members';

/**
 * Team management actions. Every mutation gates on
 * `assertStorefrontAccess(slug, userId, 'team.manage')` so an admin who
 * has been granted `team.manage` can act, while a viewer cannot.
 *
 * Email delivery is owned entirely by Clerk — `createOrganizationInvitation`
 * triggers the Clerk-managed invite email and signup flow. We never see
 * the invitee's password or email content.
 */

const SlugSchema = z.string().trim().min(3).max(40);
const RoleSchema = z.enum(ROLES).refine((r) => r !== 'owner', {
  message: 'Role "owner" cannot be assigned to invitees.',
});

const InviteSchema = z.object({
  storefrontSlug: SlugSchema,
  email: z.string().trim().email().max(254),
  role: RoleSchema,
});

const RevokeSchema = z.object({
  storefrontSlug: SlugSchema,
  invitationId: z.string().min(1),
});

const UpdateMemberSchema = z.object({
  storefrontSlug: SlugSchema,
  clerkUserId: z.string().min(1),
  role: RoleSchema,
  capabilities: z.record(z.string(), z.boolean()).optional().default({}),
});

const RemoveMemberSchema = z.object({
  storefrontSlug: SlugSchema,
  clerkUserId: z.string().min(1),
});

export type TeamActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string };

async function ipScope(prefix: string) {
  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    hdrs.get('x-real-ip') ??
    'unknown';
  return `${prefix}:${ip}`;
}

/**
 * Lazily ensure the storefront has an associated Clerk Organization.
 * Storefronts created before the Team feature shipped won't have one,
 * so the first time the owner opens Settings → Team (or invites
 * someone) we create it on demand and persist the id back on `briefs`.
 */
async function ensureOrgForStorefront(
  slug: string,
  ownerClerkUserId: string,
  storefrontName: string,
): Promise<string> {
  const existing = await getStorefrontOrgId(slug);
  if (existing) return existing;
  const client = await clerkClient();
  const org = await client.organizations.createOrganization({
    name: storefrontName || slug,
    slug: `souqna-${slug}`.slice(0, 50),
    createdBy: ownerClerkUserId,
  });
  await setStorefrontOrg(slug, org.id);
  return org.id;
}

async function gate(slug: string, capability: Capability) {
  if (!hasDb()) return null;
  const { userId } = await auth();
  return assertStorefrontAccess(slug, userId, capability);
}

export async function inviteMember(input: unknown): Promise<TeamActionState> {
  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Provide a valid email and role.' };
  }
  if (!rateLimit(await ipScope('team-invite'), 30, 60_000).ok) {
    return { status: 'error', message: 'Too many invites, try again shortly.' };
  }
  const access = await gate(parsed.data.storefrontSlug, 'team.manage');
  if (!access) return { status: 'error', message: 'Forbidden' };
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in required.' };

  // Ensure org exists. Only the owner can create the org; if a non-owner
  // admin reaches this branch, fall back to looking up by slug only.
  const ownerSf = await assertStorefrontOwner(parsed.data.storefrontSlug, userId);
  let orgId = await getStorefrontOrgId(parsed.data.storefrontSlug);
  if (!orgId) {
    if (!ownerSf) {
      return {
        status: 'error',
        message: 'Team is not set up yet — ask the storefront owner to invite the first member.',
      };
    }
    orgId = await ensureOrgForStorefront(
      parsed.data.storefrontSlug,
      userId,
      ownerSf.businessName || ownerSf.slug,
    );
  }

  try {
    const client = await clerkClient();
    await client.organizations.createOrganizationInvitation({
      organizationId: orgId,
      emailAddress: parsed.data.email,
      role: parsed.data.role === 'admin' ? 'org:admin' : 'org:member',
      inviterUserId: userId,
      publicMetadata: {
        souqnaStorefrontSlug: parsed.data.storefrontSlug,
        souqnaRole: parsed.data.role,
      },
    });
    await recordAudit({
      storefrontSlug: parsed.data.storefrontSlug,
      clerkUserId: userId,
      action: 'team.invite',
      summary: `Invited ${parsed.data.email} as ${parsed.data.role}`,
    });
    revalidatePath('/account/settings/team');
    return { status: 'success' };
  } catch (err) {
    console.error('[team] invite failed', err);
    return { status: 'error', message: 'Could not send invitation.' };
  }
}

export async function revokeInvite(input: unknown): Promise<TeamActionState> {
  const parsed = RevokeSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request.' };
  const access = await gate(parsed.data.storefrontSlug, 'team.manage');
  if (!access) return { status: 'error', message: 'Forbidden' };
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in required.' };
  const orgId = await getStorefrontOrgId(parsed.data.storefrontSlug);
  if (!orgId) return { status: 'error', message: 'Team is not set up.' };
  try {
    const client = await clerkClient();
    await client.organizations.revokeOrganizationInvitation({
      organizationId: orgId,
      invitationId: parsed.data.invitationId,
      requestingUserId: userId,
    });
    await recordAudit({
      storefrontSlug: parsed.data.storefrontSlug,
      clerkUserId: userId,
      action: 'team.invite.revoke',
      targetId: parsed.data.invitationId,
      summary: 'Revoked pending invitation',
    });
    revalidatePath('/account/settings/team');
    return { status: 'success' };
  } catch (err) {
    console.error('[team] revoke failed', err);
    return { status: 'error', message: 'Could not revoke invitation.' };
  }
}

export async function updateMember(input: unknown): Promise<TeamActionState> {
  const parsed = UpdateMemberSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request.' };
  const access = await gate(parsed.data.storefrontSlug, 'team.manage');
  if (!access) return { status: 'error', message: 'Forbidden' };
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in required.' };

  const safeCaps = sanitizeCapabilities(parsed.data.capabilities);
  // Defensive: forbid silently granting team.manage to a non-admin via
  // override unless the current actor is the owner. Admins can grant
  // team.manage only to admins.
  if (
    safeCaps['team.manage'] === true &&
    parsed.data.role !== 'admin' &&
    access.role !== 'owner'
  ) {
    delete safeCaps['team.manage'];
  }

  try {
    await updateMemberRoleAndCaps({
      storefrontSlug: parsed.data.storefrontSlug,
      clerkUserId: parsed.data.clerkUserId,
      role: parsed.data.role as Role,
      capabilities: safeCaps,
    });

    // Mirror the role change to Clerk so org-level UI stays consistent.
    const orgId = await getStorefrontOrgId(parsed.data.storefrontSlug);
    if (orgId) {
      try {
        const client = await clerkClient();
        await client.organizations.updateOrganizationMembership({
          organizationId: orgId,
          userId: parsed.data.clerkUserId,
          role: parsed.data.role === 'admin' ? 'org:admin' : 'org:member',
        });
      } catch (err) {
        // Clerk-side role update is best-effort; capability resolution
        // is local anyway.
        console.warn('[team] clerk role mirror failed', err);
      }
    }

    await recordAudit({
      storefrontSlug: parsed.data.storefrontSlug,
      clerkUserId: userId,
      action: 'team.member.update',
      targetId: parsed.data.clerkUserId,
      summary: `Updated member to ${parsed.data.role}`,
      meta: { capabilities: safeCaps satisfies Partial<Record<Capability, boolean>> as Record<string, boolean> },
    });
    revalidatePath('/account/settings/team');
    return { status: 'success' };
  } catch (err) {
    console.error('[team] update member failed', err);
    return { status: 'error', message: 'Could not update member.' };
  }
}

export async function removeMember(input: unknown): Promise<TeamActionState> {
  const parsed = RemoveMemberSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request.' };
  const access = await gate(parsed.data.storefrontSlug, 'team.manage');
  if (!access) return { status: 'error', message: 'Forbidden' };
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in required.' };
  if (parsed.data.clerkUserId === userId) {
    return { status: 'error', message: 'You cannot remove yourself.' };
  }

  const orgId = await getStorefrontOrgId(parsed.data.storefrontSlug);
  try {
    if (orgId) {
      const client = await clerkClient();
      try {
        await client.organizations.deleteOrganizationMembership({
          organizationId: orgId,
          userId: parsed.data.clerkUserId,
        });
      } catch (err) {
        // If Clerk already lost the membership (out-of-band remove from
        // Clerk dashboard), continue cleaning the local row.
        console.warn('[team] clerk delete membership failed', err);
      }
    }
    await deleteMember(parsed.data.storefrontSlug, parsed.data.clerkUserId);
    await recordAudit({
      storefrontSlug: parsed.data.storefrontSlug,
      clerkUserId: userId,
      action: 'team.member.remove',
      targetId: parsed.data.clerkUserId,
      summary: 'Removed team member',
    });
    revalidatePath('/account/settings/team');
    return { status: 'success' };
  } catch (err) {
    console.error('[team] remove failed', err);
    return { status: 'error', message: 'Could not remove member.' };
  }
}
