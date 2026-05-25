-- Migration 030 · Souqy Studio persisted first-timer history
--
-- Keeps creative asset history separate from the Souqy code-emit pipeline.
-- Projects are user-owned until they are converted into a storefront draft.

create table if not exists souqy_studio_projects (
  id                       uuid primary key default gen_random_uuid(),
  clerk_user_id            text not null,
  locale                   text not null check (locale in ('en', 'ar')),
  business_name            text not null,
  current_step             text not null default 'logo'
                             check (current_step in ('logo', 'banner', 'brand-kit', 'promos', 'builder')),
  storefront_slug          text references briefs(slug) on delete set null,
  confirmed_logo_asset_id  uuid,
  confirmed_banner_asset_id uuid,
  confirmed_brand_asset_id uuid,
  brand_kit                jsonb not null default '{}'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists souqy_studio_projects_user_updated_idx
  on souqy_studio_projects (clerk_user_id, updated_at desc);

create table if not exists souqy_studio_assets (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references souqy_studio_projects(id) on delete cascade,
  clerk_user_id     text not null,
  kind              text not null,
  contract          text not null,
  title             text not null,
  url               text not null,
  width             integer not null,
  height            integer not null,
  mime_type         text not null,
  prompt            text,
  provider          text,
  model             text,
  metadata          jsonb not null default '{}'::jsonb,
  reference_metadata jsonb not null default '[]'::jsonb,
  confirmation_role text check (confirmation_role in ('logo', 'banner', 'brand-kit')),
  created_at        timestamptz not null default now()
);

create index if not exists souqy_studio_assets_project_created_idx
  on souqy_studio_assets (project_id, created_at asc);

create index if not exists souqy_studio_assets_project_confirmation_idx
  on souqy_studio_assets (project_id, confirmation_role)
  where confirmation_role is not null;
