begin;

insert into updates (
  id, title, body, type, version, priority, published_at,
  summary, badge, cta_label, cta_href, details_href,
  is_active, is_sticky, audience, preview_payload, banner_payload
) values (
  '5f9ec8de-84a9-4e9e-9df0-080b778a0202',
  'v2.02',
  'Fixed the builder actions menu in Arabic and English. The menu now opens inward, keeps every action readable, and aligns labels correctly in both languages. Check it out in the Builder.',
  'feature',
  'v2.02',
  112,
  now(),
  'Fixed the Builder actions menu in Arabic and English. Check it out in Builder.',
  'v2.02',
  'Check it out',
  '/account/builder',
  '/account/builder',
  true,
  false,
  '{}'::jsonb,
  '{"kind":"builder-menu","route":"/account/builder","features":["rtl-overflow-menu","ltr-overflow-menu","readable-actions"],"languages":["ar","en"]}'::jsonb,
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
