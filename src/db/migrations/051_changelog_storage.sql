begin;

insert into updates (
  id, title, body, type, version, priority, published_at,
  summary, badge, cta_label, cta_href, details_href,
  is_active, is_sticky, audience, preview_payload, banner_payload
) values (
  '8c4a7a4e-b4a2-4e2b-9b3a-3e7f6d7a0203',
  'Introducing Storage / تقديم التخزين',
  'Introducing Storage: upload custom pictures with a capacity of 1GB from Souqna. يمكنك الآن رفع صورك المخصصة بسعة 1GB من سوقنا واستخدامها في المتجر والبنّاء.',
  'feature',
  'v2.03',
  116,
  now(),
  'Upload custom pictures with a 1GB Souqna Storage library. ارفع صورك المخصصة بسعة 1GB من مكتبة تخزين سوقنا.',
  'Storage',
  'Open Storage',
  '/account/storage-library',
  '/account/storage-library',
  true,
  false,
  '{}'::jsonb,
  '{"kind":"storage-library","route":"/account/storage-library","limitBytes":1073741824,"features":["store-scoped-library","builder-picker","custom-pictures","1gb-capacity"],"languages":["en","ar"]}'::jsonb,
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
