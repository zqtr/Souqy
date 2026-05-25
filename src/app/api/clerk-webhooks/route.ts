import 'server-only';
import type { NextRequest } from 'next/server';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { db, hasDb } from '@/lib/db';
import {
  deleteMembersByOrg,
  getStorefrontByOrg,
  upsertMember,
} from '@/lib/team/members';
import { pushWelcomeNotification } from '@/lib/notifications';
import { getPlanMeta, patchPlanMeta } from '@/lib/billing';
import { isRole, type Role } from '@/lib/team/capabilities';
import { recordPulseActivity } from '@/lib/pulseActivity';
import { env } from '@/lib/env';
import { sendStorefrontOnboardingEmail } from '@/lib/email/onboarding';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Clerk → Souqna webhook bridge.
 *
 * Configured in the Clerk Dashboard under Webhooks → Endpoint with the
 * production URL `https://souqna.qa/api/clerk-webhooks`. The signing
 * secret returned by the dashboard MUST be stored on Vercel as
 * `CLERK_WEBHOOK_SIGNING_SECRET` (Production + Preview + Development).
 *
 * The middleware whitelists `/api/(.*)` from the apex auth gate, so
 * unsigned POSTs from Svix reach this route. We re-verify the signature
 * here using `verifyWebhook` — never trust the request body otherwise.
 *
 * Handlers must be:
 *   - idempotent: Svix retries any non-2xx for up to 3 days, and the
 *     same event id can replay from the dashboard at any time
 *   - fast: return 2xx within seconds; defer slow work to a queue
 *
 * Subscribed events (configure exactly these in the dashboard):
 *   - user.created  → seed `user_plans` row at the default `'free'` tier
 *   - user.updated  → send account welcome once an email is verified
 *   - user.deleted  → cascade-clean `user_plans` (briefs cascade via FK)
 */
export async function POST(req: NextRequest): Promise<Response> {
  let evt: WebhookEvent;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error('[clerk-webhook] signature verification failed', err);
    return new Response('Invalid signature', { status: 401 });
  }

  try {
    switch (evt.type) {
      case 'user.created':
        await onUserCreated(evt.data as unknown as ClerkUserPayload);
        break;
      case 'user.deleted':
        if (evt.data.id) await onUserDeleted(evt.data.id);
        break;
      case 'organizationMembership.created':
        await onOrgMembershipCreated(evt.data as unknown as OrgMembershipPayload);
        break;
      case 'organizationMembership.deleted':
        await onOrgMembershipDeleted(evt.data as unknown as OrgMembershipPayload);
        break;
      case 'user.updated':
        await onUserUpdated(evt.data as unknown as ClerkUserPayload);
        break;
      default:
        // Quietly accept other event types so a misconfigured dashboard
        // subscription doesn't trigger Svix retry storms.
        break;
    }
  } catch (err) {
    console.error('[clerk-webhook] handler failed', { type: evt.type, err });
    // Return 5xx so Svix retries — the operation is idempotent.
    return new Response('Handler failed', { status: 500 });
  }

  return new Response('ok', { status: 200 });
}

type ClerkEmailAddress = {
  id?: string;
  email_address?: string;
  verification?: { status?: string } | null;
};

type ClerkPhoneNumber = {
  id?: string;
  phone_number?: string;
  verification?: { status?: string } | null;
};

type ClerkUserPayload = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  primary_email_address_id?: string | null;
  primary_phone_number_id?: string | null;
  email_addresses?: ClerkEmailAddress[];
  phone_numbers?: ClerkPhoneNumber[];
};

function ownerNameFromClerkUser(data: ClerkUserPayload): string {
  return (
    [data.first_name, data.last_name].filter(Boolean).join(' ').trim() ||
    data.username?.trim() ||
    'Founder'
  );
}

