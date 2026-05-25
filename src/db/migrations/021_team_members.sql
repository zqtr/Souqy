-- Migration 021 · Storefront team members.
--
-- Backs the Settings → Team tab. Each storefront maps to one Clerk
-- Organization (org_id stored on briefs). Membership rows mirror
-- Clerk's `organizationMembership.created`/`.deleted` webhooks so the
-- access gate can resolve role + capability overrides without round-
-- tripping to Clerk on every request.
--
-- Owner short-circuits the table: `briefs.clerk_user_id` is always
-- considered role='owner' with full capabilities even if no row
-- exists here. Non-owner members must have a row.

begin;

alter table briefs
  add column if not exists clerk_org_id text;

create index if not exists briefs_clerk_org_id_idx
  on briefs (clerk_org_id)
  where clerk_org_id is not null;

create table if not exists storefront_members (
  storefront_slug text not null,
  clerk_user_id   text not null,
  clerk_org_id    text not null,
  role            text not null check (role in ('owner','admin','editor','viewer')),
  capabilities    jsonb not null default '{}'::jsonb,
  invited_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (storefront_slug, clerk_user_id)
);

create index if not exists storefront_members_org_idx
  on storefront_members (clerk_org_id);

create index if not exists storefront_members_user_idx
  on storefront_members (clerk_user_id);

commit;
