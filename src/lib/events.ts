import 'server-only';
import { createHash } from 'node:crypto';
import { db, hasDb } from './db';
import { env } from './env';
import { recordPulseActivity } from './pulseActivity';

/**
 * Souqna Pulse · event journal.
 *
 * `logEvent` is the single ingress point for every "interesting thing"
 * that happens on souqna.qa. Calls are fire-and-forget — we never let
 * an analytics insert block or fail a user-facing action.
 *
 * Schema lives in src/db/migrations/006_events.sql. Add new event
 * kinds freely; the Mac client decides how to render unknowns.
 *
 * Conventions:
 *   - kind: dot.snake_case ('begin.clicked', 'storefront.published')
 *   - funnel: short tag for grouping ('onboarding' | 'storefront' | 'engage')
 *   - step: 1-based position inside the funnel (optional)
 *   - props: small JSON payload (avoid PII; we already capture user_id)
 */

export type EventInput = {
  kind: string;
  funnel?: 'onboarding' | 'storefront' | 'engage' | 'visit';
  step?: number;
  userId?: string | null;
  storefront?: string | null;
  props?: Record<string, unknown>;
  /** Raw IP string; hashed before insertion. */
  ip?: string | null;
  ua?: string | null;
};

/**
 * Stable, salted hash so we can count unique visitors without storing
 * the raw IP. The salt is a server secret in env so two installs of
 * Souqna can't cross-correlate hashes.
 */
function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = env.PULSE_IP_SALT ?? '';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

export async function logEvent(input: EventInput): Promise<void> {
  if (!hasDb()) return;
  try {
    const sql = db();
    await sql`
      insert into events (kind, funnel, step, user_id, storefront, props, ip_hash, ua)
      values (
        ${input.kind},
        ${input.funnel ?? null},
        ${input.step ?? null},
        ${input.userId ?? null},
        ${input.storefront ?? null},
        ${JSON.stringify(input.props ?? {})}::jsonb,
        ${hashIp(input.ip)},
        ${input.ua ?? null}
      )
    `;
    await recordPulseActivity({
      source: 'events',
      kind: input.kind,
      actorClerkUserId: input.userId ?? null,
      ownerClerkUserId: input.userId ?? null,
      storefrontSlug: input.storefront ?? null,
      resourceType: input.storefront ? 'storefront' : 'event',
      resourceId: input.storefront ?? null,
      summary: input.kind,
      metadata: {
        ...(input.props ?? {}),
        funnel: input.funnel ?? null,
        step: input.step ?? null,
      },
    });
  } catch (err) {
    // Analytics MUST NEVER throw out of caller flow.
    console.warn('[events] log failed', input.kind, err);
  }
}

/**
 * Convenience: read recent events for the Pulse dashboard. Strictly
 * read-only and only ever called from the protected /api/dashboard
 * route, never the public site.
 */
export type EventRow = {
  id: number;
  occurredAt: string;
  kind: string;
  funnel: string | null;
  step: number | null;
  userId: string | null;
  storefront: string | null;
  props: Record<string, unknown>;
};

export async function readEvents(opts: {
  since?: string;
  limit?: number;
}): Promise<EventRow[]> {
  if (!hasDb()) return [];
  const sql = db();
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const rows = (opts.since
    ? await sql`
        select id, occurred_at, kind, funnel, step, user_id, storefront, props
        from events
        where occurred_at > ${opts.since}::timestamptz
        order by occurred_at desc
        limit ${limit}
      `
    : await sql`
        select id, occurred_at, kind, funnel, step, user_id, storefront, props
        from events
        order by occurred_at desc
        limit ${limit}
      `) as Array<{
    id: number;
    occurred_at: Date | string;
    kind: string;
    funnel: string | null;
    step: number | null;
    user_id: string | null;
    storefront: string | null;
    props: unknown;
  }>;
  return rows.map((r) => ({
    id: Number(r.id),
    occurredAt:
      typeof r.occurred_at === 'string' ? r.occurred_at : r.occurred_at.toISOString(),
    kind: r.kind,
    funnel: r.funnel,
    step: r.step,
    userId: r.user_id,
    storefront: r.storefront,
    props: (r.props && typeof r.props === 'object' ? (r.props as Record<string, unknown>) : {}),
  }));
}

/**
 * Per-funnel counts for the rolling window the Pulse dashboard shows.
 * Returns shape { onboarding: { begin_clicked: n, ... }, storefront: {...} }
 */
export async function readFunnelSummary(opts: {
  hours?: number;
}): Promise<Record<string, Record<string, number>>> {
  if (!hasDb()) return {};
  const sql = db();
  const hours = Math.min(Math.max(opts.hours ?? 24, 1), 24 * 30);
  const rows = (await sql`
    select coalesce(funnel, 'misc') as funnel, kind, count(*)::int as n
    from events
    where occurred_at > now() - (${hours} || ' hours')::interval
    group by funnel, kind
    order by funnel, kind
  `) as Array<{ funnel: string; kind: string; n: number }>;
  const out: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    out[r.funnel] = out[r.funnel] ?? {};
    out[r.funnel]![r.kind] = r.n;
  }
  return out;
}
