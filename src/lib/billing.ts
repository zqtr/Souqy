import 'server-only';
import { db, hasDb } from './db';
import {
  ANNUAL_DISCOUNT_PCT,
  UPGRADE_GROWTH_TOOLS_COPY,
  annualSavingsFor,
  annualTotalFor,
  aiCreditsForPlan,
  monthlyOrderCapForPlan,
  PLAN_LIMITS,
  PLAN_GATES_DISABLED,
  PLAN_RANK,
  PLANS,
  PREMIUM_BLOCK_TYPES,
  platformFeeBpsForPlan,
  platformFeeForTotal,
  isPremiumBlockType,
  planUnlocksAnalytics,
  planUnlocksApiAccess,
  planUnlocksAutomationFlows,
  planUnlocksBrandingRemoval,
  planUnlocksCustomDomain,
  planUnlocksDiscounts,
  planUnlocksIntegrations,
  planUnlocksMonthlyPayments,
  planUnlocksPremiumBlocks,
  planUnlocksSeoSettings,
  planUnlocksSouqy,
  planUnlocksTeamMembers,
  planAtLeast,
  planLabel,
  priceFor,
  productCapForPlan,
  sellerNetForTotal,
  storefrontCapForPlan,
  type BillingCycle,
  type Plan,
} from './plans';

/**
 * Billing tiers — four cumulative tiers, ranked by capability.
 *
 *   - `free`     - displayed as Free. 1 storefront, 10 products, 25 orders/month.
 *   - `starter`  - displayed as Pro. 2 storefronts, custom domain, 3% fee.
 *   - `pro`      - displayed as Pro+. 8 storefronts, Souqy, automation, 1% fee.
 *   - `atelier`  - displayed as Max+. Unlimited storefronts, API, 0% fee.
 *
 * The pure data (Plan literal, ranks, marketing copy, helpers) lives in
 * `src/lib/plans.ts` so client components can import it without pulling
 * the `server-only` DB layer into their bundle. This module is the
 * server-side surface — every `getPlan` / `setPlan` / gate goes
 * through here.
 *
 * Stored in a dedicated `user_plans` table (see migration 007) keyed by
 * Clerk user id. Per-user, NOT per-storefront — a founder who owns three
 * stores upgrades once.
 *
 * Backwards compatibility: the previous plan IDs were `'free'` and
 * `'atelier_pro'`; migration 013 backfills any stale `atelier_pro` rows
 * to the new top tier `'atelier'`. `isPlan` also accepts `'atelier_pro'`
 * as an alias for `'atelier'` so a row that hasn't migrated yet still
 * resolves to a real plan instead of falling back to `'free'`.
 */
export {
  ANNUAL_DISCOUNT_PCT,
  UPGRADE_GROWTH_TOOLS_COPY,
  annualSavingsFor,
  annualTotalFor,
  aiCreditsForPlan,
  monthlyOrderCapForPlan,
  PLAN_LIMITS,
  PLAN_GATES_DISABLED,
  PLAN_RANK,
  PLANS,
  PREMIUM_BLOCK_TYPES,
  platformFeeBpsForPlan,
  platformFeeForTotal,
  isPremiumBlockType,
  planUnlocksAnalytics,
  planUnlocksApiAccess,
  planUnlocksAutomationFlows,
  planUnlocksBrandingRemoval,
  planUnlocksCustomDomain,
  planUnlocksDiscounts,
  planUnlocksIntegrations,
  planUnlocksMonthlyPayments,
  planUnlocksPremiumBlocks,
  planUnlocksSeoSettings,
  planUnlocksSouqy,
  planUnlocksTeamMembers,
  planAtLeast,
  planLabel,
  priceFor,
  productCapForPlan,
  sellerNetForTotal,
  storefrontCapForPlan,
};
export type { BillingCycle, Plan };

function isPlan(v: unknown): v is Plan {
  if (typeof v !== 'string') return false;
  if ((PLANS as readonly string[]).includes(v)) return true;
  // Legacy alias from the pre-2026-04 two-tier model. Resolved at read
  // time so a user_plans row that pre-dates the migration still gates
  // correctly even before migration 013 has been run on a given env.
  return v === 'atelier_pro';
}

function normalisePlan(v: string): Plan {
  if (v === 'atelier_pro') return 'atelier';
  return (PLANS as readonly string[]).includes(v) ? (v as Plan) : 'free';
}

/**
 * Returns the user's current plan. Defaults to `'free'` when:
 *   - the DB is unavailable (local dev without DATABASE_URL),
 *   - the user has no row yet (every Clerk user starts on free implicitly).
 *
 * Does NOT throw on missing rows — that would force every caller to
 * insert a default row before the first read, which is the exact race
 * condition the migration's `default 'free'` on the column avoids.
 */
/**
 * Returns the opaque `meta` blob for a user's plan row. Used by the
 * checkout action to look up the existing Stripe customer id (so we
 * don't create a fresh customer for the same Clerk user every time
 * they click "Upgrade") and by the webhook to read `subscriptionId`,
 * `currentPeriodEnd`, etc. Returns an empty object when the row is
 * missing, the DB is unavailable, or the meta is malformed — same
 * defaulting philosophy as `getPlan`.
 */
export async function getPlanMeta(clerkUserId: string): Promise<Record<string, unknown>> {
  if (!clerkUserId || !hasDb()) return {};
  try {
    const rows = (await db()`
      select meta from user_plans where clerk_user_id = ${clerkUserId} limit 1
    `) as unknown as { meta: unknown }[];
    const m = rows[0]?.meta;
    return m && typeof m === 'object' ? (m as Record<string, unknown>) : {};
  } catch (err) {
    console.error('[billing] getPlanMeta failed', err);
    return {};
  }
}

