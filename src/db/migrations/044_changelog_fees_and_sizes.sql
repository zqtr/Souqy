-- Migration 044 - Changelog entries for platform fees and custom product sizes.

begin;

update updates
   set is_active = false,
       updated_at = now()
 where version like 'localhost-test-%';

insert into updates (
  id, title, body, type, version, priority, published_at,
  summary, badge, cta_label, cta_href, details_href,
  is_active, is_sticky, audience, preview_payload, banner_payload
) values (
  '0f7d9b79-6b6d-4ec6-8c80-27c8bf9a9d3a',
  'Souqna platform fees are now clearer',
  'Souqna now snapshots the seller plan on every checkout order so the platform fee is easy to audit: Free is 5%, Pro is 3%, Pro+ is 1%, and Max+ is 0%. For SkipCash online checkout, Souqna collects the buyer payment through the platform SkipCash account, marks the platform fee as collected, and creates a pending seller payout for the net amount. Cash on delivery has no Souqna fee. Bank transfer and pay-link orders stay merchant-collected and can be tracked separately when needed.',
  'billing',
  'fees-2026-05-platform-collection',
  95,
  now(),
  'Free 5%, Pro 3%, Pro+ 1%, Max+ 0%. SkipCash orders collect the fee automatically; COD is fee-free.',
  'Fees',
  'View plans',
  '/account/settings/plan',
  '/account/settings/plan',
  true,
  false,
  '{}'::jsonb,
  '{"kind":"fees","rates":{"free":"5%","starter":"3%","pro":"1%","atelier":"0%"},"codFee":"0%","onlineCollection":"platform_skipcash"}'::jsonb,
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
      preview_payload = excluded.preview_payload,
      banner_payload = excluded.banner_payload,
      updated_at = now();

insert into updates (
  id, title, body, type, version, priority, published_at,
  summary, badge, cta_label, cta_href, details_href,
  is_active, is_sticky, audience, preview_payload, banner_payload
) values (
  'd5e21d45-d59f-4aa9-a918-39079018bd15',
  'Custom sizes are available for products',
  'Products can now offer size choices for apparel, shoes, and any item that needs a required option. Turn on Sizes while adding or editing a product, keep standard choices like S, M, and L, or add custom values such as 35, 36, and 37 with the plus button. Shoppers choose a size before checkout, and Souqna saves that choice across the cart, checkout, order records, emails, and print views.',
  'feature',
  'products-2026-05-custom-sizes',
  85,
  now(),
  'Add standard or custom size choices like S, M, L, 35, 36, and 37 from the product form.',
  'Products',
  'Manage products',
  '/account/products',
  '/account/products',
  true,
  false,
  '{}'::jsonb,
  '{"kind":"product-sizes","examples":["S","M","L","35","36","37"],"requiredAtCheckout":true}'::jsonb,
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
      preview_payload = excluded.preview_payload,
      banner_payload = excluded.banner_payload,
      updated_at = now();

update updates
   set title = 'New Souqna growth plans, fees, and product options are live',
       body = 'Souqna now includes clearer Free, Pro, Pro+, and Max+ tiers, visible transaction-fee rates, dashboard upgrade guidance, and product options such as custom sizes. The changelog explains how fees are collected and how sellers can add size choices to products.',
       summary = 'Plan limits, transaction fees, AI credits, and custom product sizes now match the new Souqna catalog.',
       updated_at = now()
 where id = '28e3de2c-7d8e-46d5-9fc2-320e1e116f1f';

commit;
