-- Storefront-level SADAD Web Checkout setup.

alter table briefs
  add column if not exists checkout_sadad_credentials jsonb;

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
    check (checkout_payment_methods <@ array['cod','bank_transfer','skipcash','sadad','pay_link']::text[]);
end $$;

alter table checkout_orders
  drop constraint if exists checkout_orders_payment_method_check;

alter table checkout_orders
  add constraint checkout_orders_payment_method_check
  check (payment_method in ('cod','bank_transfer','skipcash','sadad','pay_link'));
