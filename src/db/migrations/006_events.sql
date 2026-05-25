-- Migration 006 · Souqna Pulse — append-only event journal.
-- Powers the personal Mac dashboard ("Souqna Pulse") that surfaces
-- visitor + funnel + engagement signals in real time.
--
-- Design notes:
--   * append-only: NEVER update or delete rows in product code; the
--     table is the source of truth for funnel analysis. A future
--     archival job can roll old rows to cold storage by month.
--   * `kind` is free-form text rather than an enum so we can add new
--     events without a migration. The Pulse client knows which
--     kinds to render and how (icon + label).
--   * `props` is JSONB so each event can carry whatever payload it
--     needs (slug, step number, error message). Keep keys short.
--   * `ip_hash` lets us count unique visitors without storing IPs;
--     hashed server-side with a stable secret salt (env).

create table if not exists events (
  id          bigserial primary key,
  occurred_at timestamptz not null default now(),
  user_id     text,
  storefront  text,
  kind        text not null,
  funnel      text,
  step        smallint,
  props       jsonb not null default '{}'::jsonb,
  ip_hash     text,
  ua          text
);

create index if not exists events_occurred_idx on events (occurred_at desc);
create index if not exists events_kind_idx     on events (kind);
create index if not exists events_storefront_idx on events (storefront);
