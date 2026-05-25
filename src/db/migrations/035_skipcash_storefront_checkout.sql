-- Storefront-level SkipCash setup and Max+ monthly-payment product pricing.

alter table briefs
  add column if not exists cr_confirmed_at timestamptz,
  add column if not exists checkout_skipcash_credentials jsonb;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'briefs_checkout_payment_methods_chk'
  ) then
    alter table briefs drop constraint briefs_checkout_payment_methods_chk;
  end if;

  alter table briefs
    add constraint briefs_checkout_payment_methods_chk
    check (checkout_payment_methods <@ array['cod','bank_transfer','skipcash','pay_link']::text[]);
end $$;

alter table checkout_orders
  drop constraint if exists checkout_orders_payment_method_check;

alter table checkout_orders
  add constraint checkout_orders_payment_method_check
  check (payment_method in ('cod','bank_transfer','skipcash','pay_link'));

alter table products
  add column if not exists pricing_mode text not null default 'one_time',
  add column if not exists monthly_price_qar numeric(10,2);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'products_pricing_mode_chk'
  ) then
    alter table products drop constraint products_pricing_mode_chk;
  end if;

  alter table products
    add constraint products_pricing_mode_chk
    check (pricing_mode in ('one_time','monthly_payment'));
end $$;
