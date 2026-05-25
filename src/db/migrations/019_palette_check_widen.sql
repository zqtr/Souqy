-- 019_palette_check_widen.sql
--
-- The 2026-04 builder rebuild introduced seven new palettes
-- (midnight_emerald, terracotta_kiln, bone_obsidian, coral_play,
-- pearl_lagoon, sage_inlet, dune_blush) backing the new template
-- presets (Frame, Kiosk, Lounge, Studio, Vitrine, Harvest, Launchpad).
--
-- The original `briefs_palette_check` only allowed the four classics
-- (sand_gold, pearl_ink, olive_brass, maroon_bone), so creating a
-- storefront on any of the new templates fails with a 23514 check
-- violation and the /begin form surfaces a generic error.
--
-- This migration drops the old constraint and re-adds it covering
-- every palette id we currently ship in `src/lib/palettes.ts`.
-- New palettes added later must be appended here (keep this list in
-- sync with the `palettes` map; there's no enum table — checks live
-- inline because the palette set churns slowly enough to not warrant
-- one).

alter table briefs drop constraint if exists briefs_palette_check;

alter table briefs add constraint briefs_palette_check
  check (palette = any (array[
    'sand_gold',
    'pearl_ink',
    'olive_brass',
    'maroon_bone',
    'midnight_emerald',
    'terracotta_kiln',
    'bone_obsidian',
    'coral_play',
    'pearl_lagoon',
    'sage_inlet',
    'dune_blush'
  ]));
