'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';

import { env } from '@/lib/env';
import { hasDb } from '@/lib/db';
import {
  createNotification,
  getUnreadCount,
  listForUser,
  listNotifications,
  markAllRead,
  markAllSeen,
  markRead,
  pushWelcomeNotification,
  unseenCount,
  type Notification,
  type NotificationRow,
} from '@/lib/notifications';
import { patchPlanMeta } from '@/lib/billing';
import {
  getStorefront,
  getStorefrontsForUser,
  updateSubdomainStatus,
} from '@/lib/brief';
import { getPlan, getPlanMeta } from '@/lib/billing';
import { planLabel } from '@/lib/plans';
import {
  ensureStorefrontDomain,
  getStorefrontDomainStatus,
} from '@/lib/vercelDomains';

const SlugSchema = z.string().trim().min(3).max(40);

export interface NotificationsSnapshot {
  unseen: number;
  rows: SerializedNotification[];
  /** Storefronts owned by the current user that are still provisioning. */
  pendingSubdomains: PendingSubdomain[];
  /** Live plan info for the countdown chip in the popover header. */
  plan: {
    id: string;
    label: string;
    /** ISO timestamp when the current paid period ends, or null on free. */
    periodEnd: string | null;
  };
}

export interface SerializedNotification {
  id: string;
  kind: NotificationRow['kind'];
  title: string;
  body: string | null;
  href: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
  seenAt: string | null;
}

export interface PendingSubdomain {
  slug: string;
  businessName: string;
  url: string;
}

function serialize(rows: NotificationRow[]): SerializedNotification[] {
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    href: r.href,
    meta: r.meta,
    createdAt: r.createdAt.toISOString(),
    seenAt: r.seenAt ? r.seenAt.toISOString() : null,
  }));
}

async function pendingForUser(userId: string): Promise<PendingSubdomain[]> {
  if (!hasDb()) return [];
  const stores = await getStorefrontsForUser(userId);
  const root = env.BRIEF_ROOT_DOMAIN;
  return stores
    .filter((s) => s.isPublished && s.subdomainStatus !== 'live')
    .map((s) => ({
      slug: s.slug,
      businessName: s.businessName,
      url: `https://${s.slug}.${root}`,
    }));
}

export async function getNotificationsSnapshot(): Promise<NotificationsSnapshot> {
  const { userId } = await auth();
  if (!userId) {
    return {
      unseen: 0,
      rows: [],
      pendingSubdomains: [],
      plan: { id: 'free', label: 'Free', periodEnd: null },
    };
  }
  const [rows, unseen, pending, plan, meta] = await Promise.all([
    listForUser(userId, { limit: 30 }),
    unseenCount(userId),
    pendingForUser(userId),
    getPlan(userId),
    getPlanMeta(userId),
  ]);
  const periodEnd =
    typeof meta.currentPeriodEnd === 'string' ? meta.currentPeriodEnd : null;
  return {
    unseen,
    rows: serialize(rows),
    pendingSubdomains: pending,
    plan: { id: plan, label: planLabel(plan), periodEnd },
  };
}

export async function markNotificationsSeen(): Promise<{ unseen: 0 }> {
  const { userId } = await auth();
  if (!userId) return { unseen: 0 };
  await markAllSeen(userId);
  return { unseen: 0 };
}

/**
 * Poll Vercel for one storefront's apex cert. Promotes the row to
 * `subdomain_status = 'live'` and emits a `storefront.live`
 * notification on the first `pending → live` transition. Idempotent:
 * a second poll after `live` is a no-op (and returns immediately).
 *
 * Caller-gated to the storefront owner so a leaked slug can't drive
 * arbitrary Vercel API calls. Returns the latest snapshot so the bell
 * can stop polling without another round-trip.
 */
export async function pollStorefrontDomain(input: {
  slug: string;
}): Promise<{ status: 'pending' | 'live' | 'failed'; url: string }> {
  const parsed = SlugSchema.safeParse(input.slug);
  const root = env.BRIEF_ROOT_DOMAIN;
  if (!parsed.success) {
    return { status: 'failed', url: '' };
  }
  const slug = parsed.data;
  const url = `https://${slug}.${root}`;
  const { userId } = await auth();
  if (!userId) return { status: 'failed', url };

  const sf = await getStorefront(slug);
  if (!sf || sf.clerkUserId !== userId) return { status: 'failed', url };
  if (sf.subdomainStatus === 'live') return { status: 'live', url };

  const snapshot = await getStorefrontDomainStatus(slug);
  if (!snapshot.attached) {
    // Publish silently failed at some point; try once more here.
    const ensured = await ensureStorefrontDomain(slug);
    if (!ensured.ok) {
      await updateSubdomainStatus(slug, 'failed', ensured.message);
      Sentry.captureMessage('subdomain provision failed (poll)', {
        level: 'warning',
        extra: { slug, message: ensured.message },
      });
      return { status: 'failed', url };
    }
  }
  if (snapshot.hasCert) {
    await updateSubdomainStatus(slug, 'live');
    await createNotification({
      userId,
      kind: 'storefront.live',
      title: 'Your store is live',
      body: `${slug}.${root} is reachable.`,
      href: url,
      meta: { slug, url },
    });
    revalidatePath('/account');
    return { status: 'live', url };
  }
  return { status: 'pending', url };
}

