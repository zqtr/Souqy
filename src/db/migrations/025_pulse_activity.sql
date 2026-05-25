-- Migration 025 · Souqna Pulse canonical activity stream.
--
-- Pulse started as a narrow funnel/event feed in `events`. This table is the
-- operator-facing journal the Mac app reads from: one append-only stream for
-- user, storefront, product, billing, audit, and lifecycle activity.
--
-- We intentionally keep Clerk user ids as text and avoid denormalising PII
-- such as emails, raw IP addresses, or full webhook/request payloads.

begin;

create table if not exists pulse_activity (
  id                    bigserial primary key,
  occurred_at           timestamptz not null default now(),

  -- Actor = who performed the action. Owner = the storefront/founder account
  -- the action belongs to, which is the default Clerk filter Pulse uses.
  actor_clerk_user_id   text,
  owner_clerk_user_id   text,
  storefront_slug       text references briefs(slug) on delete set null,

  -- `source` names the emitting subsystem; `kind` is the display/filter verb.
  source                text not null,
  kind                  text not null,
  resource_type         text,
  resource_id           text,

  title                 text,
  summary               text,
  metadata              jsonb not null default '{}'::jsonb,
  visibility            text not null default 'operator'
                          check (visibility in ('operator','owner','internal'))
);

create index if not exists pulse_activity_time_idx
  on pulse_activity (occurred_at desc, id desc);

create index if not exists pulse_activity_owner_time_idx
  on pulse_activity (owner_clerk_user_id, occurred_at desc, id desc)
  where owner_clerk_user_id is not null;

create index if not exists pulse_activity_actor_time_idx
  on pulse_activity (actor_clerk_user_id, occurred_at desc, id desc)
  where actor_clerk_user_id is not null;

create index if not exists pulse_activity_storefront_time_idx
  on pulse_activity (storefront_slug, occurred_at desc, id desc)
  where storefront_slug is not null;

create index if not exists pulse_activity_kind_time_idx
  on pulse_activity (kind, occurred_at desc, id desc);

create index if not exists pulse_activity_resource_idx
  on pulse_activity (resource_type, resource_id)
  where resource_type is not null and resource_id is not null;

commit;
