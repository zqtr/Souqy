-- Migration 011 · First-class categories per storefront.
--
-- Until now `products.category` was a free-text column the founder typed
-- on every product, which made it impossible to rename a category, give
-- it a cover image / description, or share a single category across
-- multiple stores. Promote it to a real entity.
--
--   * `categories`         — per-storefront, name + slug + cover.
--   * `product_categories` — many-to-many join with products.
--
-- Backfill: every distinct, non-null products.category value becomes a
-- `categories` row, then a join row links the existing products to it.
-- The legacy `products.category` text column STAYS (the public storefront,
-- preview, and Menu archetype still read from it). New writes via the
-- product modal keep that column populated with the FIRST selected
-- category name so legacy surfaces keep rendering without changes.
--
-- Re-runnable: every DDL is `if not exists`-guarded; the backfill skips
-- anything that already mapped on a previous run via `on conflict do nothing`.

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------
-- categories · per-storefront grouping
-- -----------------------------------------------------------------------
create table if not exists categories (
  id              uuid primary key default gen_random_uuid(),
  storefront_slug text not null
                    references briefs(slug) on delete cascade,
  name            text not null,
  slug            text not null,
  description     text,
  image_url       text,
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (storefront_slug, slug)
);

create index if not exists categories_storefront_idx
  on categories (storefront_slug, position);

-- -----------------------------------------------------------------------
-- product_categories · join table
-- -----------------------------------------------------------------------
create table if not exists product_categories (
  product_id  uuid not null references products(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (product_id, category_id)
);

create index if not exists product_categories_cat_idx
  on product_categories (category_id);

-- -----------------------------------------------------------------------
-- Backfill · synthesise a categories row from every distinct
-- products.category string per storefront, then link the existing
-- products to it. Slug is derived from the lower-cased name with
-- non-alphanumeric runs collapsed to a hyphen, trimmed.
-- -----------------------------------------------------------------------
with existing as (
  select
    p.storefront_slug,
    btrim(p.category) as name,
    nullif(
      regexp_replace(
        regexp_replace(lower(btrim(p.category)), '[^a-z0-9]+', '-', 'g'),
        '(^-|-$)', '', 'g'
      ),
      ''
    ) as slug
  from products p
  where p.category is not null
    and btrim(p.category) <> ''
  group by p.storefront_slug, btrim(p.category)
)
insert into categories (storefront_slug, name, slug)
select
  storefront_slug,
  name,
  coalesce(slug, 'category')
from existing
on conflict (storefront_slug, slug) do nothing;

with linked as (
  select
    p.id            as product_id,
    c.id            as category_id
  from products p
  join categories c
    on c.storefront_slug = p.storefront_slug
   and lower(c.name) = lower(btrim(p.category))
  where p.category is not null
    and btrim(p.category) <> ''
)
insert into product_categories (product_id, category_id)
select product_id, category_id from linked
on conflict (product_id, category_id) do nothing;

commit;