/**
 * Manually re-run domain provisioning for a storefront whose first
 * attempt landed on `failed`. Wired to the bell row's "Retry" button.
 */
/* ────────────────────────────────────────────────────────────────── */
/* Bilingual notification surface for the bell + /#billing tracker.    */
/* ────────────────────────────────────────────────────────────────── */

const ListSchema = z.object({ before: z.string().uuid().optional() }).optional();
const IdsSchema = z.object({ ids: z.array(z.string().uuid()).max(200) });

async function maybeSeedWelcome(userId: string): Promise<void> {
  if (!hasDb()) return;
  try {
    const meta = await getPlanMeta(userId);
    if (meta.welcome_seeded === true) return;
    const existing = await getUnreadCount(userId);
    // Defence in depth — if any notification exists, skip; covers the
    // case where the welcome was sent via the Clerk webhook but the
    // meta flag was never set (e.g. row pre-dates this code).
    const anyRows = (await listNotifications(userId, { limit: 1 })).length > 0;
    if (existing > 0 || anyRows) {
      await patchPlanMeta(userId, { welcome_seeded: true });
      return;
    }
    await pushWelcomeNotification({
      userId,
      phone: typeof meta.notification_phone === 'string' ? meta.notification_phone : null,
    });
    await patchPlanMeta(userId, { welcome_seeded: true });
  } catch (err) {
    console.error('[notifications] welcome seed failed', err);
  }
}

export async function getNotifications(
  input?: { before?: string },
): Promise<Notification[]> {
  const parsed = ListSchema.safeParse(input);
  if (!parsed.success) return [];
  const { userId } = await auth();
  if (!userId) return [];
  await maybeSeedWelcome(userId);
  return listNotifications(userId, { limit: 20, before: parsed.data?.before });
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { userId } = await auth();
  if (!userId) return 0;
  return getUnreadCount(userId);
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  const parsed = IdsSchema.safeParse({ ids });
  if (!parsed.success) return;
  const { userId } = await auth();
  if (!userId) return;
  await markRead({ userId, ids: parsed.data.ids });
}

export async function markAllNotificationsRead(): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;
  await markAllRead(userId);
}

export async function syncNotificationPhoneFromClerk(): Promise<{
  ok: boolean;
  message?: string;
}> {
  const { userId } = await auth();
  if (!userId) return { ok: false, message: 'Sign in again to continue.' };
  const user = await currentUser();
  const verifiedPhone =
    user?.primaryPhoneNumber?.verification?.status === 'verified'
      ? user.primaryPhoneNumber
      : user?.phoneNumbers?.find((phone) => phone.verification?.status === 'verified');
  if (!verifiedPhone?.phoneNumber) {
    return { ok: false, message: 'Add and verify a phone number first.' };
  }
  await patchPlanMeta(userId, {
    notification_phone: verifiedPhone.phoneNumber,
    notification_phone_verified: true,
    notification_channels: ['bell', 'mobile', 'phone'],
  });
  return { ok: true };
}

export async function retryStorefrontDomain(input: {
  slug: string;
}): Promise<{ ok: boolean; message?: string; primaryUrl?: string; fallbackUrl?: string }> {
  const parsed = SlugSchema.safeParse(input.slug);
  if (!parsed.success) return { ok: false, message: 'Invalid request' };
  const slug = parsed.data;
  const { userId } = await auth();
  if (!userId) return { ok: false, message: 'Forbidden' };
  const sf = await getStorefront(slug);
  if (!sf || sf.clerkUserId !== userId) return { ok: false, message: 'Forbidden' };

  const ensured = await ensureStorefrontDomain(slug);
  if (!ensured.ok) {
    await updateSubdomainStatus(slug, 'failed', ensured.message);
    return {
      ok: false,
      message: ensured.fallbackUrl
        ? `Primary domain still needs attention. Backup link is available at ${ensured.fallbackUrl}.`
        : ensured.message,
      primaryUrl: ensured.primaryUrl,
      fallbackUrl: ensured.fallbackUrl,
    };
  }
  await updateSubdomainStatus(slug, ensured.status === 'exists' ? 'live' : 'pending');
  return { ok: true, primaryUrl: ensured.primaryUrl, fallbackUrl: ensured.fallbackUrl };
}
