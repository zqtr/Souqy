# توسيع التكاملات

**Audience:** founder · **English:** [extending-integrations.md](extending-integrations.md)

استخدم هذه القائمة عند إضافة تطبيق جديد في السوق أو توسيع تطبيق قائم. السلوك المشترك (دورة التثبيت، التوزيع) قد يحتاج مراجعة من مسؤول المنصّة؛ سلوك التطبيق الواحد يبقى ضمن مسار التكاملات.

## الأدوار

- **[`.cursor/agents/integrations-engineer.md`](../../.cursor/agents/integrations-engineer.md)** — تنفيذ تطبيق واحد: `src/lib/apps/<id>.ts`، صف السجلّ، الإجراءات، `src/app/api/apps/**`، `public/apps/<id>/`.
- **[`.cursor/agents/plugin-platform-architect.md`](../../.cursor/agents/plugin-platform-architect.md)** — طبقة المنصّة المشتركة.

## قائمة تحقق

1. **الوصف في السجلّ** — أضف أو عدّل صفاً يدعم OAuth في [`APP_REGISTRY`](../../src/lib/apps/registry.ts): المعرف، الاسم، البائع، الخطاف، الوصف، الفئة، `authKind: 'oauth'`، `available`، `connectCopy`، `requiredEnv`، روابط/نطاقات OAuth، وأصول المعاينة.
2. **التخزين** — اتبع أنماط `installed_apps` / `app_state` ([`src/lib/apps/installed.ts`](../../src/lib/apps/installed.ts)).
3. **إجراءات السيرفر** — تحقق بـ zod، Clerk، `assertStorefrontOwner`؛ نفّذ في [`src/app/actions/apps.ts`](../../src/app/actions/apps.ts) أو ملف مركّز تحت `src/app/actions/`.
4. **HTTP** — يفضّل `src/app/api/apps/<id>/…` للوكلاء أو Webhooks؛ راعِ ملكية المتجر أو التوقيعات.
5. **الواجهة العامة** — إذا احتاج مزوّد OAuth سكربتات أو ودجت للمشتري، وسّع [`AppScripts.tsx`](../../src/components/storefront/AppScripts.tsx) أو أضف جزيرة عميل من [`Storefront.tsx`](../../src/components/storefront/Storefront.tsx).
6. **OAuth** — نفّذ بداية الربط والـ callback الحقيقيين، تحقق `state`، تبادل التوكِن، حفظ التوكِن مشفراً، التحديث، وبيانات حساب المزوّد قبل وضع `available: true`.
7. **الأصول** — تحت `public/apps/<id>/`؛ تجنّب مصطلحات OAuth/API الخام في واجهة السوق (`connectCopy`).
8. **البيئة** — أي سر جديد يمرّ عبر [`src/lib/env.ts`](../../src/lib/env.ts) و`.env.local.example`.
9. **التوثيق** — حدّث [integration-matrix.ar.md](integration-matrix.ar.md) وراجع [`DocsContent.tsx`](../../src/app/[locale]/docs/DocsContent.tsx).

## قواعد بصرية لأسطح التكاملات

شرائح منظومة الصفحة الرئيسية وبطاقات السوق يجب أن ترث نظام Souqna: الفحم `#2A2A2A`، الأسود `#0A0A0A`، الكريم `#E8DCC4`، الحدود الهادئة، الشعارات الفاتحة، وSVG أحادي اللون. لا تضع شعارات المزوّدين الملوّنة مباشرة في شريط الصفحة الرئيسية؛ حوّلها إلى `currentColor` أو اعرضها عبر mask حتى تعمل في الوضعين الفاتح والداكن.

يمكن لشريط الصفحة الرئيسية ذكر أدوات البنية والقنوات المعروفة كقصة منتج. سوق التطبيقات داخل الحساب يجب أن يعرض فقط المزوّدين الذين لديهم تثبيت وإعداد حقيقيان و`available: true`.

## Souqy

Souqy **ليس** تطبيق سوق؛ مساره [`src/lib/souqy/`](../../src/lib/souqy/) و[`src/app/actions/souqy.ts`](../../src/app/actions/souqy.ts). تغييرات القوالب والـ prompts تتبع مسار Souqy/البنّاء وليست هذه القائمة.

## ذات صلة

- [integration-matrix.ar.md](integration-matrix.ar.md)
- [product-overview.ar.md](product-overview.ar.md)
