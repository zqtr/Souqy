import 'server-only';
import { unstable_noStore as noStore } from 'next/cache';
import { db, hasDb } from './db';

export type PulseActivityVisibility = 'operator' | 'owner' | 'internal';

export type PulseActivity = {
  id: number;
  occurredAt: string;
  actorClerkUserId: string | null;
  ownerClerkUserId: string | null;
  storefrontSlug: string | null;
  source: string;
  kind: string;
  resourceType: string | null;
  resourceId: string | null;
  title: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  visibility: PulseActivityVisibility;
};

type PulseActivityRow = {
  id: number;
  occurred_at: Date | string;
  actor_clerk_user_id: string | null;
  owner_clerk_user_id: string | null;
  storefront_slug: string | null;
  source: string;
  kind: string;
  resource_type: string | null;
  resource_id: string | null;
  title: string | null;
  summary: string | null;
  metadata: unknown;
  visibility: PulseActivityVisibility;
};

export type PulseActivityWriteInput = {
  occurredAt?: Date | string | null;
  actorClerkUserId?: string | null;
  ownerClerkUserId?: string | null;
  storefrontSlug?: string | null;
  source: string;
  kind: string;
  resourceType?: string | null;
  resourceId?: string | null;
  title?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
  visibility?: PulseActivityVisibility;
};

export type PulseActivityFilters = {
  since?: string;
  limit?: number;
  clerkUserId?: string;
  actorClerkUserId?: string;
  storefront?: string;
  resourceType?: string;
  kind?: string;
  kinds?: string[];
};

export type PulseActivitySummary = {
  totalsByKind: Record<string, number>;
  activeUsers: number;
  publishedStorefronts: number;
  deletedProducts: number;
};

function toActivity(row: PulseActivityRow): PulseActivity {
  return {
    id: Number(row.id),
    occurredAt:
      typeof row.occurred_at === 'string' ? row.occurred_at : row.occurred_at.toISOString(),
    actorClerkUserId: row.actor_clerk_user_id,
    ownerClerkUserId: row.owner_clerk_user_id,
    storefrontSlug: row.storefront_slug,
    source: row.source,
    kind: row.kind,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    title: row.title,
    summary: row.summary,
    metadata:
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {},
    visibility: row.visibility,
  };
}

function cleanList(values: string[] | undefined): string | null {
  if (!values?.length) return null;
  const cleaned = values.map((v) => v.trim()).filter(Boolean);
  return cleaned.length ? cleaned.join(',') : null;
}

function limitFor(input: number | undefined): number {
  return Math.min(Math.max(input ?? 100, 1), 500);
}

export async function recordPulseActivity(input: PulseActivityWriteInput): Promise<void> {
  if (!hasDb()) return;
  try {
    await db()`
      insert into pulse_activity (
        occurred_at, actor_clerk_user_id, owner_clerk_user_id, storefront_slug,
        source, kind, resource_type, resource_id, title, summary, metadata, visibility
      ) values (
        ${input.occurredAt ?? new Date()}, ${input.actorClerkUserId ?? null},
        ${input.ownerClerkUserId ?? null}, ${input.storefrontSlug ?? null},
        ${input.source}, ${input.kind}, ${input.resourceType ?? null},
        ${input.resourceId ?? null}, ${input.title ?? null}, ${input.summary ?? null},
        ${JSON.stringify(input.metadata ?? {})}::jsonb,
        ${input.visibility ?? 'operator'}
      )
    `;
  } catch (err) {
    // Pulse must not block user-facing mutations.
    console.warn('[pulse_activity] write failed', input.kind, err);
  }
}

