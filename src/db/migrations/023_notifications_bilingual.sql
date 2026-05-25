-- Migration 023 · Bilingual notification copy + read marker.
--
-- The 022 schema was English-only and tracked a `seen_at` cursor (set
-- when the popover opened). The new bell + admin SSE channel needs:
--   * pre-rendered Arabic title/body alongside English (mailer pattern),
--     so a founder switching locale post-write still sees their language
--     for fresh rows;
--   * a distinct `read_at` cursor — the bell now distinguishes between
--     "popover opened" (seen_at) and "this card was actively dismissed"
--     (read_at). Existing code keeps both columns in sync until we
--     migrate every consumer.
--
-- Backfill `read_at = seen_at` and `title_ar = title` so the partial
-- unread index is meaningful from day one.

alter table notifications
  add column if not exists title_ar text,
  add column if not exists body_ar  text,
  add column if not exists read_at  timestamptz;

update notifications set title_ar = title where title_ar is null;
update notifications set read_at = seen_at where read_at is null and seen_at is not null;

alter table notifications
  alter column title_ar set not null,
  alter column title_ar set default '';

create index if not exists idx_notifications_user_unread
  on notifications (clerk_user_id, created_at desc) where read_at is null;
