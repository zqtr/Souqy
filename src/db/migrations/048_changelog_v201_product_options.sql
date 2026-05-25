begin;

update updates
   set title = 'Souqna push update is live',
       body = replace(replace(body, 'Production deployment', 'Souqna push'), 'production deployment', 'Souqna push'),
       summary = replace(replace(summary, 'production deployment', 'Souqna push'), 'deployment', 'push'),
       badge = 'Push',
       updated_at = now()
 where version like 'deployment:%';

insert into updates (
  id, title, body, type, version, priority, published_at,
  summary, badge, cta_label, cta_href, details_href,
  is_active, is_sticky, audience, preview_payload, banner_payload
) values (
  '2f2c7a2c-2d14-4f22-9080-dc266ad1d201',
  'v2.01',
  'Added custom sizes and height options. Merchants can now offer preset sizes, let buyers enter a missing custom size, and add height choices such as 156, 165, and 178. Check it out in Products.',
  'feature',
  'v2.01',
  110,
  now(),
  'Added custom sizes and height options. Check it out in Products.',
  'v2.01',
  'Check it out',
  '/account/products?new=1',
  '/account/products?new=1',
  true,
  false,
  '{}'::jsonb,
  '{"kind":"product-options","route":"/account/products?new=1","features":["custom-size-input","height-options"],"examples":["S","M","L","custom size","156","165","178"]}'::jsonb,
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

commit;
