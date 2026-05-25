-- Migration 022 · Notifications center + storefront subdomain provisioning state.
--
-- Two related additions, shipped together because the bell-popover surface
-- needs both:
--
-- 1. `briefs.subdomain_status` tracks whether `{slug}.souqna.qa` has a
--    Vercel-issued Let's Encrypt cert yet. After publish we mark it
--    `pending`; a background poll flips it to `live` once HTTP-01 ACME
--    completes (~30s-3min). On hard failure (bad token, taken host) we
--    record `failed` + the message so the dashboard can show a retry.
--
-- 2. `notifications` is the per-Clerk-user event log behind the bell in
--    AdminTopBar. Title/body are pre-rendered in the founder's locale at
--    write time (mailer pattern) so the popover stays a dumb renderer.
--    `seen_at` is null until the founder opens the popover.
--
-- The partial unread index keeps the hot "unseen count" query O(unread)
-- regardless of total history depth.

begin;

alter table briefs
  add column if not exists subdomain_status text not null default 'pending'
    check (subdomain_status in ('pending', 'live', 'failed')),
  add column if not exists subdomain_provisioned_at timestamptz,
  add column if not exists subdomain_error text;

create table if not exists notifications (
  id              uuid primary key default gen_random_uuid(),
  clerk_user_id   text not null,
  kind            text not null,
  title           text not null,
  body            text,
  href            text,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  seen_at         timestamptz
);

create index if not exists notifications_user_recent_idx
  on notifications (clerk_user_id, created_at desc);

create index if not exists notifications_user_unseen_idx
  on notifications (clerk_user_id, created_at desc)
  where seen_at is null;

commit;
