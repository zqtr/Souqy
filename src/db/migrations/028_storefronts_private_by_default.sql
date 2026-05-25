-- Migration 028 · Storefronts private by default
-- New storefronts should stay offline until the founder explicitly
-- publishes from the builder.

begin;

alter table briefs
  alter column is_published set default false;

commit;
