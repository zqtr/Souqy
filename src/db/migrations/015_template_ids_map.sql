-- Migration 015 · Template id map (M1 of the 2026-04 builder rebuild)
--
-- The /begin template lineup goes from ten heavy demo-driven templates
-- to six lean, real-product templates: atrium, souqline, kiosk, lounge,
-- studio, bazaar.
--
-- This migration rewrites every existing `briefs.template_id` so any
-- storefront created on the previous lineup keeps rendering, but
-- against one of the six new template ids. The mapping is intentionally
-- semantic — each retired template lands on the closest live one:
--
--   noctis   → atrium     (cinematic editorial, kiosk too sparse)
--   bento    → souqline   (modular tiles → dense product grid)
--   gazette  → atrium     (broadsheet editorial)
--   bazaar   → bazaar     (kept; same id)
--   salon    → atrium     (curatorial gallery → editorial boutique)
--   atelier  → atrium     (legacy default → new default)
--   maison   → lounge     (menu-led hospitality)
--   studio   → studio     (kept; same id)
--   pavilion → bazaar     (modern destination → lookbook)
--   souq     → souqline   (warm shop → market grid)
--
-- The first UPDATE handles every known retired id explicitly. The
-- second is a safety net: anything that somehow holds an unrecognised
-- id (manual DB tinkering, old fixtures) falls back to `atrium`, the
-- new default.
--
-- The default for the column itself is also bumped to `atrium` so any
-- new INSERT that omits `template_id` lands on the live default.
--
-- Re-runnable: each statement is idempotent (the second UPDATE is
-- a no-op once every row is on a known new id).

begin;

update briefs set template_id = case template_id
  when 'noctis'   then 'atrium'
  when 'bento'    then 'souqline'
  when 'gazette'  then 'atrium'
  when 'bazaar'   then 'bazaar'
  when 'salon'    then 'atrium'
  when 'atelier'  then 'atrium'
  when 'maison'   then 'lounge'
  when 'studio'   then 'studio'
  when 'pavilion' then 'bazaar'
  when 'souq'     then 'souqline'
  else template_id
end
where template_id in (
  'noctis','bento','gazette','bazaar','salon',
  'atelier','maison','studio','pavilion','souq'
);

update briefs set template_id = 'atrium'
where template_id not in (
  'atrium','souqline','kiosk','lounge','studio','bazaar'
);

alter table briefs
  alter column template_id set default 'atrium';

commit;
