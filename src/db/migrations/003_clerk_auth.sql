-- Migration 003 · Clerk authentication
--
-- Replaces the per-row `dashboard_token` magic-link gate with Clerk-issued
-- session ownership. Every storefront row now carries the `clerk_user_id`
-- of its founder; ownership is checked via `auth().userId === row.clerk_user_id`
-- in every server action and dashboard page.
--
-- Cleanup: per user direction the legacy storefronts (e.g. `oryxtest`) are
-- wiped — there is no Clerk user attached to them so no founder can recover
-- access anyway. Products cascade away via the FK.
--
-- Apply order:
--   1. truncate (clears products via cascade, then briefs)
--   2. drop dashboard_token column
--   3. add clerk_user_id (NOT NULL — backfilled by truncate above)
--   4. index clerk_user_id for `select where clerk_user_id = $1` lookups

begin;

truncate table products restart identity cascade;
truncate table briefs restart identity cascade;

alter table briefs drop column if exists dashboard_token;

alter table briefs add column clerk_user_id text not null;

create index if not exists briefs_clerk_user on briefs(clerk_user_id);

commit;
