-- Migration 042 - Souqna 2026 plan catalog, platform fee ledgers,
-- manual payout tracking, and account updates inbox.

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------
-- Checkout fee snapshots. Values are copied at order creation time so a
-- later plan change never rewrites historical platform fees.
-- -----------------------------------------------------------------------
alter table checkout_orders
  add column if not exists plan_snapshot       text not null default 'free',
  add column if not exists platform_fee_bps    integer not null default 0,
  add column if not exists platform_fee_qar    integer not null default 0,
  add column if not exists seller_net_qar      integer,
  add column if not exists collection_mode     text not null default 'seller_direct'
                                           check (collection_mode in ('platform_skipcash','seller_direct','offline')),
  add column if not exists platform_provider   text,
  add column if not exists platform_fee_status text not null default 'not_due'
                                           check (platform_fee_status in ('not_due','collected','receivable','waived')),
  add column if not exists payout_status       text not null default 'not_applicable'
                                           check (payout_status in ('not_applicable','pending','paid','cancelled'));

update checkout_orders
   set seller_net_qar = total_qar
 where seller_net_qar is null;

alter table checkout_orders
  alter column seller_net_qar set default 0,
  alter column seller_net_qar set not null;

create table if not exists platform_fee_entries (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null unique references checkout_orders(id) on delete cascade,
  clerk_user_id   text not null,
  storefront_slug text not null references briefs(slug) on delete cascade,
  plan_snapshot   text not null,
  fee_bps         integer not null,
  gross_qar       integer not null,
  fee_qar         integer not null,
  collection_mode text not null check (collection_mode in ('platform_skipcash','seller_direct','offline')),
  status          text not null default 'receivable'
                    check (status in ('collected','receivable','waived')),
  collected_at    timestamptz,
  waived_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists platform_fee_entries_status_idx
  on platform_fee_entries (status, created_at);
create index if not exists platform_fee_entries_user_idx
  on platform_fee_entries (clerk_user_id, created_at desc);

create table if not exists checkout_payouts (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null unique references checkout_orders(id) on delete cascade,
  clerk_user_id   text not null,
  storefront_slug text not null references briefs(slug) on delete cascade,
  gross_qar       integer not null,
  fee_qar         integer not null,
  net_qar         integer not null,
  status          text not null default 'pending'
                    check (status in ('pending','paid','cancelled')),
  paid_at         timestamptz,
  paid_by         text,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists checkout_payouts_status_idx
  on checkout_payouts (status, created_at);
create index if not exists checkout_payouts_user_idx
  on checkout_payouts (clerk_user_id, created_at desc);

-- -----------------------------------------------------------------------
-- Account Updates Inbox. The read table is per Clerk user so updates stay
-- acknowledged across devices and sessions.
-- -----------------------------------------------------------------------
create table if not exists updates (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  body            text not null,
  type            text not null check (type in ('feature','billing','system','warning')),
  version         text,
  priority        integer not null default 0,
  published_at    timestamptz not null default now(),
  expires_at      timestamptz,
  is_active       boolean not null default true,
  summary         text,
  badge           text,
  cta_label       text,
  cta_href        text,
  details_href    text,
  image_url       text,
  video_url       text,
  preview_payload jsonb not null default '{}'::jsonb,
  banner_payload  jsonb not null default '{}'::jsonb,
  is_sticky       boolean not null default false,
  audience        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists updates_active_order_idx
  on updates (is_active, priority desc, published_at desc);
create index if not exists updates_expires_idx
  on updates (expires_at);

create table if not exists user_update_reads (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  update_id  uuid not null references updates(id) on delete cascade,
  read_at    timestamptz not null default now(),
  unique (user_id, update_id)
);

create index if not exists user_update_reads_user_idx
  on user_update_reads (user_id, read_at desc);
create index if not exists user_update_reads_update_idx
  on user_update_reads (update_id);

insert into updates (
  id, title, body, type, version, priority, published_at,
  summary, badge, cta_label, cta_href, details_href, is_active, is_sticky, audience
) values (
  '28e3de2c-7d8e-46d5-9fc2-320e1e116f1f',
  'New Souqna growth plans are live',
  'Souqna now includes clearer Free, Pro, Pro+, and Max+ tiers with storefront limits, AI credits, platform fees, and growth tools matched to how merchants scale.',
  'feature',
  'plans-2026-05-growth-tools',
  50,
  now(),
  'Plan limits, transaction fees, and AI credits now match the new Souqna catalog.',
  'Plans',
  'View plan',
  '/account/settings/plan',
  '/account/settings/plan',
  true,
  false,
  '{}'::jsonb
) on conflict (id) do update
  set title = excluded.title,
      body = excluded.body,
      type = excluded.type,
      version = excluded.version,
      priority = excluded.priority,
      summary = excluded.summary,
      badge = excluded.badge,
      cta_label = excluded.cta_label,
      cta_href = excluded.cta_href,
      details_href = excluded.details_href,
      is_active = excluded.is_active,
      is_sticky = excluded.is_sticky,
      audience = excluded.audience,
      updated_at = now();

insert into updates (
  id, title, body, type, version, priority, published_at,
  summary, badge, cta_label, cta_href, is_active, is_sticky, audience
) values (
  '09a8df5c-4e24-438a-b444-47904098cb60',
  'Growth tools are ready when you are',
  'Free storefronts can keep selling with Souqna branding. When you need custom domains, analytics, discount codes, WhatsApp, SEO, and AI credits, Pro unlocks the next layer quietly.',
  'billing',
  'free-2026-05-growth-tools-upsell',
  20,
  now(),
  'New growth tools are now available on Pro and Pro+.',
  'Free',
  'Compare plans',
  '/account/settings/plan',
  true,
  false,
  '{"plans":["free"]}'::jsonb
) on conflict (id) do update
  set title = excluded.title,
      body = excluded.body,
      type = excluded.type,
      version = excluded.version,
      priority = excluded.priority,
      summary = excluded.summary,
      badge = excluded.badge,
      cta_label = excluded.cta_label,
      cta_href = excluded.cta_href,
      is_active = excluded.is_active,
      is_sticky = excluded.is_sticky,
      audience = excluded.audience,
      updated_at = now();

-- Keep the DB-side plan catalog aligned with the TypeScript source of truth.
insert into plan_tiers (
  id, rank, label, label_ar,
  monthly_price_qar, annual_monthly_qar,
  storefronts, template_count, meta
) values
  (
    'free', 0, 'Free', 'مجاني',
    0, 0, 1, 1,
    '{"productCap":10,"monthlyOrderCap":25,"transactionFeeBps":500,"aiCreditsMonthly":0,"analytics":"none","integrations":"none","support":"community","brandingLocked":true,"customDomain":false,"discounts":false,"seo":false}'::jsonb
  ),
  (
    'starter', 1, 'Pro', 'برو',
    49, 32, 2, 5,
    '{"productCap":null,"monthlyOrderCap":null,"transactionFeeBps":300,"aiCreditsMonthly":100,"analytics":"basic","integrations":"basic","support":"email","brandingLocked":false,"customDomain":true,"discounts":true,"seo":true,"whatsapp":true}'::jsonb
  ),
  (
    'pro', 2, 'Pro+', 'برو+',
    145, 94, 8, 8,
    '{"productCap":null,"monthlyOrderCap":null,"transactionFeeBps":100,"aiCreditsMonthly":null,"analytics":"advanced","integrations":"growth","support":"priority","souqy":true,"aiBrandingAssets":true,"marketingApps":true,"metaTikTok":true,"teamMembers":true,"automationFlows":true,"premiumBlocks":true}'::jsonb
  ),
  (
    'atelier', 3, 'Max+', 'ماكس+',
    235, 153, null, 11,
    '{"productCap":null,"monthlyOrderCap":null,"transactionFeeBps":0,"aiCreditsMonthly":null,"analytics":"advanced","integrations":"advanced","support":"dedicated","workspace":true,"clientPermissions":true,"whiteLabel":true,"api":true,"bulkOperations":true,"advancedSeoAi":true,"earlyAccess":true}'::jsonb
  )
on conflict (id) do update
  set rank               = excluded.rank,
      label              = excluded.label,
      label_ar           = excluded.label_ar,
      monthly_price_qar  = excluded.monthly_price_qar,
      annual_monthly_qar = excluded.annual_monthly_qar,
      storefronts        = excluded.storefronts,
      template_count     = excluded.template_count,
      effective_from     = now(),
      meta               = plan_tiers.meta || excluded.meta;

commit;
