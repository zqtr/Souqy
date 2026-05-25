-- Migration 020 · Custom domains for storefronts.
--
-- Lets a Pro+ founder attach a domain they own (e.g. shop.brand.com)
-- to their storefront alongside the free `{slug}.souqna.qa` subdomain.
--
-- Lookup path: middleware reads `host` on every request, when it isn't
-- the apex or a `*.souqna.qa` subdomain it falls back to a cached
--   select slug from briefs where lower(custom_domain) = lower($1)
-- so the unique index on lower(custom_domain) is the hot path. Partial
-- index (only when not null) keeps it tiny.
--
-- `custom_domain_added_at` is set when the row first holds a hostname
-- (used to time-out unverified attaches in the dashboard); the verify
-- timestamp is set the first time Vercel reports the cert as live.

begin;

alter table briefs
  add column if not exists custom_domain text,
  add column if not exists custom_domain_added_at timestamptz,
  add column if not exists custom_domain_verified_at timestamptz;

create unique index if not exists briefs_custom_domain_unique
  on briefs (lower(custom_domain))
  where custom_domain is not null;

commit;