export async function readPulseActivity(
  filters: PulseActivityFilters = {},
): Promise<PulseActivity[]> {
  noStore();
  if (!hasDb()) return [];
  const kindList = cleanList(filters.kinds);
  const limit = limitFor(filters.limit);
  const rows = (await db()`
    select *
    from pulse_activity
    where (${filters.since ?? null}::timestamptz is null or occurred_at > ${filters.since ?? null}::timestamptz)
      and (${filters.clerkUserId ?? null}::text is null or owner_clerk_user_id = ${filters.clerkUserId ?? null})
      and (${filters.actorClerkUserId ?? null}::text is null or actor_clerk_user_id = ${filters.actorClerkUserId ?? null})
      and (${filters.storefront ?? null}::text is null or storefront_slug = ${filters.storefront ?? null})
      and (${filters.resourceType ?? null}::text is null or resource_type = ${filters.resourceType ?? null})
      and (${kindList}::text is null or kind = any(string_to_array(${kindList ?? ''}, ',')))
      and (
        ${filters.kind ?? null}::text is null
        or kind = ${filters.kind ?? null}
        or kind like (${filters.kind ?? ''} || '.%')
      )
    order by occurred_at desc, id desc
    limit ${limit}
  `) as unknown as PulseActivityRow[];
  return rows.map(toActivity);
}

export async function readPulseSummary(
  filters: Omit<PulseActivityFilters, 'limit'> = {},
): Promise<PulseActivitySummary> {
  noStore();
  if (!hasDb()) {
    return { totalsByKind: {}, activeUsers: 0, publishedStorefronts: 0, deletedProducts: 0 };
  }
  const kindList = cleanList(filters.kinds);
  const rows = (await db()`
    select kind, count(*)::int as n
    from pulse_activity
    where (${filters.since ?? null}::timestamptz is null or occurred_at > ${filters.since ?? null}::timestamptz)
      and (${filters.clerkUserId ?? null}::text is null or owner_clerk_user_id = ${filters.clerkUserId ?? null})
      and (${filters.actorClerkUserId ?? null}::text is null or actor_clerk_user_id = ${filters.actorClerkUserId ?? null})
      and (${filters.storefront ?? null}::text is null or storefront_slug = ${filters.storefront ?? null})
      and (${filters.resourceType ?? null}::text is null or resource_type = ${filters.resourceType ?? null})
      and (${kindList}::text is null or kind = any(string_to_array(${kindList ?? ''}, ',')))
      and (
        ${filters.kind ?? null}::text is null
        or kind = ${filters.kind ?? null}
        or kind like (${filters.kind ?? ''} || '.%')
      )
    group by kind
    order by kind
  `) as Array<{ kind: string; n: number }>;

  const aggregateRows = (await db()`
    select
      count(distinct coalesce(owner_clerk_user_id, actor_clerk_user_id))::int as active_users,
      count(distinct storefront_slug) filter (where kind = 'storefront.published')::int as published_storefronts,
      count(*) filter (where kind = 'product.deleted')::int as deleted_products
    from pulse_activity
    where (${filters.since ?? null}::timestamptz is null or occurred_at > ${filters.since ?? null}::timestamptz)
      and (${filters.clerkUserId ?? null}::text is null or owner_clerk_user_id = ${filters.clerkUserId ?? null})
      and (${filters.actorClerkUserId ?? null}::text is null or actor_clerk_user_id = ${filters.actorClerkUserId ?? null})
      and (${filters.storefront ?? null}::text is null or storefront_slug = ${filters.storefront ?? null})
      and (${filters.resourceType ?? null}::text is null or resource_type = ${filters.resourceType ?? null})
      and (${kindList}::text is null or kind = any(string_to_array(${kindList ?? ''}, ',')))
      and (
        ${filters.kind ?? null}::text is null
        or kind = ${filters.kind ?? null}
        or kind like (${filters.kind ?? ''} || '.%')
      )
  `) as Array<{
    active_users: number;
    published_storefronts: number;
    deleted_products: number;
  }>;

  const totalsByKind: Record<string, number> = {};
  for (const row of rows) totalsByKind[row.kind] = Number(row.n);
  const aggregate = aggregateRows[0];

  return {
    totalsByKind,
    activeUsers: Number(aggregate?.active_users ?? 0),
    publishedStorefronts: Number(aggregate?.published_storefronts ?? 0),
    deletedProducts: Number(aggregate?.deleted_products ?? 0),
  };
}
