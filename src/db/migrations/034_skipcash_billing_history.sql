-- Migration 034 · Rename the billing-event dedupe column now that
-- SkipCash is the active payment provider.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'plan_history'
      and column_name = 'paypal_event_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_name = 'plan_history'
      and column_name = 'provider_event_id'
  ) then
    alter table plan_history
      rename column paypal_event_id to provider_event_id;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'plan_history_paypal_event_id_key'
  ) then
    alter table plan_history
      rename constraint plan_history_paypal_event_id_key
      to plan_history_provider_event_id_key;
  end if;
end $$;
