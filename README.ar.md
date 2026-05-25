# Souqna

**الجمهور:** المطوّرين · **English:** [README.md](README.md)

Souqna منصّة واجهات وتجارة ثنائية اللغة (إنجليزي / عربي مع RTL كامل) للمؤسّسين: لوحة تحكم بعد تسجيل الدخول، محرّر صفحات مرئي، مسارات المنتجات والطلبات، الخطط والفوترة، وسوق تطبيقات **لكل متجر على حدة**. المتاجر العامة تُعرَض ضمن نطاق الـ brief؛ و**Souqy** يضيف حزمة واجهة مولَّدة بالذكاء الاصطناعي عندما يكون للمتجر إصدار Souqy منشور.

## التقنية

- **Next.js 14** (App Router)، TypeScript، Tailwind v4، **next-intl** (`en` / `ar`)
- مصادقة **Clerk**
- **Neon Postgres** عبر `@neondatabase/serverless` (SQL بنمط القوالب فقط)
- تخزين **Vercel Blob**
- **Vercel AI SDK** وبوابة AI (على Vercel OIDC؛ محلياً `AI_GATEWAY_API_KEY`)
- **Postmark** (معاملات) + **Resend** (إرث / تسويق) عبر `src/lib/mailer.ts`
- **Sentry**، **PostHog**، **Vercel Analytics**

اتفاقيات المساهمة للتفاصيل: [AGENTS.md](AGENTS.md).

## أين يوجد كل شيء

| المجال | المسار |
|--------|--------|
| التوجيه، البوابة، الـ subdomain | `src/middleware.ts` |
| متغيّرات البيئة | `src/lib/env.ts` |
| وصف تطبيقات السوق | `src/lib/apps/registry.ts` |
| توليد Souqy والتحقق | `src/lib/souqy/` |
| إجراءات Souqy على السيرفر | `src/app/actions/souqy.ts` |
| واجهة البنّاء | `src/components/builder/BuilderShell.tsx`, `src/app/account/builder/page.tsx` |
| الواجهة العامة للمتجر | `src/app/brief/[slug]/[[...path]]/page.tsx` |
| معاينة المسودّة (iframe البنّاء) | `src/app/account/[slug]/preview/page.tsx` |
| الصفحة التسويقية (`/`، `/ar`، …) | `src/app/[locale]/page.tsx`, `src/components/souqna/SouqnaHomeExperience.tsx`, هيدر وفوتر مملوكان للصفحة |

تستخدم الصفحة العامة، الدليل، الصفحات القانونية، الدفتر، وملاحظات المنتج المكتوبة بـ Markdown نظام Souqna التحريري الحالي:

- **الألوان:** الأسود `#0A0A0A`، الفحم `#2A2A2A`، الكريم `#E8DCC4`، الحدود الهادئة `#D1C7B2`، النص الفاتح `#F7F7F3`، والأبيض `#FFFFFF`.
- **الخطوط:** Exo 2 للإنجليزية، Thmanyah Serif Display Bold لعناوين العربية، Thmanyah Sans أو Thmanyah Serif Text لنصوص العربية، وJetBrains Mono للوسوم التشغيلية الصغيرة.
- **لغة الصفحة الرئيسية:** خلفية halftone رمادية/كريمية حيّة، شريط تنقّل كبسولي، شعارات تكاملات SVG أحادية اللون، خطوط شبكة رفيعة، بطاقات هادئة، ومن دون ألوان برتقالية أو بنفسجية أو زرقاء بنمط SaaS عام.
- **الخطط:** مجاني، Pro بسعر `QR 49/mo`، Pro+ بسعر `QR 145/mo`، Max+ بسعر `QR 235/mo`؛ أبقِ النصوص متطابقة مع `src/lib/plans.ts` وقسم `#plans` في الصفحة الرئيسية.

نظرة منتج للمؤسّسين وجدول التكاملات: [docs/README.ar.md](docs/README.ar.md).

## التطوير المحلي

1. انسخ `.env.local.example` إلى `.env.local` وعبّئ القيم (تفاصيل الحقول في `src/lib/env.ts`).
2. ثبّت الحزم وشغّل السيرفر المحلي (`npm install`, `npm run dev`).
3. البناء للإنتاج يشغّل `node scripts/migrate.mjs` قبل `next build`؛ تأكد أن اتصال قاعدة البيانات يسمح بالهجرات عند تجربة البناء محلياً.

إذا ظهر خطأ مثل `Cannot find module './vendor-chunks/@vercel.js'` (أو ملفات ناقصة تحت `.next/server/vendor-chunks/`)، أوقف السيرفر، نفّذ `rm -rf .next`، ثم شغّل `npm run dev` من جديد — مجلد الإخراج كان غير مكتمل أو قديماً.

## تطبيقات أخرى في المستودع

**Souqna Pulse** — تطبيق macOS اختياري يبث أحداث لوحة التحكم. التفاصيل في [apps/pulse/README.md](apps/pulse/README.md). يستخدم `PULSE_ADMIN_TOKEN` من البيئة (انظر `src/lib/env.ts`).
