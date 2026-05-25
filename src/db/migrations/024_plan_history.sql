-- Migration 024 · Plan-change ledger.
--
-- Append-only history of every transition between billing tiers. Powers
-- the "subscription tracker" timeline on /#billing and on the in-app
-- /account/settings/plan page. Distinct from `notifications` because the
-- read-shape (timeline, no unread state, no popover) and lifecycle
-- (kept forever) are different.
--
-- The `unique (provider_event_id)` constraint absorbs payment webhook
-- redeliveries — the handler always writes with `on conflict do nothing`.

create table if not exists plan_history (
  id              uuid primary key default gen_random_uuid(),
  clerk_user_id   text not null,
  from_plan       text,
  to_plan         text not null,
  cycle           text,
  source          text not null,
  provider_event_id text,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (provider_event_id)
);

create index if not exists idx_plan_history_user_created
  on plan_history (clerk_user_id, created_at desc);
