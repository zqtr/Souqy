-- Migration 031 · Account settings operations
--
-- Makes the placeholder payment-adjacent settings durable:
-- shipping profiles/rates, tax profiles, market/language/currency settings,
-- and query helpers for metaobjects.

create table if not exists shipping_profiles (
  id                    uuid primary key default gen_random_uuid(),
  storefront_slug       text not null references briefs(slug) on delete cascade,
  name                  text not null default 'Default shipping',
  enabled               boolean not null default true,
  free_shipping_min_qar integer,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists shipping_profiles_store_idx
  on shipping_profiles (storefront_slug);

create table if not exists shipping_rates (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references shipping_profiles(id) on delete cascade,
  label            text not null,
  country_code     text not null default 'QA',
  city             text,
  amount_qar       integer not null default 0,
  min_subtotal_qar integer,
  max_subtotal_qar integer,
  enabled          boolean not null default true,
  position         integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists shipping_rates_profile_position_idx
  on shipping_rates (profile_id, position asc, created_at asc);

create table if not exists tax_profiles (
  id                  uuid primary key default gen_random_uuid(),
  storefront_slug     text not null references briefs(slug) on delete cascade,
  name                text not null default 'Default tax',
  enabled             boolean not null default false,
  rate_bps            integer not null default 0 check (rate_bps >= 0 and rate_bps <= 10000),
  included_in_prices  boolean not null default false,
  applies_to_shipping boolean not null default false,
  registration_number text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists tax_profiles_store_idx
  on tax_profiles (storefront_slug);

alter table checkout_orders
  add column if not exists tax_qar integer not null default 0;

create table if not exists market_settings (
  storefront_slug    text primary key references briefs(slug) on delete cascade,
  primary_currency   text not null default 'QAR',
  enabled_currencies text[] not null default array['QAR']::text[],
  primary_language   text not null default 'en',
  enabled_languages  text[] not null default array['en','ar']::text[],
  default_country    text not null default 'QA',
  selling_regions    text[] not null default array['QA']::text[],
  updated_at         timestamptz not null default now()
);

create index if not exists metaobjects_store_namespace_kind_idx
  on metaobjects (storefront_slug, namespace, kind);

create index if not exists metaobjects_fields_gin_idx
  on metaobjects using gin (fields);
