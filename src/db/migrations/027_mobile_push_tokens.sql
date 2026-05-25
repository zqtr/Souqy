-- Expo push tokens registered by the Souqna merchant companion app.
-- Tokens are per Clerk user + device so one merchant can receive alerts
-- on multiple iPhones while still letting sign-out unregister one device.

create table if not exists mobile_push_tokens (
  id              uuid primary key default gen_random_uuid(),
  clerk_user_id   text not null,
  device_id       text not null,
  expo_push_token text not null,
  platform        text not null default 'ios',
  app_version     text,
  last_seen_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (clerk_user_id, device_id),
  unique (expo_push_token)
);

create index if not exists mobile_push_tokens_user_idx
  on mobile_push_tokens (clerk_user_id);

create index if not exists mobile_push_tokens_seen_idx
  on mobile_push_tokens (last_seen_at desc);
