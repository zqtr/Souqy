# مصفوفة تكامل التطبيقات

**Audience:** founder · **English:** [integration-matrix.md](integration-matrix.md)

**مصدر الحقيقة:** [`APP_REGISTRY`](../../src/lib/apps/registry.ts). عند إضافة تطبيق أو تغيير حالة `available`، حدّث هذا الجدول وراجع [`DocsContent.tsx`](../../src/app/[locale]/docs/DocsContent.tsx) (مصفوفة `APPS`) حتى يبقى نص المساعدة للزبائن متسقاً. انظر أيضاً [extending-integrations.ar.md](extending-integrations.ar.md).

يعرض السوق تكاملات OAuth فقط. أزيلت الإضافات التي لا تعتمد OAuth من سجل السوق.

## شريط التكاملات في الصفحة الرئيسية

يمكن للصفحة الرئيسية أن تعرض قصة أوسع من سوق التطبيقات داخل الحساب: Vercel، Clerk، Meta، WhatsApp، Instagram، Apple Pay، SkipCash، Zapier، Cloudflare، Mailchimp، Klaviyo، Aramex، Google Sheets، وأدوات تشغيلية أخرى يمكن أن تظهر كشعارات SVG أحادية اللون. تبقى هذه الشعارات عرضاً بصرياً فقط ما لم يكن لدى المزوّد مسار تثبيت وإعداد حقيقي في `APP_REGISTRY`.

قواعد التصميم للشريط:

- استخدم شعارات SVG حقيقية حيث أمكن، بلون واحد عبر `currentColor` أو mask أو filter.
- استخدم شرائح فحمية على الأسطح الكريمية أو شعارات فاتحة على hero داكن.
- تجنّب شعارات المزوّدين الملوّنة، التدرجات الزرقاء، والتعبئات البرتقالية.
- حرّك الصفوف يميناً ويساراً باستمرار مع بديل ثابت واضح عند تقليل الحركة.

**الأسطح** (اختصار):

- **Storefront** — موقع المشتري (سكربتات، جزر، بلوكات).
- **Builder** — `/account/builder` فقط.
- **API** — `src/app/api/apps/<id>/...` أو ما شابه.
- **Server** — Webhooks، كتابات خلفية، أدوات النطاق.
- **Dashboard** — إعدادات تحت `/account/apps` و`/account/settings`، إلخ.

## متوفّر اليوم (`available: true`)

لا يوجد تكامل OAuth مفعّل حالياً حتى يكتمل ربط OAuth الحقيقي من البداية للنهاية.

## قريباً (`available: false`)

بالترتيب في السجلّ؛ مفاتيح OAuth والبيئة التفصيلية في الـ registry.

| id | الاسم | الفئة | نوع المصادقة |
|----|-------|-------|---------------|
| mailchimp | Mailchimp | marketing | oauth |
| klaviyo | Klaviyo | marketing | oauth |
| whatsapp-business | WhatsApp Business | sales | oauth |
| instagram-shop | Instagram Shop | sales | oauth |
| tap-payments | Tap Payments | finance | oauth |

## إضافات غير OAuth تمت إزالتها

أزيلت من سجل السوق: Tabby، Postpay، Currency Converter، Giphy، TikTok Pixel، Zapier، Notion، Google Sheets export، Crisp live chat، Intercom، HubSpot، Drop manager، Mawid، Taqim، Press kit / Lookbook، Bilingual SEO Assistant، Aramex shipping، Cloudflare DNS، Google Analytics 4، Meta Pixel، و Fawran.

## الصيانة

عند كل تغيير على التطبيقات: حدّث `APP_REGISTRY` ثم هذا الملف ثم راجع نسخة `DocsContent` للتطبيقات في الواجهة.
