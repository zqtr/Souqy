-- Migration 036 · Tag seeded demo products so they can be cleared in bulk.
--
-- Background: `src/lib/blocks/demoProducts.ts` seeds 4–6 themed rows on
-- /begin and on template switch so a new storefront doesn't read as
-- empty. Without a marker column, a founder who wants to wipe the
-- demos has to delete every row by hand. This migration adds the
-- marker plus a partial index keyed on the predicate the cleanup query
-- uses, so the bulk-delete stays cheap even on large catalogues.
--
-- Forward-only safe: default is `false`, so every pre-existing row
-- continues to be treated as merchant-authored. Existing rows known to
-- be seeded (legacy `source = 'seed'` soft handle) are NOT auto-tagged
-- — the prior soft handle is unreliable (some apps use the same value)
-- and the wrong audit would be louder than the missed cleanup. New
-- seeded rows from this point on carry `is_demo = true`.

alter table products
  add column if not exists is_demo boolean not null default false;

create index if not exists products_is_demo_idx
  on products (storefront_slug) where is_demo = true;
