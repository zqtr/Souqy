-- Migration 031 · Souqy Studio asset library metadata
--
-- Expands the first-timer Studio history into a reusable AI asset library.

alter table souqy_studio_assets
  add column if not exists asset_type text,
  add column if not exists format_key text,
  add column if not exists source_storefront_slug text references briefs(slug) on delete set null,
  add column if not exists source_product_ids jsonb not null default '[]'::jsonb,
  add column if not exists download_filename text;

create index if not exists souqy_studio_assets_user_created_idx
  on souqy_studio_assets (clerk_user_id, created_at desc);

create index if not exists souqy_studio_assets_user_format_idx
  on souqy_studio_assets (clerk_user_id, format_key, created_at desc)
  where format_key is not null;

create index if not exists souqy_studio_assets_storefront_idx
  on souqy_studio_assets (source_storefront_slug, created_at desc)
  where source_storefront_slug is not null;
