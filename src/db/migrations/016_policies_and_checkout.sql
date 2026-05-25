-- Migration 016 · Storefront policies + checkout settings (M2 of the
-- 2026-04 builder rebuild)
--
-- The Settings → Policies and Settings → Checkout panels were shipped
-- with their UI in M1 but persisted nothing of substance: policies
-- were stashed in `audit_log.meta` only, and checkout had no panel at
-- all. M2 promotes both to first-class columns on `briefs` so the
-- public storefront, future order-confirmation emails and the soon-
-- to-land cart flow can read them deterministically.
--
-- Policies columns (`policies_*`)
--   Free-form text. NULL means "founder hasn't written this policy
--   yet" — the storefront footer hides the link in that case.
--
-- Checkout columns (`checkout_*`)
--   * `payment_methods`     — which methods are offered. COD + bank
--                             transfer enabled by default; founders
--                             opt in to `pay_link` (Tap / Stripe / etc).
--   * `bank_details`        — opaque jsonb because the shape may grow
--                             (extra fields for QPay, BIC, etc.). The
--                             v1 schema is { accountName, iban,
--                             bankName, swift, notes }.
--   * `pay_link_url/label`  — single hosted-payment-page URL when
--                             `pay_link` is enabled. The label is the
--                             button copy ("Pay with Tap", etc.).
--   * `required_policies`   — which policies the buyer must accept on
--                             the checkout page. Defaults to the two
--                             every storefront should have.
--   * `currency`            — ISO 4217. Single-currency for now; the
--                             column makes future multi-currency a
--                             non-breaking add.
--   * `min_order_qar`       — optional minimum cart subtotal in QAR
--                             (whole units; we keep money as integer
--                             halalas elsewhere but the founder-facing
--                             field is whole riyals).
--   * `shipping_flat_qar`   — optional flat shipping fee in QAR.
--                             Real shipping engines land later behind
--                             the dispatcher — this gets carts working.
--
-- The two CHECK constraints fence off typos / future invalid values.
-- They use `<@` (subset of) so the order of the array doesn't matter.
--
-- Re-runnable: every column uses `add column if not exists`; the CHECK
-- constraints use named `add constraint … not valid` guards so a re-run
-- is a no-op once they exist.

begin;

alter table briefs
  add column if not exists policies_terms              text,
  add column if not exists policies_privacy            text,
  add column if not exists policies_refund             text,
  add column if not exists policies_shipping           text,
  add column if not exists checkout_payment_methods    text[]  not null default '{cod,bank_transfer}',
  add column if not exists checkout_bank_details       jsonb,
  add column if not exists checkout_pay_link_url       text,
  add column if not exists checkout_pay_link_label     text,
  add column if not exists checkout_required_policies  text[]  not null default '{terms,privacy}',
  add column if not exists checkout_currency           text    not null default 'QAR',
  add column if not exists checkout_min_order_qar      integer,
  add column if not exists checkout_shipping_flat_qar  integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'briefs_checkout_payment_methods_chk'
  ) then
    alter table briefs
      add constraint briefs_checkout_payment_methods_chk
      check (checkout_payment_methods <@ array['cod','bank_transfer','pay_link']::text[]);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'briefs_checkout_required_policies_chk'
  ) then
    alter table briefs
      add constraint briefs_checkout_required_policies_chk
      check (checkout_required_policies <@ array['terms','privacy','refund','shipping']::text[]);
  end if;
end $$;

commit;
