-- Migration 009 · Apps marketplace + plugin runtime
--
-- Backs the new Apps tab, the per-app configuration screens, and the
-- generic OAuth scaffolding that every plugin uses to talk to a third-
-- party API on behalf of a single storefront.
--
-- Three small tables:
--
--   * `installed_apps`   — one row per (storefront, app_id) install. Holds
--                          enabled flag, encrypted credentials, free-form
--                          per-store settings, and last-success bookkeeping.
--   * `oauth_state`      — short-lived (10 min) anti-CSRF state tokens
--                          minted before redirecting the founder to a
--                          provider. Verified on the callback.
--   * `app_state`        — generic per-app key-value cache. The Currency
--                          Converter plugin uses it to store last-known
--                          rate snapshots so storefronts keep working
--                          when open.er-api.com is down.
--
-- Tokens (`oauth_access_token`, `oauth_refresh_token`) are stored as
-- AES-256-GCM ciphertext, base64-encoded. The plaintext is never written
-- to disk and never returned to the dashboard. See `src/lib/apps/crypto.ts`.
--
-- Re-runnable.

begin;

create table if not exists installed_apps (
  id                  bigserial primary key,
  storefront_slug     text not null
                        references briefs(slug) on delete cascade,
  -- registry id from src/lib/apps/registry.ts (e.g. 'currency-converter',
  -- 'giphy', 'mailchimp', 'whatsapp-business'). Free-form because the
  -- registry is in-code and not an FK target.
  app_id              text not null,
  enabled             boolean not null default true,
  -- settings the founder configured in the per-app screen
  settings            jsonb not null default '{}'::jsonb,
  -- raw provider account info (email, account name, etc) for display
  provider_account    jsonb not null default '{}'::jsonb,
  -- AES-GCM ciphertext blobs. Empty string when the app does not require
  -- OAuth (some plugins are pure config + a bring-your-own API key).
  oauth_access_token  text not null default '',
  oauth_refresh_token text not null default '',
  oauth_expires_at    timestamptz,
  oauth_scope         text,
  -- when the plugin most recently succeeded at its core operation. The
  -- list page surfaces this as "Last sync · 3 minutes ago" so founders
  -- can spot a broken integration without opening it.
  last_success_at     timestamptz,
  last_error          text,
  installed_by        text not null,
  installed_at        timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (storefront_slug, app_id)
);

create index if not exists installed_apps_store_idx
  on installed_apps (storefront_slug);
create index if not exists installed_apps_enabled_idx
  on installed_apps (storefront_slug, enabled);

create table if not exists oauth_state (
  state           text primary key,
  storefront_slug text not null
                    references briefs(slug) on delete cascade,
  app_id          text not null,
  clerk_user_id   text not null,
  -- additional payload to round-trip through the provider (selected
  -- workspace, callback intent, etc)
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '10 minutes'
);

create index if not exists oauth_state_expires_idx
  on oauth_state (expires_at);

create table if not exists app_state (
  storefront_slug text not null
                    references briefs(slug) on delete cascade,
  app_id          text not null,
  key             text not null,
  value           jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now(),
  primary key (storefront_slug, app_id, key)
);

create index if not exists app_state_updated_idx
  on app_state (updated_at desc);

commit;
