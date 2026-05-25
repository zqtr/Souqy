import 'server-only';
import { db, hasDb } from '@/lib/db';

/**
 * Souqy-specific persistence helpers. Sit alongside `src/lib/brief.ts`
 * but isolated so the core `briefs` accessors stay focused on the
 * dashboard's existing block + theme model.
 */

export type SouqyAuditRow = {
  id: number;
  occurredAt: Date;
  clerkUserId: string;
  storefront: string | null;
  kind: 'generate' | 'reprompt' | 'rollback' | 'paywall_hit' | 'edit_block';
  status:
    | 'pending'
    | 'success'
    | 'validation_failed'
    | 'parse_failed'
    | 'build_failed'
    | 'budget_exceeded'
    | 'rate_limited'
    | 'error';
  prompt: string | null;
  source: string | null;
  meta: Record<string, unknown>;
};

type DbAuditRow = {
  id: string;
  occurred_at: string;
  clerk_user_id: string;
  storefront: string | null;
  kind: SouqyAuditRow['kind'];
  status: SouqyAuditRow['status'];
  prompt: string | null;
  source: string | null;
  meta: unknown;
};

function parseMeta(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function fromAuditRow(row: DbAuditRow): SouqyAuditRow {
  return {
    id: Number(row.id),
    occurredAt: new Date(row.occurred_at),
    clerkUserId: row.clerk_user_id,
    storefront: row.storefront,
    kind: row.kind,
    status: row.status,
    prompt: row.prompt,
    source: row.source,
    meta: parseMeta(row.meta),
  };
}

/**
 * Persist the Souqy revision pointer + the canonical source the founder
 * (and the next re-prompt) sees. `souqy_brief` carries the original
 * brief Claude was asked from — kept for re-prompt context and for
 * audit. Pass `null` for any field you want to leave untouched on a
 * partial update; we always write all four together to avoid drift.
 */
export async function setSouqyRevision(args: {
  slug: string;
  revision: string | null;
  blobUrl: string | null;
  source: string | null;
  brief: Record<string, unknown> | null;
}): Promise<boolean> {
  if (!hasDb()) throw new Error('Database unavailable');
  const briefJson = args.brief == null ? null : JSON.stringify(args.brief);
  const rows = (await db()`
    update briefs set
      souqy_revision = ${args.revision},
      souqy_blob_url = ${args.blobUrl},
      souqy_source   = ${args.source},
      souqy_brief    = coalesce(${briefJson}::jsonb, souqy_brief)
    where slug = ${args.slug}
    returning slug
  `) as unknown as { slug: string }[];
  return rows.length > 0;
}

/**
 * Disable Souqy routing for a storefront without discarding the source
 * or brief. Used when the founder explicitly publishes from the JSON
 * block builder — we want the renderer to fall through to
 * `published_blocks`, but keep `souqy_source` + `souqy_brief` intact so
 * re-enabling Souqy later (rollback or fresh generate) still has the
 * full context to work from.
 */
export async function disableSouqyRouting(slug: string): Promise<boolean> {
  if (!hasDb()) return false;
  const rows = (await db()`
    update briefs set
      souqy_revision = null,
      souqy_blob_url = null
    where slug = ${slug}
    returning slug
  `) as unknown as { slug: string }[];
  return rows.length > 0;
}

export async function logSouqyAudit(args: {
  clerkUserId: string;
  storefront: string | null;
  kind: SouqyAuditRow['kind'];
  status: SouqyAuditRow['status'];
  prompt?: string | null;
  source?: string | null;
  meta?: Record<string, unknown>;
}): Promise<number | null> {
  if (!hasDb()) return null;
  try {
    const rows = (await db()`
      insert into souqy_audit (
        clerk_user_id, storefront, kind, status, prompt, source, meta
      ) values (
        ${args.clerkUserId},
        ${args.storefront},
        ${args.kind},
        ${args.status},
        ${args.prompt ?? null},
        ${args.source ?? null},
        ${JSON.stringify(args.meta ?? {})}::jsonb
      )
      returning id
    `) as unknown as { id: string }[];
    const id = rows[0]?.id;
    return id == null ? null : Number(id);
  } catch (err) {
    console.error('[souqy/audit] insert failed', err);
    return null;
  }
}

/**
 * Update an existing audit row (typically after the async build resolves).
 * Used by the kickoff flow: we insert the audit row up-front with
 * status='pending' so a partial failure leaves a tombstone, then patch
 * it with the final status + meta.
 */
export async function updateSouqyAudit(
  id: number,
  args: {
    status: SouqyAuditRow['status'];
    source?: string | null;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  if (!hasDb()) return;
  try {
    await db()`
      update souqy_audit set
        status = ${args.status},
        source = coalesce(${args.source ?? null}, source),
        meta   = meta || ${JSON.stringify(args.meta ?? {})}::jsonb
      where id = ${id}
    `;
  } catch (err) {
    console.error('[souqy/audit] update failed', err);
  }
}

/**
 * Recent audit rows for a given storefront, newest first. Drives the
 * dashboard "revision history" surface — every successful generate /
 * reprompt is a row with the source preserved, so rollback is cheap.
 */
export async function getSouqyAuditForStorefront(
  slug: string,
  limit = 30,
): Promise<SouqyAuditRow[]> {
  if (!hasDb()) return [];
  const rows = (await db()`
    select * from souqy_audit
    where storefront = ${slug}
    order by occurred_at desc
    limit ${limit}
  `) as unknown as DbAuditRow[];
  return rows.map(fromAuditRow);
}

/**
 * Look up a single past revision so the dashboard can preview / restore
 * an earlier source. The audit row IS the revision history (no separate
 * `souqy_revisions` table) because every generate writes the source.
 */
export async function getSouqyAuditById(id: number): Promise<SouqyAuditRow | null> {
  if (!hasDb()) return null;
  const rows = (await db()`
    select * from souqy_audit where id = ${id} limit 1
  `) as unknown as DbAuditRow[];
  return rows[0] ? fromAuditRow(rows[0]) : null;
}

/**
 * Aggregate per-user generation counts inside the current calendar
 * month. Backs the per-tier monthly cap (Phase 5). We count `success`
 * + `pending` rows — repeated `validation_failed` retries don't burn
 * the founder's quota even though they did consume gateway tokens.
 */
export async function getSouqyMonthlyCount(clerkUserId: string): Promise<number> {
  if (!hasDb()) return 0;
  const rows = (await db()`
    select count(*)::int as n from souqy_audit
    where clerk_user_id = ${clerkUserId}
      and kind in ('generate', 'reprompt')
      and status in ('success', 'pending')
      and occurred_at >= date_trunc('month', now())
  `) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}
