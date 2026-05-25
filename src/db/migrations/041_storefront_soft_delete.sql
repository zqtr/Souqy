-- Soft-delete storefronts from the Souqna operator tab without losing
-- the moderation trail. Deleted rows are unpublished and expired so
-- storefront routing no longer serves them, while the operator dashboard
-- can still render them as removed/red.

alter table briefs
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text,
  add column if not exists deleted_reason text;

create index if not exists briefs_deleted_at_idx
  on briefs (deleted_at desc)
  where deleted_at is not null;
