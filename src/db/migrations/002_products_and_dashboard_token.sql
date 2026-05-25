-- Migration 002 · storefront products + per-row dashboard token + business-type swaps
-- Applied 2026-04-25 to project autumn-mountain-32411543, branch main.
-- Idempotent — safe to re-run.

create extension if not exists pgcrypto;

-- 1. Per-storefront magic-link token (replaces shared ADMIN_REPLY_TOKEN env)
alter table briefs add column if not exists dashboard_token text;

update briefs
set dashboard_token = replace(replace(replace(
  encode(gen_random_bytes(24), 'base64'),
  '+', '-'), '/', '_'), '=', '')
where dashboard_token is null;

alter table briefs alter column dashboard_token set not null;

-- 2. Storefront product catalogue
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
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_storefront on products(storefront_slug, position);

-- 3. Legacy business_type remap. The five removed types map to their realistic
--    replacements; nothing in code references the old IDs anymore.
update briefs set business_type = 'perfume_oud'      where business_type = 'dental_clinic';
update briefs set business_type = 'auto_detailing'   where business_type = 'law_firm';
update briefs set business_type = 'events_weddings'  where business_type = 'mosque_charity';
update briefs set business_type = 'courier_delivery' where business_type = 'logistics';
update briefs set business_type = 'tailoring_abaya'  where business_type = 'daycare';
