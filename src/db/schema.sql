-- Souqna · storefront subdomains
-- Applied to Neon project autumn-mountain-32411543, branch main.
-- Re-runnable via `psql $DATABASE_URL -f src/db/schema.sql`.
--
-- Notes:
-- * Table name remains `briefs` for migration continuity. The product surface
--   is now a customizable storefront with its own product catalogue.
-- * `clerk_user_id` is the Clerk session subject. It's the only auth gate:
--   every dashboard page + product action checks `auth().userId` against it.
-- * `design` and `palette` were once founder-pickable; `design` is now ignored
--   on render (the template is derived from `business_type` via the archetype
--   map) but the column is kept for backwards compatibility for one release.

create extension if not exists pgcrypto;

create table if not exists briefs (
  slug text primary key,
  locale text not null check (locale in ('en','ar')),
  founder_name text not null,
  business_name text not null,
  contact_email text not null,
  ownership text not null,
  experience text not null,
  business_type text not null,
  market_volume text not null,
  payments text not null,
  tagline text,
  phone text,
  area text,
  hours text,
  instagram text,
  logo_url text,
  design text not null default 'atrium' check (design in ('atrium','souk')),
  palette text not null default 'sand_gold' check (palette in ('sand_gold','pearl_ink','olive_brass','maroon_bone')),
  clerk_user_id text not null,
  -- Page builder columns (migration 004). Empty arrays are seeded as a
  -- private draft on first builder open; publish is an explicit action.
  published_blocks jsonb not null default '[]'::jsonb,
  draft_blocks jsonb not null default '[]'::jsonb,
  theme_overrides jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  published_at timestamptz,
  -- Founder-attached hostname (migration 020). NULL keeps the storefront
  -- on its free `{slug}.souqna.qa` subdomain. Lowercased on write so
  -- the unique partial index doubles as case-insensitive uniqueness.
  custom_domain text,
  custom_domain_added_at timestamptz,
  custom_domain_verified_at timestamptz,
  -- Souqna public directory moderation (migration 029). Operator-managed
  -- metadata for /souqna discovery; hidden/spam rows are excluded there
  -- without deleting the founder storefront.
  discover_featured_at timestamptz,
  discover_hidden_at timestamptz,
  discover_hidden_reason text,
  discover_spam_shutdown_at timestamptz,
  discover_managed_by text,
  discover_updated_at timestamptz,
  -- Operator soft-delete (migration 041). Deleted rows are unpublished
  -- and expired from public routing, but retained for audit/review.
  deleted_at timestamptz,
  deleted_by text,
  deleted_reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days'
);

create index if not exists briefs_expires_at on briefs(expires_at);
create index if not exists briefs_clerk_user on briefs(clerk_user_id);
create unique index if not exists briefs_custom_domain_unique
  on briefs (lower(custom_domain))
  where custom_domain is not null;
create index if not exists briefs_discover_public_idx
  on briefs (discover_hidden_at, discover_spam_shutdown_at, is_published, published_at desc, created_at desc);
create index if not exists briefs_discover_featured_idx
  on briefs (discover_featured_at desc)
  where discover_featured_at is not null;
create index if not exists briefs_deleted_at_idx
  on briefs (deleted_at desc)
  where deleted_at is not null;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  storefront_slug text not null references briefs(slug) on delete cascade,
  title text not null,
  description text,
  price_qar numeric(10,2),
  image_url text,
  category text,
  event_at timestamptz,
  status text not null default 'active' check (status in ('active','draft','sold_out')),
  is_customizable boolean not null default false,
  customization_label text,
  size_options jsonb not null default '[]'::jsonb,
  allow_custom_size boolean not null default false,
  requires_height_input boolean not null default false,
  height_input_label text,
  height_options jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_storefront on products(storefront_slug, position);

alter table if exists products
  add column if not exists requires_height_input boolean not null default false;

alter table if exists products
  add column if not exists height_input_label text;

alter table if exists products
  add column if not exists height_options jsonb not null default '[]'::jsonb;

alter table if exists products
  add column if not exists allow_custom_size boolean not null default false;

alter table if exists checkout_order_items
  add column if not exists variant_label text;

alter table if exists checkout_order_items
  add column if not exists custom_inputs jsonb not null default '{}'::jsonb;
