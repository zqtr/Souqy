-- Migration 007 · Souqy code-emit AI (paid tier)
--
-- Adds:
--   * `briefs.souqy_revision`    — current published Souqy bundle id (or null)
--   * `briefs.souqy_source`      — last successful raw TSX source (for re-prompt context)
--   * `briefs.souqy_brief`       — original founder brief (jsonb) Souqy was built from
--   * `user_plans` table         — per-Clerk-user billing tier
--   * `souqy_audit` table        — append-only log of every prompt + generation
--
-- Plan column lives on a dedicated table rather than on `briefs` because a
-- Clerk user can own multiple storefronts but plan is per-user. We avoid
-- denormalizing the plan onto every row (no fan-out updates on upgrade).
--
-- Re-runnable: every alter / create is `if not exists`-guarded.

begin;

alter table briefs
  add column if not exists souqy_revision text;

alter table briefs
  add column if not exists souqy_blob_url text;

alter table briefs
  add column if not exists souqy_source text;

alter table briefs
  add column if not exists souqy_brief jsonb not null default '{}'::jsonb;

create index if not exists briefs_souqy_revision_idx
  on briefs (souqy_revision)
  where souqy_revision is not null;

create table if not exists user_plans (
  clerk_user_id text primary key,
  plan          text not null default 'free',
  -- Free-form jsonb so a future Stripe / Vercel Marketplace integration
  -- can stash subscription_id, current_period_end, etc. without migration.
  meta          jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);

create table if not exists souqy_audit (
  id            bigserial primary key,
  occurred_at   timestamptz not null default now(),
  clerk_user_id text not null,
  storefront    text,
  -- 'generate' | 'reprompt' | 'rollback' | 'paywall_hit'
  kind          text not null,
  -- 'pending' | 'success' | 'validation_failed' | 'build_failed'
  --        | 'budget_exceeded' | 'rate_limited' | 'error'
  status        text not null default 'pending',
  prompt        text,
  source        text,
  -- Tokens, latency, gateway cost, model, revision id, error info, etc.
  meta          jsonb not null default '{}'::jsonb
);

create index if not exists souqy_audit_user_idx
  on souqy_audit (clerk_user_id, occurred_at desc);
create index if not exists souqy_audit_storefront_idx
  on souqy_audit (storefront, occurred_at desc);

commit;