function verifiedEmailFromClerkUser(data: ClerkUserPayload): string | null {
  const emails = data.email_addresses ?? [];
  const primary = emails.find((email) => email.id === data.primary_email_address_id);
  const verifiedPrimary =
    primary?.verification?.status === 'verified' ? primary.email_address?.trim() : '';
  if (verifiedPrimary) return verifiedPrimary;

  const verified = emails.find((email) => email.verification?.status === 'verified');
  return verified?.email_address?.trim() || null;
}

function phoneFromClerkUser(data: ClerkUserPayload): {
  phone: string | null;
  verified: boolean;
} {
  const phones = data.phone_numbers ?? [];
  const primary = phones.find((phone) => phone.id === data.primary_phone_number_id);
  const fallback = primary ?? phones[0];
  const phone = fallback?.phone_number?.trim() || null;
  return {
    phone,
    verified: fallback?.verification?.status === 'verified',
  };
}

async function maybeSendAccountWelcomeEmail(data: ClerkUserPayload): Promise<void> {
  if (!hasDb() || !data.id) return;
  const to = verifiedEmailFromClerkUser(data);
  if (!to) return;

  const meta = await getPlanMeta(data.id);
  if (meta.account_welcome_email_sent === true) return;

  const result = await sendStorefrontOnboardingEmail({
    to,
    ownerName: ownerNameFromClerkUser(data),
    storefrontName: 'Souqna',
    storefrontUrl: `${env.NEXT_PUBLIC_SITE_URL}/account`,
  });
  if (!result.ok) {
    console.error('[clerk-webhook] account welcome email error', {
      provider: result.provider,
      error: result.error,
    });
    return;
  }

  await patchPlanMeta(data.id, {
    account_welcome_email_sent: true,
    account_welcome_email_sent_at: new Date().toISOString(),
    account_welcome_email_to: to,
  });
}

async function onUserCreated(data: ClerkUserPayload): Promise<void> {
  const clerkUserId = data.id;
  if (!hasDb()) return;
  const notificationPhone = phoneFromClerkUser(data);
  const founderName = ownerNameFromClerkUser(data);
  await db()`
    insert into user_plans (clerk_user_id, plan, meta, updated_at)
    values (
      ${clerkUserId},
      'free',
      ${JSON.stringify({
        notification_phone: notificationPhone.phone,
        notification_phone_verified: notificationPhone.verified,
        notification_channels: ['bell', 'mobile', 'phone'],
        founder_name: founderName,
      })}::jsonb,
      now()
    )
    on conflict (clerk_user_id) do update set
      meta = user_plans.meta || excluded.meta,
      updated_at = now()
  `;
  // First-touch welcome — bilingual title/body so the bell renders the
  // founder's locale without a round-trip. The lazy seed inside
  // `getNotifications` covers users provisioned before this hook
  // existed; both paths short-circuit on the `welcome_seeded` meta
  // flag so a founder never sees two welcomes.
  try {
    await pushWelcomeNotification({
      userId: clerkUserId,
      phone: notificationPhone.phone,
      founderName,
    });
    await patchPlanMeta(clerkUserId, {
      welcome_seeded: true,
      notification_phone: notificationPhone.phone,
      notification_phone_verified: notificationPhone.verified,
      notification_channels: ['bell', 'mobile', 'phone'],
      founder_name: founderName,
    });
  } catch (err) {
    console.error('[clerk-webhook] welcome push failed', err);
  }
  try {
    await maybeSendAccountWelcomeEmail(data);
  } catch (err) {
    console.error('[clerk-webhook] account welcome email failed', err);
  }
  await recordPulseActivity({
    source: 'clerk',
    kind: 'user.created',
    actorClerkUserId: clerkUserId,
    ownerClerkUserId: clerkUserId,
    resourceType: 'user',
    resourceId: clerkUserId,
    title: 'User created',
    summary: 'Clerk user created',
  });
}

