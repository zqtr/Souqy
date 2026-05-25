-- Migration 012 · Shipments
--
-- Backs the Aramex marketplace plugin (and any future carriers). One row
-- per outbound shipment created from an order. The plugin does the heavy
-- lifting (label PDF, tracking polls); this table is the per-store
-- ledger that survives across plugin re-installs.
--
-- Re-runnable.

begin;

create table if not exists shipments (
  id              bigserial primary key,
  storefront_slug text not null
                    references briefs(slug) on delete cascade,
  order_id        bigint not null
                    references orders(id) on delete cascade,
  -- Free-form so a future DHL / Q-Post plugin can land without a schema
  -- migration. The plugin owns the value (e.g. 'aramex').
  carrier         text not null,
  -- Carrier-specific service code (Aramex `PDX`, `DOM`, `OND`, etc).
  service         text not null default '',
  -- Air-Way Bill / tracking number returned by the carrier on creation.
  awb             text not null,
  -- Public tracking page url the founder hands to the customer.
  tracking_url    text not null default '',
  -- Vercel Blob URL for the cached label PDF. Plugins download the
  -- carrier's binary once and stash it so reprints don't re-hit the
  -- carrier's rate-limited PDF endpoint.
  label_url       text,
  -- Charged amount (QAR) the carrier quoted. Nullable for tracking-only
  -- imports.
  cost_qar        numeric(12, 2),
  -- Last status string the plugin observed during a tracking poll.
  -- 'created' | 'in_transit' | 'out_for_delivery' | 'delivered' | etc.
  status          text not null default 'created',
  -- Whole upstream payload (rate quote, create response, last tracking
  -- snapshot) so the dashboard can show carrier-specific timelines
  -- without re-fetching.
  raw             jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (carrier, awb)
);

create index if not exists shipments_store_idx
  on shipments (storefront_slug);
create index if not exists shipments_order_idx
  on shipments (order_id);
create index if not exists shipments_status_idx
  on shipments (storefront_slug, status);

commit;
