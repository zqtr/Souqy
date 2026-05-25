-- 032_souqnasource.sql
-- SouqnaSource catalog foundation (PR 1).
-- Auth + chat tables land in later PRs.
-- "storefronts" in the spec maps to the existing `briefs` table.

create table souqnasource_suppliers (
  id text primary key,
  display_name text not null,
  cr_number text,
  whatsapp text,
  area text,
  source_network text not null,
  source_profile_url text,
  trust_score numeric(3,1),
  trust_reason text,
  verified boolean not null default false,
  claimed_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_indexed_at timestamptz not null default now()
);
create index on souqnasource_suppliers (area);
create index on souqnasource_suppliers (trust_score desc);

create table souqnasource_listings (
  id text primary key,
  supplier_id text not null references souqnasource_suppliers(id) on delete cascade,
  network text not null,
  source_listing_url text not null,
  title text not null,
  description text,
  image_url text,
  category text not null,
  subcategory text,
  listing_type text not null,
  price numeric(10,2),
  currency text,
  moq int,
  raw jsonb not null,
  first_seen_at timestamptz not null default now(),
  last_indexed_at timestamptz not null default now(),
  delisted_at timestamptz
);
create index on souqnasource_listings (category, listing_type, last_indexed_at desc);
create index on souqnasource_listings (supplier_id);

-- products gets two new columns: source provenance + bilingual fields
-- so PR 2 import action can land copy in both EN and AR without
-- another schema migration.
alter table products add column if not exists source text not null default 'manual';
alter table products add column if not exists title_ar text;
alter table products add column if not exists description_ar text;

create table souqnasource_links (
  product_id uuid primary key references products(id) on delete cascade,
  storefront_slug text not null references briefs(slug) on delete cascade,
  listing_id text references souqnasource_listings(id) on delete set null,
  supplier_id text references souqnasource_suppliers(id) on delete set null,
  supplier_cost numeric(10,2) not null,
  supplier_currency text not null,
  last_synced_at timestamptz not null default now(),
  last_seen_price numeric(10,2),
  price_drift_pct numeric(5,2)
);
create index on souqnasource_links (storefront_slug);
create unique index on souqnasource_links (storefront_slug, listing_id) where listing_id is not null;

create table souqnasource_quote_requests (
  id bigserial primary key,
  storefront_slug text not null references briefs(slug) on delete cascade,
  listing_id text not null references souqnasource_listings(id) on delete cascade,
  supplier_id text not null references souqnasource_suppliers(id) on delete cascade,
  prefilled_message text not null,
  created_at timestamptz not null default now()
);
create index on souqnasource_quote_requests (supplier_id, created_at desc);