async function onUserUpdated(data: ClerkUserPayload): Promise<void> {
  const clerkUserId = data.id;
  if (!hasDb() || !clerkUserId) return;
  const notificationPhone = phoneFromClerkUser(data);
  const founderName = ownerNameFromClerkUser(data);
  if (notificationPhone.phone) {
    await patchPlanMeta(clerkUserId, {
      notification_phone: notificationPhone.phone,
      notification_phone_verified: notificationPhone.verified,
      notification_channels: ['bell', 'mobile', 'phone'],
      founder_name: founderName,
    });
  }
  try {
    await maybeSendAccountWelcomeEmail(data);
  } catch (err) {
    console.error('[clerk-webhook] account welcome email failed', err);
  }
  await recordPulseActivity({
    source: 'clerk',
    kind: 'user.updated',
    actorClerkUserId: clerkUserId,
    ownerClerkUserId: clerkUserId,
    resourceType: 'user',
    resourceId: clerkUserId,
    title: 'User updated',
    summary: 'Clerk user updated',
  });
}

/**
 * Map Clerk's `org:admin` / `org:member` (and any custom roles) onto our
 * Role enum. We default to 'editor' for unknown roles so the new member
 * still has a working access set without ever being silently elevated to
 * admin/owner.
 */
function mapClerkRole(clerkRole: string | undefined): Role {
  if (!clerkRole) return 'editor';
  const tail = clerkRole.replace(/^org:/, '');
  if (isRole(tail) && tail !== 'owner') return tail;
  if (tail === 'admin') return 'admin';
  return 'editor';
}

type OrgMembershipPayload = {
  organization?: { id?: string };
  public_user_data?: { user_id?: string };
  role?: string;
};

async function onOrgMembershipCreated(data: OrgMembershipPayload): Promise<void> {
  if (!hasDb()) return;
  const orgId = data.organization?.id;
  const userId = data.public_user_data?.user_id;
  if (!orgId || !userId) return;
  const sf = await getStorefrontByOrg(orgId);
  if (!sf) return;
  await upsertMember({
    storefrontSlug: sf.slug,
    clerkUserId: userId,
    clerkOrgId: orgId,
    role: mapClerkRole(data.role),
    capabilities: {},
  });
  await recordPulseActivity({
    source: 'clerk',
    kind: 'team.member_added',
    actorClerkUserId: userId,
    ownerClerkUserId: sf.clerkUserId,
    storefrontSlug: sf.slug,
    resourceType: 'user',
    resourceId: userId,
    title: 'Team member added',
    summary: `Added team member to ${sf.slug}`,
    metadata: { orgId, role: mapClerkRole(data.role) },
  });
}

async function onOrgMembershipDeleted(data: OrgMembershipPayload): Promise<void> {
  if (!hasDb()) return;
  const orgId = data.organization?.id;
  const userId = data.public_user_data?.user_id;
  if (!orgId || !userId) return;
  const sf = await getStorefrontByOrg(orgId);
  if (sf) {
    await recordPulseActivity({
      source: 'clerk',
      kind: 'team.member_removed',
      actorClerkUserId: userId,
      ownerClerkUserId: sf.clerkUserId,
      storefrontSlug: sf.slug,
      resourceType: 'user',
      resourceId: userId,
      title: 'Team member removed',
      summary: `Removed team member from ${sf.slug}`,
      metadata: { orgId },
    });
  }
  await deleteMembersByOrg(orgId, userId);
}

async function onUserDeleted(clerkUserId: string): Promise<void> {
  if (!hasDb()) return;
  await recordPulseActivity({
    source: 'clerk',
    kind: 'user.deleted',
    actorClerkUserId: clerkUserId,
    ownerClerkUserId: clerkUserId,
    resourceType: 'user',
    resourceId: clerkUserId,
    title: 'User deleted',
    summary: 'Clerk user deleted',
  });
  // briefs.clerk_user_id is the ownership key. Deleting the briefs rows
  // cascades to products, categories, orders, etc. via existing FKs
  // (see schema.sql). We also drop the plan row so the user is fully
  // forgotten on the Souqna side once Clerk has forgotten them.
  await db()`delete from briefs where clerk_user_id = ${clerkUserId}`;
  await db()`delete from user_plans where clerk_user_id = ${clerkUserId}`;
}
