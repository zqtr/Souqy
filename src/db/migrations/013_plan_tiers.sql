-- Migration 013 · expand the billing tier model from two plans
-- (`free`, `atelier_pro`) to four (`free`, `starter`, `pro`, `atelier`).
--
-- The `user_plans.plan` column is plain `text` with no CHECK constraint
-- (see migration 007), so the new IDs are accepted without an ALTER —
-- this migration only handles the legacy data: any existing
-- `atelier_pro` row is mapped to the new top tier `atelier`. The old
-- ID is also accepted at read time by `isPlan` in `src/lib/billing.ts`
-- as a safety net for any environment that hasn't run this migration
-- yet (the alias resolves to `atelier`, matching what we backfill here).
update user_plans
   set plan       = 'atelier',
       updated_at = now(),
       meta       = meta || '{"migrated_from":"atelier_pro"}'::jsonb
 where plan = 'atelier_pro';
