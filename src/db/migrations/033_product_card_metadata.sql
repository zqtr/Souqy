-- Migration 033 · product card merchandising metadata
-- Adds product-level flags used by the unified Souqna product card.
-- Idempotent: safe to re-run.

alter table products add column if not exists is_customizable boolean not null default false;
alter table products add column if not exists customization_label text;

