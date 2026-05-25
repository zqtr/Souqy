# توثيق Souqna (المستودع)

**الجمهور:** المؤسّسون والمساهمون · **English:** [README.md](README.md)

هذا المجلد يضمّ شرحاً موجّهاً للمؤسّسين وجدول التكاملات الخاصّة بمستودع Souqna. اتفاقيات المطوّرين (المكدّس، ما يُسمح وما لا يُسمح) تجدها في [README.md](../README.ar.md) و [AGENTS.md](../AGENTS.md) في جذر المستودع.

مساعدة المستخدم النهائي تُعرَض **داخل المنتج** على `/en/docs` و `/ar/docs` (انظر `src/app/[locale]/docs/`). **الصفحة التسويقية** ثنائية اللغة على النطاق الرئيسي هي `src/app/[locale]/page.tsx` وتُجمَّع في `src/components/souqna/SouqnaHomeExperience.tsx`. أبقِ وصف التطبيقات متطابقاً مع [`src/lib/apps/registry.ts`](../src/lib/apps/registry.ts)؛ عند تغيير أي تطبيق هناك، حدّث [founder/integration-matrix.ar.md](founder/integration-matrix.ar.md) وراجع نص الوثائق داخل الواجهة.

الدليل، الصفحات القانونية، الدفتر، ووثائق المؤسس يجب أن تتبع نظام الصفحة الرئيسية الجديد:

- الأسود `#0A0A0A`، الفحم `#2A2A2A`، الكريم `#E8DCC4`، الحدود الهادئة `#D1C7B2`، النص الفاتح `#F7F7F3`، والأبيض `#FFFFFF`.
- Exo 2 للإنجليزية، Thmanyah Serif Display Bold لعناوين العربية، Thmanyah Sans / Thmanyah Serif Text لنصوص العربية، وJetBrains Mono للوسوم.
- أسطح شبكية هادئة، halftone فقط في الأقسام المقصودة، شعارات SVG أحادية اللون، بطاقات بنصف قطر 8px، أزرار كبسولية، ومن دون تضييق المسافات بين الحروف.
- تجنّب البرتقالي والبنفسجي وتدرجات النيون والأزرق العام لواجهات SaaS. يجب أن تبقى Souqna رمادية/كريمية ومحلية وتشغيلية.
- أسعار الخطط العامة الحالية: مجاني، Pro بسعر `QR 49/mo`، Pro+ بسعر `QR 145/mo`، Max+ بسعر `QR 235/mo`.

## للمؤسّسين

| المستند | الغرض |
|---------|--------|
| [product-overview.ar.md](founder/product-overview.ar.md) | مسارات الواجهة، البنّاء مقابل الموقع الحي، نموذج السوق، الفوترة |
| [integration-matrix.ar.md](founder/integration-matrix.ar.md) | جدول التطبيقات (مرآة لـ `APP_REGISTRY` + قاعدة الصيانة) |
| [extending-integrations.ar.md](founder/extending-integrations.ar.md) | قائمة تحقق لإضافة التكاملات |

## للتجّار

إحالة قصيرة فقط — التفاصيل للزبائن داخل المنتج: [merchants/README.ar.md](merchants/README.ar.md).
