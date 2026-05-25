# نظرة عامة على منتج Souqna

**Audience:** founder · **English:** [product-overview.md](product-overview.md)

Souqna منصّة واجهات متاجر ثنائية اللغة. كل **متجر** (الصف المرتبط تاريخياً بجدول `briefs`) له لغته، ثيمه، كتالوجه، صفحاته، و**تطبيقات مثبّتة** خاصّة به. المؤسّس يعمل في مساحة **الحساب**؛ الزائر يرى **الواجهة العامة** على مسار الـ brief.

## الصفحة التسويقية على النطاق الرئيسي

المسارات المحلّية على النطاق الرئيسي (`/` للإنجليزية الافتراضية، `/ar` للعربية) تُعرَض عبر `src/app/[locale]/page.tsx` ثم [`SouqnaHomeExperience`](../../src/components/souqna/SouqnaHomeExperience.tsx). الصفحة الرئيسية تملك الهيدر والفوتر الخاصين بها وتخفي الكروم العام؛ الدليل، الدفتر، الصفحات القانونية، وبقية الصفحات التحريرية تبقى على التخطيط العام إلا إذا احتاجت تكويناً كاملاً خاصاً بها.

يعتمد تصميم الصفحة الرئيسية الحالي على الرمادي والكريم: الأسود `#0A0A0A`، الفحم `#2A2A2A`، الكريم `#E8DCC4`، الحدود الهادئة `#D1C7B2`، النص الفاتح `#F7F7F3`، والأبيض `#FFFFFF`. تجنّب البرتقالي والبنفسجي وتدرجات النيون والأزرق العام لواجهات SaaS في هذا المسار.

الخط جزء من هوية المنتج: Exo 2 للإنجليزية، Thmanyah Serif Display Bold لعناوين العربية الكبيرة، Thmanyah Sans أو Thmanyah Serif Text لنصوص العربية، وJetBrains Mono للوسوم الصغيرة. عناوين العربية يجب أن تستخدم متغير Thmanyah serif display حتى تبقى نبرة `/ar` مطابقة لهوية `/`.

تركيب الصفحة العامة الحالي: hero حي بخلفية halftone، تنقّل كبسولي، شريط شعارات تكاملات أحادي اللون، أقسام onboarding/how-to، إثبات مساحة العمل، بطاقات دفتر المؤسسين، الخطط، التواصل، وفوتر ReactBits. الحركة يجب أن تبقى هادئة مع بديل ثابت عند `prefers-reduced-motion`.

## مسار عرض الواجهة

يختار [`Storefront`](../../src/components/storefront/Storefront.tsx) بين:

1. **Souqy** — إذا كان للمتجر إصدار Souqy منشور **ولا** يمرّر المستدعي مسودّة عبر `overrideBlocks` (معاينة لوحة التحكم تمرّر المسودّة دائماً)، تفوز الحزمة المولَّدة بالذكاء الاصطناعي على شجرة البلوكات JSON.
2. **خط البلوكات** — عندما يكون `published_blocks` (أو المسودّة في المعاينة) غير فارغ، تُعرَض البلوكات عبر [`BlockRenderer`](../../src/components/storefront/BlockRenderer.tsx).
3. **قوالب قديمة** — بدون بلوكات بعد، تبقى قوالب الأنماط القديمة (مثل Menu و Lookbook) تعمل إلى أن ينشر المؤسّس من البنّاء.

إذا تعذّر تحميل Souqy وقت الطلب، يمكن التراجع إلى `published_blocks` (انظر تعليقات `Storefront.tsx`).

## البنّاء والنشر

- **المحرّر:** [`/account/builder`](../../src/app/account/builder/page.tsx) يحمّل [`BuilderShell`](../../src/components/builder/BuilderShell.tsx): المكتبة، المخطّط، المفتّش، وiframe للمعاينة على [`/account/[slug]/preview`](../../src/app/account/[slug]/preview/page.tsx).
- **التخزين:** مسودّات الصفحات في `storefront_pages`؛ النشر يرفع المسودّة إلى المنشور حيث ينطبق المنطق (إجراءات البنّاء تحت `src/app/actions/builder.ts`).
- **القوالب:** تخطيط البداية من إعدادات القوالب ([`src/lib/templates.ts`](../../src/lib/templates.ts)) و`bootBlocksFromStorefront`؛ يمكن تبديل القالب من مفتّش الموقع ضمن حدود الخطة ([`src/lib/plans.ts`](../../src/lib/plans.ts)).

## سوق التطبيقات

- **السجلّ:** [`APP_REGISTRY`](../../src/lib/apps/registry.ts) يعرّف بطاقات السوق التي تدعم OAuth فقط. التثبيت **لكل slug متجر** (`installed_apps` عبر [`src/lib/apps/installed.ts`](../../src/lib/apps/installed.ts)).
- **الأسطح:** تكاملات OAuth قد تضيف سكربتات للواجهة، إعدادات في لوحة التحكم، مزامنة سيرفرية، أو سلوك دفع حسب المزوّد. التفاصيل في [integration-matrix.ar.md](integration-matrix.ar.md).
- **التوسّع:** [extending-integrations.ar.md](extending-integrations.ar.md).

## Souqy

**Souqy** يولّد حزمة واجهة متعددة الملفات مع التحقق عبر بوابة AI ([`src/lib/souqy/generate.ts`](../../src/lib/souqy/generate.ts))؛ إعادة التوجيه للتحرير المتكرّر تستخدم نفس المسار بطلب فرق. التنسيق من لوحة التحكم في [`src/app/actions/souqy.ts`](../../src/app/actions/souqy.ts). لقطات الشاشة اختيارية ومقيّدة بالبيئة (`src/lib/souqy/screenshot.ts`).

لا تتجاوز قيود الخطة/الفوترة في نقاط الدخول الجديدة لـ Souqy.

## الخطط والفوترة

الخطط والحدود في [`src/lib/plans.ts`](../../src/lib/plans.ts)؛ الفوترة والاشتراك في [`src/lib/billing.ts`](../../src/lib/billing.ts) والواجهات المرتبطة. سطح الأسعار العام يعرض حالياً: مجاني، Pro بسعر `QR 49/mo`، Pro+ بسعر `QR 145/mo`، وMax+ بسعر `QR 235/mo`. اعتبر `src/lib/plans.ts` مصدر الحقيقة وحدّث الوثائق والصفحة الرئيسية معاً عند تغيير الأسعار أو التسميات.

## مستندات ذات صلة

- [integration-matrix.ar.md](integration-matrix.ar.md)
- [extending-integrations.ar.md](extending-integrations.ar.md)
- [AGENTS.md](../../AGENTS.md)
