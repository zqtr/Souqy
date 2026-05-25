-- Migration 017 · Cart-driven checkout orders (M3 of the 2026-04
-- builder rebuild).
--
-- Souqna v1 already shipped a separate `orders` / `order_items` pair in
-- migration 008 — those tables back the dashboard "log a manual sale"
-- flow used by founders who close on WhatsApp first and record the sale
-- afterwards. They are deeply integrated (`src/lib/orders.ts`,
-- `src/app/actions/orders.ts`, the apps dispatch fan-out, the analytics
-- pipeline) and intentionally kept untouched here.
--
-- M3 introduces a real cart + checkout running on the public storefront.
-- Because the legacy schema differs in fundamentals (numeric money vs
-- whole-QAR integers, bigserial ids vs uuid, fulfilment + payment +
-- order status triplet vs a simpler payment + order pair, address as
-- jsonb shippingAddress vs typed jsonb, etc.), we land the new flow on
-- a dedicated pair: `checkout_orders` + `checkout_order_items`.
--
-- Both new tables key on `storefront_slug -> briefs(slug)` with cascade
-- delete, matching the multi-tenant boundary every Souqna table uses.
-- The CHECK constraints fence off typos in the status / payment_status
-- enums; expanding them later is an additive ALTER.
--
-- Re-runnable: every create / index uses `if not exists`.

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------
-- checkout_orders · the buyer-facing checkout result. Customer contact
-- is captured inline (denormalised) because the public checkout doesn't
-- require the shopper to register — the founder still wants name +
-- phone to follow up. The legacy `customers` table is owner-managed and
-- isn't auto-populated from this flow.
--
-- Money columns are integer whole QAR (matching the founder-facing
-- numbers in the Settings → Checkout panel from migration 016).
--
-- `address` is the buyer's shipping address. Shape is enforced in app
-- code (see OrderAddress in src/lib/checkout-orders.ts) and stays jsonb
-- so adding optional fields is a non-breaking app change.
--
-- `accepted_policies` records exactly which policy keys the buyer
-- ticked (terms, privacy, refund, shipping). This is legal evidence —
-- the storefront's `checkout_required_policies` setting can change
-- after the order, but the snapshot here cannot.
-- -----------------------------------------------------------------------
create table if not exists checkout_orders (
  id                  uuid primary key default gen_random_uuid(),
  storefront_slug     text not null
                        references briefs(slug) on delete cascade,
  customer_name       text not null,
  customer_phone      text not null,
  customer_email      text,
  address             jsonb,
  payment_method      text not null
                        check (payment_method in ('cod','bank_transfer','pay_link')),
  payment_status      text not null default 'unpaid'
                        check (payment_status in ('unpaid','marked_paid','refunded')),
  order_status        text not null default 'pending'
                        check (order_status in (
                          'pending','confirmed','preparing',
                          'shipped','delivered','cancelled'
                        )),
  currency            text not null default 'QAR',
  subtotal_qar        integer not null,
  shipping_qar        integer not null default 0,
  total_qar           integer not null,
  accepted_policies   text[] not null default '{}',
  notes               text,
  metadata            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists checkout_orders_store_created_idx
  on checkout_orders (storefront_slug, created_at desc);
create index if not exists checkout_orders_store_status_idx
  on checkout_orders (storefront_slug, order_status);

-- -----------------------------------------------------------------------
-- checkout_order_items · per-line snapshot. Title + price are duplicated
-- so a product rename / price change does NOT mutate historical orders.
-- product_id is a soft FK (`on delete set null`) so deleting a sold-out
-- product never breaks order history.
-- -----------------------------------------------------------------------
create table if not exists checkout_order_items (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null
                         references checkout_orders(id) on delete cascade,
  product_id           uuid references products(id) on delete set null,
  title_snapshot       text not null,
  price_qar_snapshot   integer not null,
  quantity             integer not null check (quantity > 0),
  created_at           timestamptz not null default now()
);

create index if not exists checkout_order_items_order_idx
  on checkout_order_items (order_id);

commit;
