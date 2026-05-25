-- Migration 037 · Favicon URL for storefronts.
--
-- The brand settings page already accepts a logo. Modern browsers also
-- pin a favicon to the title bar / homescreen — we want a separate
-- 1 MB-capped asset for that surface rather than reusing the larger
-- logo upload. Public columns only; the file itself lives in Vercel
-- Blob under the `favicons/<slug>` namespace.
--
-- Forward-only safe: NULL default means existing storefronts fall back
-- to the Souqna mark (rendered by the public storefront's head logic).

alter table briefs
  add column if not exists favicon_url text;
