-- 010 — Allow `pos` as an order channel.
--
-- The Point-of-Sale terminal in /account/pos records cash sales as
-- orders with channel='pos'. The original CHECK constraint from 008
-- only permitted (admin, storefront, inquiry, import); widen it.
--
-- Idempotent: drop the old constraint by name (created by Postgres as
-- `orders_channel_check`) and replace it with the wider check.

alter table orders drop constraint if exists orders_channel_check;

alter table orders
  add constraint orders_channel_check
  check (channel in ('admin','storefront','inquiry','import','pos'));
