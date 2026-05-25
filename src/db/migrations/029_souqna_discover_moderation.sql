-- Migration 029 · Souqna discover moderation
--
-- Adds operator-managed discovery metadata to storefront rows. These
-- columns control the public /souqna directory without deleting founder
-- storefronts or overloading publish state.

begin;

alter table briefs
  add column if not exists discover_featured_at timestamptz,
  add column if not exists discover_hidden_at timestamptz,
  add column if not exists discover_hidden_reason text,
  add column if not exists discover_spam_shutdown_at timestamptz,
  add column if not exists discover_managed_by text,
  add column if not exists discover_updated_at timestamptz;

create index if not exists briefs_discover_public_idx
  on briefs (discover_hidden_at, discover_spam_shutdown_at, is_published, published_at desc, created_at desc);

create index if not exists briefs_discover_featured_idx
  on briefs (discover_featured_at desc)
  where discover_featured_at is not null;

commit;
