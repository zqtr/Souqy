import { unstable_noStore as noStore } from 'next/cache';
import { db } from './db';
import { getStorefront } from './brief';
import { recordPulseActivity } from './pulseActivity';

/**
 * Generic per-storefront action log. Different from `souqy_audit`
 * (which is per-Clerk-user, used for AI billing reconciliation) — this
 * one feeds Settings → Activity log and the recent-activity row on Home.
 *
 * The action string is free-form but conventionally namespaced
 * `<resource>.<verb>` (e.g. 'product.create', 'order.refund',
 * 'app.install', 'storefront.publish').
 */
export type AuditEntry = {
  id: number;
  occurredAt: Date;
  storefrontSlug: string;
  clerkUserId: string;
  action: string;
  targetId: string | null;
  summary: string | null;
  meta: Record<string, unknown>;
};

type AuditRow = {
  id: number;
  occurred_at: string;
  storefront_slug: string;
  clerk_user_id: string;
  action: string;
  target_id: string | null;
  summary: string | null;
  meta: unknown;
};

function fromRow(r: AuditRow): AuditEntry {
  return {
    id: r.id,
    occurredAt: new Date(r.occurred_at),
    storefrontSlug: r.storefront_slug,
    clerkUserId: r.clerk_user_id,
    action: r.action,
    targetId: r.target_id,
    summary: r.summary,
    meta:
      r.meta && typeof r.meta === 'object'
        ? (r.meta as Record<string, unknown>)
        : {},
  };
}

export type AuditWriteInput = {
  storefrontSlug: string;
  clerkUserId: string;
  action: string;
  targetId?: string | null;
  summary?: string | null;
  meta?: Record<string, unknown>;
};

export async function recordAudit(input: AuditWriteInput): Promise<void> {
  await db()`
    insert into audit_log (
      storefront_slug, clerk_user_id, action,
      target_id, summary, meta
    ) values (
      ${input.storefrontSlug}, ${input.clerkUserId}, ${input.action},
      ${input.targetId ?? null}, ${input.summary ?? null},
      ${JSON.stringify(input.meta ?? {})}::jsonb
    )
  `;
  const storefront = await getStorefront(input.storefrontSlug).catch(() => null);
  await recordPulseActivity({
    source: 'audit',
    kind: input.action,
    actorClerkUserId: input.clerkUserId,
    ownerClerkUserId: storefront?.clerkUserId ?? input.clerkUserId,
    storefrontSlug: input.storefrontSlug,
    resourceType: input.action.split('.')[0] ?? 'audit',
    resourceId: input.targetId ?? null,
    title: input.summary ?? input.action,
    summary: input.summary ?? input.action,
    metadata: input.meta ?? {},
  });
}

export async function recentActivity(
  storefrontSlug: string,
  limit = 20,
): Promise<AuditEntry[]> {
  noStore();
  const rows = (await db()`
    select * from audit_log
    where storefront_slug = ${storefrontSlug}
    order by occurred_at desc
    limit ${limit}
  `) as unknown as AuditRow[];
  return rows.map(fromRow);
}

export async function recentActivityForUser(
  clerkUserId: string,
  limit = 20,
): Promise<AuditEntry[]> {
  noStore();
  const rows = (await db()`
    select * from audit_log
    where clerk_user_id = ${clerkUserId}
    order by occurred_at desc
    limit ${limit}
  `) as unknown as AuditRow[];
  return rows.map(fromRow);
}
