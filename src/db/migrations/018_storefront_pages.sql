-- Migration 018 · Multi-page storefronts (M4 of the 2026-04 builder rebuild).
--
-- Until now every `briefs` row owned a single block tree
-- (`draft_blocks` / `published_blocks`). Founders asked for additional
-- pages — About, Lookbook, Press, etc. — selectable from the public
-- storefront's nav. M4 promotes "page" to its own entity so the same
-- block primitives can compose any number of routed pages per store.
--
-- The home page is always present and rendered at the storefront root
-- (`/{slug}`); other pages render at `/{slug}/{pageSlug}`. Reserved
-- slugs (terms, privacy, refund, shipping, checkout, cart) cannot be
-- used by builder pages because the public storefront already routes
-- those paths. `home` is reserved too — only the system creates the
-- home row (via this migration's backfill, or via the first-page
-- bootstrap in `seedBuilderIfEmpty`). Reserved-slug enforcement lives
-- in the server actions; the schema only fences off `home` (one per
-- storefront) and ill-formed slug strings.
--
-- Migration strategy:
--   1. Create `storefront_pages` with a unique (storefront_slug, slug).
--   2. Backfill exactly one row per existing brief — the home page —
--      using the brief's existing block JSON.
--   3. Keep `briefs.draft_blocks` / `briefs.published_blocks` populated
--      going forward (mirrored by the home-page server action).
--      Older readers (preview routes, brief loaders, Souqy fallback)
--      keep functioning until M4-followup deprecates them.
--
-- Re-runnable: every DDL is `if not exists`-guarded; the backfill uses
-- `on conflict (storefront_slug, slug) do nothing`.

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

-- -----------------------------------------------------------------------
-- storefront_pages · per-storefront page tree.
--
-- `slug` is citext so URL lookups are case-insensitive (`/{slug}/About`
-- resolves the same row as `/{slug}/about`) without forcing every
-- caller to lowercase. The pair (storefront_slug, slug) is unique;
-- duplicate slugs across storefronts are fine.
--
-- `draft_blocks` is the working copy edited inside the builder.
-- `published_blocks` is what visitors see; NULL until the founder
-- presses Publish for this page (matches the M4 requirement of an
-- explicit "first publish" boundary even for newly-created pages).
--
-- `position` orders pages in the public nav and the builder's
-- PageSwitcher. `show_in_nav` lets the founder hide a page from the
-- nav while leaving it accessible by direct link (legal pages,
-- internal landing pages used in ads, etc.).
--
-- `is_home` flags the root-route page. The partial unique index below
-- guarantees at most one home per storefront — switching the home is
-- a two-step "unset old, set new" sequence in `setHomePage`.
--
-- The slug CHECK keeps URLs to the lowercase / digit / hyphen subset
-- the public router expects. Reserved-slug rejection (`home`, `terms`,
-- `privacy`, `refund`, `shipping`, `checkout`, `cart`) lives in the
-- server actions because that list is product-policy, not schema.
-- -----------------------------------------------------------------------
create table if not exists storefront_pages (
  id                 uuid primary key default gen_random_uuid(),
  storefront_slug    text not null
                       references briefs(slug) on delete cascade,
  slug               citext not null
                       check (
                         length(slug::text) > 0
                         and slug::text !~ '[^a-z0-9-]'
                       ),
  title              text not null,
  draft_blocks       jsonb not null default '[]'::jsonb,
  published_blocks   jsonb,
  status             text not null default 'draft'
                       check (status in ('draft', 'published')),
  position           integer not null default 0,
  show_in_nav        boolean not null default true,
  is_home            boolean not null default false,
  seo_title          text,
  seo_description    text,
  seo_image          text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (storefront_slug, slug)
);

create index if not exists storefront_pages_slug_idx
  on storefront_pages(storefront_slug);

create index if not exists storefront_pages_storefront_position_idx
  on storefront_pages(storefront_slug, position);

create unique index if not exists storefront_pages_one_home_idx
  on storefront_pages(storefront_slug)
  where is_home;

-- -----------------------------------------------------------------------
-- Backfill · synthesise a `home` page row from every existing brief.
--
-- `published_blocks` defaults to '[]' on the briefs side, so we can't
-- distinguish "never published" from "published an empty page" by
-- nullness alone. Use `is_published` + non-empty array as the practical
-- "this storefront has been published at least once" signal — matches
-- what the public renderer treats as "live content available". For
-- never-published storefronts we leave `published_blocks` NULL so the
-- new code paths can model "draft only" cleanly.
-- -----------------------------------------------------------------------
insert into storefront_pages (
  storefront_slug,
  slug,
  title,
  draft_blocks,
  published_blocks,
  status,
  position,
  show_in_nav,
  is_home
)
select
  b.slug,
  'home',
  'Home',
  coalesce(b.draft_blocks, '[]'::jsonb),
  case
    when b.is_published
         and jsonb_array_length(coalesce(b.published_blocks, '[]'::jsonb)) > 0
      then b.published_blocks
    else null
  end,
  case
    when b.is_published
         and jsonb_array_length(coalesce(b.published_blocks, '[]'::jsonb)) > 0
      then 'published'
    else 'draft'
  end,
  0,
  false,
  true
from briefs b
on conflict (storefront_slug, slug) do nothing;

commit;
