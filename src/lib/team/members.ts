import { db } from '@/lib/db';
import {
  type Capability,
  type Role,
  isRole,
  sanitizeCapabilities,
} from './capabilities';

export type StorefrontMember = {
  storefrontSlug: string;
  clerkUserId: string;
  clerkOrgId: string;
  role: Role;
  capabilities: Partial<Record<Capability, boolean>>;
  invitedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type Row = {
  storefront_slug: string;
  clerk_user_id: string;
  clerk_org_id: string;
  role: string;
  capabilities: unknown;
  invited_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function fromRow(r: Row): StorefrontMember | null {
  if (!isRole(r.role)) return null;
  return {
    storefrontSlug: r.storefront_slug,
    clerkUserId: r.clerk_user_id,
    clerkOrgId: r.clerk_org_id,
    role: r.role,
    capabilities: sanitizeCapabilities(r.capabilities),
    invitedBy: r.invited_by,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

export async function listMembers(slug: string): Promise<StorefrontMember[]> {
  const rows = (await db()`
    select * from storefront_members
    where storefront_slug = ${slug}
    order by created_at asc
  `) as Row[];
  return rows.map(fromRow).filter((m): m is StorefrontMember => m !== null);
}

export async function upsertMember(input: {
  storefrontSlug: string;
  clerkUserId: string;
  clerkOrgId: string;
  role: Role;
  capabilities?: Partial<Record<Capability, boolean>>;
  invitedBy?: string | null;
}): Promise<void> {
  const caps = JSON.stringify(input.capabilities ?? {});
  await db()`
    insert into storefront_members (
      storefront_slug, clerk_user_id, clerk_org_id, role, capabilities, invited_by
    ) values (
      ${input.storefrontSlug}, ${input.clerkUserId}, ${input.clerkOrgId},
      ${input.role}, ${caps}::jsonb, ${input.invitedBy ?? null}
    )
    on conflict (storefront_slug, clerk_user_id) do update set
      clerk_org_id = excluded.clerk_org_id,
      role = excluded.role,
      capabilities = excluded.capabilities,
      updated_at = now()
  `;
}

export async function updateMemberRoleAndCaps(input: {
  storefrontSlug: string;
  clerkUserId: string;
  role: Role;
  capabilities: Partial<Record<Capability, boolean>>;
}): Promise<void> {
  const caps = JSON.stringify(input.capabilities);
  await db()`
    update storefront_members
    set role = ${input.role},
        capabilities = ${caps}::jsonb,
        updated_at = now()
    where storefront_slug = ${input.storefrontSlug}
      and clerk_user_id = ${input.clerkUserId}
  `;
}

export async function deleteMember(slug: string, clerkUserId: string): Promise<void> {
  await db()`
    delete from storefront_members
    where storefront_slug = ${slug} and clerk_user_id = ${clerkUserId}
  `;
}

export async function deleteMembersByOrg(clerkOrgId: string, clerkUserId: string): Promise<void> {
  await db()`
    delete from storefront_members
    where clerk_org_id = ${clerkOrgId} and clerk_user_id = ${clerkUserId}
  `;
}

export async function getStorefrontByOrg(
  clerkOrgId: string,
): Promise<{ slug: string; clerkUserId: string } | null> {
  const rows = (await db()`
    select slug, clerk_user_id from briefs where clerk_org_id = ${clerkOrgId} limit 1
  `) as Array<{ slug: string; clerk_user_id: string }>;
  if (!rows[0]) return null;
  return { slug: rows[0].slug, clerkUserId: rows[0].clerk_user_id };
}

export async function setStorefrontOrg(slug: string, clerkOrgId: string): Promise<void> {
  await db()`
    update briefs set clerk_org_id = ${clerkOrgId} where slug = ${slug}
  `;
}

export async function getStorefrontOrgId(slug: string): Promise<string | null> {
  const rows = (await db()`
    select clerk_org_id from briefs where slug = ${slug} limit 1
  `) as Array<{ clerk_org_id: string | null }>;
  return rows[0]?.clerk_org_id ?? null;
}
