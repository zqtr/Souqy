create table if not exists souqy_conversations (
  id uuid primary key default gen_random_uuid(),
  storefront_slug text not null references briefs(slug) on delete cascade,
  clerk_user_id text not null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists souqy_conversations_storefront_user_idx
  on souqy_conversations (storefront_slug, clerk_user_id, updated_at desc);

create table if not exists souqy_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references souqy_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists souqy_messages_conversation_created_idx
  on souqy_messages (conversation_id, created_at asc);
