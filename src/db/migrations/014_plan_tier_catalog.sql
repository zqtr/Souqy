-- Migration 014 · record the 2026-04 rebrand of the billing tier
-- catalog directly in the database.
--
-- Up to this point pricing and limits lived only in `PLAN_LIMITS` in
-- `src/lib/plans.ts`. That's still the source of truth at runtime, but
-- having a row-per-tier in Postgres gives us:
--   - an auditable record of when each tier's price changed
--   - a join target for analytics (`events.* x plan_tiers.*`)
--   - a place future Stripe / webhook code can read on the server
--     without importing a TypeScript module
--
-- The internal `id` column intentionally keeps the old shape
-- (`free / starter / pro / atelier`) so existing `user_plans.plan`
-- rows can be foreign-keyed against this table later. The display
-- labels carry the new "Pro / Pro + / Max +" rebrand.

create table if not exists plan_tiers (
  id                  text         primary key,
  rank                smallint     not null,
  label               text         not null,
  label_ar            text         not null,
  monthly_price_qar   integer      not null,
  -- per-month equivalent at the 35% annual discount, rounded
  annual_monthly_qar  integer      not null,
  storefronts         integer,           -- null = unlimited (atelier)
  template_count      smallint     not null,
  effective_from      timestamptz  not null default now(),
  meta                jsonb        not null default '{}'::jsonb
);

create index if not exists plan_tiers_rank_idx on plan_tiers (rank);

-- Insert the current catalog. `on conflict … do update` lets us re-run
-- this migration safely as the catalog evolves (e.g. when Pro+'s price
-- moves we just bump `monthly_price_qar` here and re-apply).
insert into plan_tiers (
  id, rank, label, label_ar,
  monthly_price_qar, annual_monthly_qar,
  storefronts, template_count, meta
) values
  ('free',    0, 'Free',  'مجاني',     0,    0, 1,  3, '{"renamed_at":"2026-04-30"}'::jsonb),
  ('starter', 1, 'Pro',   'برو',      49,   32, 2,  5, '{"renamed_at":"2026-04-30","price_reduced_at":"2026-05-14","previous_label":"Starter","previous_price_qar":190}'::jsonb),
  ('pro',     2, 'Pro +', 'برو +',   145,   94, 8,  8, '{"renamed_at":"2026-04-30","price_reduced_at":"2026-05-14","previous_label":"Pro","previous_price_qar":350,"souqy":true}'::jsonb),
  ('atelier', 3, 'Max +', 'ماكس +',  235,  153, null, 11, '{"renamed_at":"2026-04-30","price_reduced_at":"2026-05-14","previous_label":"Atelier","previous_price_qar":700,"unlimited_storefronts":true,"premium_blocks":8,"monthly_payments":true}'::jsonb)
on conflict (id) do update
  set rank               = excluded.rank,
      label              = excluded.label,
      label_ar           = excluded.label_ar,
      monthly_price_qar  = excluded.monthly_price_qar,
      annual_monthly_qar = excluded.annual_monthly_qar,
      storefronts        = excluded.storefronts,
      template_count     = excluded.template_count,
      effective_from     = now(),
      meta               = plan_tiers.meta || excluded.meta;

-- Stamp every currently-provisioned user_plans row with a snapshot of
-- the tier they're on at rebrand time. Idempotent: re-running merges
-- new keys without overwriting existing audit fields.
update user_plans up
   set meta = up.meta || jsonb_build_object(
     'rebrand_2026_04_snapshot', jsonb_build_object(
       'tier_label',         pt.label,
       'monthly_price_qar',  pt.monthly_price_qar,
       'annual_monthly_qar', pt.annual_monthly_qar,
       'snapshot_at',        now()
     )
   )
  from plan_tiers pt
 where pt.id = up.plan
   and not (up.meta ? 'rebrand_2026_04_snapshot');
