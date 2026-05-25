-- Migration 045 · Product height custom input.
--
-- Adds a separate product-level toggle for shopper-entered height/measurement
-- values and snapshots those custom inputs on checkout order lines.

begin;

alter table products
  add column if not exists requires_height_input boolean not null default false;

alter table products
  add column if not exists height_input_label text;

alter table checkout_order_items
  add column if not exists custom_inputs jsonb not null default '{}'::jsonb;

commit;