/**
 * Merge-patch the `meta` jsonb for a user's plan row without changing
 * the plan itself. Used to stash Stripe customer ids before the first
 * subscription event lands. The row is created (with `plan = 'free'`)
 * if it doesn't exist yet.
 */
export async function patchPlanMeta(
  clerkUserId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!hasDb()) throw new Error('Database unavailable');
  await db()`
    insert into user_plans (clerk_user_id, plan, meta, updated_at)
    values (${clerkUserId}, 'free', ${JSON.stringify(patch)}::jsonb, now())
    on conflict (clerk_user_id) do update set
      meta       = user_plans.meta || excluded.meta,
      updated_at = now()
  `;
}

export async function getPlan(clerkUserId: string): Promise<Plan> {
  if (!clerkUserId) return 'free';
  if (!hasDb()) return 'free';
  try {
    const rows = (await db()`
      select plan from user_plans where clerk_user_id = ${clerkUserId} limit 1
    `) as unknown as { plan: string }[];
    const row = rows[0];
    if (!row) return 'free';
    return isPlan(row.plan) ? normalisePlan(row.plan) : 'free';
  } catch (err) {
    console.error('[billing] getPlan failed', err);
    return 'free';
  }
}

/**
 * Idempotent upsert of a user's plan. Used by:
 *   - the Stripe / Vercel Marketplace webhook (Phase 0.5; not wired yet)
 *   - the manual admin grant action (`grantPlan`) for closed-beta access
 *
 * `meta` carries provider-specific subscription state — opaque to us.
 */
export async function setPlan(
  clerkUserId: string,
  plan: Plan,
  meta: Record<string, unknown> = {},
): Promise<void> {
  if (!hasDb()) throw new Error('Database unavailable');
  await db()`
    insert into user_plans (clerk_user_id, plan, meta, updated_at)
    values (${clerkUserId}, ${plan}, ${JSON.stringify(meta)}::jsonb, now())
    on conflict (clerk_user_id) do update set
      plan       = excluded.plan,
      meta       = user_plans.meta || excluded.meta,
      updated_at = now()
  `;
}

/**
 * Hard gate used by every Souqy server action. Returns a discriminated
 * union so callers can short-circuit with a typed error instead of
 * branching on truthy/falsy. The `'paywall'` status carries no message
 * — UI surfaces a paywall component instead of a toast.
 *
 * Souqy is a Pro-tier feature: any plan at `pro` or above passes.
 */
export type GateResult =
  | { ok: true; plan: Plan }
  | { ok: false; reason: 'paywall' | 'unauthenticated' };

/**
 * Append a row to the plan_history ledger. Best-effort — never throws,
 * never blocks the caller. Webhook redelivery is absorbed by the
 * `unique (provider_event_id)` constraint via `do nothing`.
 */
export async function recordPlanHistory(input: {
  clerkUserId: string;
  fromPlan: Plan | null;
  toPlan: Plan;
  cycle: BillingCycle | null;
  source:
    | 'skipcash_webhook'
    | 'skipcash_poll'
    | 'stripe_webhook'
    | 'admin_grant'
    | 'system_default';
  providerEventId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  if (!hasDb() || !input.clerkUserId) return;
  if (input.fromPlan === input.toPlan) return;
  try {
    await db()`
      insert into plan_history
        (clerk_user_id, from_plan, to_plan, cycle, source, provider_event_id, meta)
      values (
        ${input.clerkUserId},
        ${input.fromPlan ?? null},
        ${input.toPlan},
        ${input.cycle ?? null},
        ${input.source},
        ${input.providerEventId ?? null},
        ${JSON.stringify(input.meta ?? {})}::jsonb
      )
      on conflict (provider_event_id) do nothing
    `;
  } catch (err) {
    console.error('[billing] recordPlanHistory failed', err);
  }
}

export async function listPlanHistory(
  clerkUserId: string,
  limit = 20,
): Promise<
  Array<{
    id: string;
    fromPlan: string | null;
    toPlan: string;
    cycle: string | null;
    source: string;
    createdAt: string;
    meta: Record<string, unknown>;
  }>
> {
  if (!hasDb() || !clerkUserId) return [];
  try {
    const rows = (await db()`
      select id, from_plan, to_plan, cycle, source, created_at, meta
      from plan_history
      where clerk_user_id = ${clerkUserId}
      order by created_at desc
      limit ${Math.min(Math.max(limit, 1), 100)}
    `) as unknown as Array<{
      id: string;
      from_plan: string | null;
      to_plan: string;
      cycle: string | null;
      source: string;
      created_at: string;
      meta: unknown;
    }>;
    return rows.map((r) => ({
      id: r.id,
      fromPlan: r.from_plan,
      toPlan: r.to_plan,
      cycle: r.cycle,
      source: r.source,
      createdAt: r.created_at,
      meta: r.meta && typeof r.meta === 'object' ? (r.meta as Record<string, unknown>) : {},
    }));
  } catch (err) {
    console.error('[billing] listPlanHistory failed', err);
    return [];
  }
}

export async function gateAtelierPro(clerkUserId: string | null): Promise<GateResult> {
  if (!clerkUserId) return { ok: false, reason: 'unauthenticated' };
  const plan = await getPlan(clerkUserId);
  if (!planUnlocksSouqy(plan)) return { ok: false, reason: 'paywall' };
  return { ok: true, plan };
}
