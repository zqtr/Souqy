-- Migration 005 · Template picker + commercial registration
-- The /begin flow swaps the four-option palette picker for a three-option
-- template picker (atelier | souq | pavilion). Templates bundle palette,
-- typography, and seed-block layout so palette never leaks back into the
-- intake form.
--
-- A new optional `cr_number` column captures the Qatari commercial
-- registration. When present we surface a "Verified" chip publicly; the
-- column itself is never displayed verbatim.
--
-- The template id check is intentionally NOT enforced at the DB layer.
-- Zod validates inputs at every server-action boundary, and a row that
-- somehow holds an unknown template id falls back to 'atelier' rendering.

alter table briefs
  add column if not exists template_id text not null default 'atelier';

alter table briefs
  add column if not exists cr_number text;
