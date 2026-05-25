-- Migration 043 · Product size options and checkout line variants.
--
-- Adds first-class product size options for apparel / shoes / measured
-- products, and snapshots the buyer-selected value onto checkout lines.

begin;

alter table products
  add column if not exists size_options jsonb not null default '[]'::jsonb;

alter table checkout_order_items
  add column if not exists variant_label text;

commit;
