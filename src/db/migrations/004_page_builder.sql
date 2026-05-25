-- Migration 004 · Page builder
-- Adds the block-based page model alongside the legacy storefront columns.
--
-- `published_blocks` is what visitors see at {slug}.souqna.qa.
-- `draft_blocks` is what the founder sees inside the builder iframe.
-- Empty arrays mean "fall back to archetype rendering" (zero-downtime).
-- The first builder save calls bootBlocksFromStorefront to seed both arrays.
--
-- Re-runnable: every alter is `if not exists`-guarded.

begin;

alter table briefs
  add column if not exists published_blocks jsonb not null default '[]'::jsonb;

alter table briefs
  add column if not exists draft_blocks jsonb not null default '[]'::jsonb;

alter table briefs
  add column if not exists theme_overrides jsonb not null default '{}'::jsonb;

alter table briefs
  add column if not exists is_published boolean not null default true;

alter table briefs
  add column if not exists published_at timestamptz;

commit;
