'use client';

import { SignedIn, SignedOut } from '@clerk/nextjs';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigation2, type Navigation2Item } from '@/components/navigation-2';
import { SouqnaLockup } from '@/components/primitives/SouqnaLockup';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { getPolicy, type PolicySlug } from '@/content/policies';
import type { Locale } from '@/i18n/locales';

type Lang = Locale;

type Bilingual = { en: ReactNode; ar: ReactNode };
type Section = {
  id: string;
  title: Bilingual;
  body: Bilingual;
};

type AppDoc = {
  id: string;
  name: Bilingual;
  what: Bilingual;
  needs: Bilingual;
  plan: 'free' | 'starter' | 'pro' | 'atelier';
};

const APPS: AppDoc[] = [
  {
    id: 'mailchimp',
    name: { en: 'Mailchimp', ar: 'Mailchimp' },
    what: {
      en: 'Syncs customer and inquiry emails to a Mailchimp audience once the founder connects their Mailchimp account.',
      ar: 'يزامن إيميلات العملاء والاستفسارات مع جمهور Mailchimp بعد ربط حساب Mailchimp الخاص بالمؤسس.',
    },
    needs: {
      en: 'A connected Mailchimp account through OAuth.',
      ar: 'حساب Mailchimp مربوط عبر OAuth.',
    },
    plan: 'free',
  },
  {
    id: 'klaviyo',
    name: { en: 'Klaviyo', ar: 'Klaviyo' },
    what: {
      en: 'Syncs customers and order events to Klaviyo for email and SMS automation after OAuth connection.',
      ar: 'يزامن العملاء وأحداث الطلبات مع Klaviyo لتشغيل أتمتة الإيميل والرسائل بعد الربط عبر OAuth.',
    },
    needs: {
      en: 'A connected Klaviyo account through OAuth.',
      ar: 'حساب Klaviyo مربوط عبر OAuth.',
    },
    plan: 'free',
  },
  {
    id: 'whatsapp-business',
    name: { en: 'WhatsApp Business', ar: 'WhatsApp Business' },
    what: {
      en: 'Connects a WhatsApp Business account so storefront inquiries can route to the selected business number.',
      ar: 'يربط حساب WhatsApp Business حتى تتحول استفسارات المتجر إلى رقم النشاط المختار.',
    },
    needs: {
      en: 'A connected Meta / WhatsApp Business account through OAuth.',
      ar: 'حساب Meta / WhatsApp Business مربوط عبر OAuth.',
    },
    plan: 'free',
  },
  {
    id: 'instagram-shop',
    name: { en: 'Instagram Shop', ar: 'Instagram Shop' },
    what: {
      en: 'Connects Meta commerce surfaces so products can be mirrored for Instagram shopping workflows.',
      ar: 'يربط أسطح التجارة في Meta حتى تتم مزامنة المنتجات لاستخدامات التسوق في Instagram.',
    },
    needs: {
      en: 'A connected Meta account with commerce/catalog permissions.',
      ar: 'حساب Meta مربوط مع صلاحيات الكتالوج والتجارة.',
    },
    plan: 'free',
  },
  {
    id: 'tap-payments',
    name: { en: 'Tap Payments', ar: 'Tap Payments' },
    what: {
      en: 'Connects a Tap merchant account so storefront checkout can offer GCC card and wallet payment methods.',
      ar: 'يربط حساب تاجر Tap حتى يوفر الدفع في المتجر بطاقات ومحافظ مناسبة للخليج.',
    },
    needs: {
      en: 'A connected Tap merchant account through OAuth.',
      ar: 'حساب تاجر Tap مربوط عبر OAuth.',
    },
    plan: 'free',
  },
];

const PLANS_TABLE = [
  {
    id: 'free',
    en: { name: 'Free', price: '0 QAR', stores: '1 storefront', tpl: '10 products, 1 template, 25 orders/month, 5% fee' },
    ar: { name: 'مجاني', price: '٠ ر.ق', stores: 'متجر واحد', tpl: '٣ قوالب بدائية' },
    en_tag: 'For getting your first hundred sales.',
    ar_tag: 'لأول مئة عملية بيع.',
  },
  {
    id: 'starter',
    en: { name: 'Pro', price: '49 QAR / mo', stores: '2 storefronts', tpl: 'Unlimited products, 5 templates, 100 AI credits, 3% fee' },
    ar: { name: 'برو', price: '١٩٠ ر.ق / شهر', stores: '٣ متاجر', tpl: '٦ قوالب كلاسيكية' },
    en_tag: 'A small portfolio of brands.',
    ar_tag: 'محفظة صغيرة من العلامات.',
  },
  {
    id: 'pro',
    en: {
      name: 'Pro+',
      price: '145 QAR / mo',
      stores: '8 storefronts',
      tpl: 'Souqy AI, marketing apps, team, automation, advanced analytics, 1% fee',
    },
    ar: {
      name: 'برو +',
      price: '٣٥٠ ر.ق / شهر',
      stores: '١٠ متاجر',
      tpl: '٨ قوالب + أنماط مميزة + بلوكات متحركة + سوقي AI',
    },
    en_tag: 'Founders going pro.',
    ar_tag: 'للمؤسسين اللي يبون يطلعون احترافي.',
  },
  {
    id: 'atelier',
    en: {
      name: 'Max+',
      price: '235 QAR / mo',
      stores: 'Unlimited storefronts',
      tpl: 'White-label tools, API access, bulk operations, dedicated support, 0% fee',
    },
    ar: {
      name: 'ماكس +',
      price: '٧٠٠ ر.ق / شهر',
      stores: 'متاجر غير محدودة',
      tpl: 'كل القوالب الـ١٠ + كل الأنماط المميزة + دعم بالقفازات البيضاء',
    },
    en_tag: 'Top tier — annual saves ~35%.',
    ar_tag: 'الفئة العليا — سنوي يوفّر تقريباً ٣٥٪.',
  },
];

const BLOCKS = [
  {
    id: 'hero',
    en: 'Hero — title, eyebrow, tagline, CTA, background image or pattern.',
    ar: 'هيرو — عنوان، حاجب، شعار، زر، خلفية صورة أو نقش.',
  },
  {
    id: 'banner',
    en: 'Banner — full-bleed image with optional caption.',
    ar: 'بانر — صورة عريضة مع تعليق اختياري.',
  },
  { id: 'text', en: 'Text — paragraphs, headings, lists.', ar: 'نص — فقرات، عناوين، قوائم.' },
  {
    id: 'image',
    en: 'Image — single image with caption and link.',
    ar: 'صورة — صورة وحدة مع تعليق ورابط.',
  },
  { id: 'gallery', en: 'Gallery — image grid with lightbox.', ar: 'معرض — شبكة صور مع عرض موسّع.' },
  {
    id: 'productGrid',
    en: 'Product Grid — your catalogue in tidy cards.',
    ar: 'شبكة المنتجات — كتالوجك في كروت مرتّبة.',
  },
  {
    id: 'productList',
    en: 'Product List — list view of products.',
    ar: 'قائمة المنتجات — عرض القائمة الطولي.',
  },
  {
    id: 'featuredProduct',
    en: 'Featured Product — split layout for one hero product.',
    ar: 'منتج مميّز — تخطيط مقسوم لمنتج واحد بطل.',
  },
  {
    id: 'serviceList',
    en: 'Service List — for service-led businesses.',
    ar: 'قائمة الخدمات — للأنشطة الخدمية.',
  },
  { id: 'menu', en: 'Menu — restaurants and cafés.', ar: 'منيو — للمطاعم والكافيهات.' },
  { id: 'calendar', en: 'Calendar — events and availability.', ar: 'تقويم — للفعاليات والمواعيد.' },
  {
    id: 'contactCard',
    en: 'Contact Card — phone, email, address, map link.',
    ar: 'كرت تواصل — جوال، إيميل، عنوان، رابط خريطة.',
  },
  {
    id: 'inquireCta',
    en: 'Inquire CTA — opens an inquiry dialog.',
    ar: 'زر استفسار — يفتح نموذج استفسار.',
  },
  { id: 'spacer', en: 'Spacer — adds vertical breathing room.', ar: 'فاصل — يضيف مسافة عمودية.' },
  { id: 'divider', en: 'Divider — a horizontal rule.', ar: 'خط فاصل — خط أفقي بسيط.' },
  {
    id: 'drop',
    en: 'Drop — limited-edition launch with countdown and waitlist.',
    ar: 'Drop — إطلاق محدود مع عدّاد تنازلي وقائمة انتظار.',
  },
  {
    id: 'animatedText',
    en: 'Animated Text (Pro+) — kinetic text effects.',
    ar: 'نص متحرك (برو+) — مؤثرات نص حركية.',
  },
  {
    id: 'animatedImage',
    en: 'Animated Image (Pro+) — animated image entrances.',
    ar: 'صورة متحركة (برو+) — مدخل حركي للصور.',
  },
  {
    id: 'productCardStack',
    en: 'Product Card Stack (Pro+) — layered card with hover fan.',
    ar: 'كرت منتج مكدّس (برو+) — كرت بطبقات يفتح عند التمرير.',
  },
  {
    id: 'tiltImage',
    en: 'Tilt Image (Pro+) — image card with hover lift and tilt.',
    ar: 'صورة مائلة (برو+) — كرت صورة يميل ويرتفع عند التمرير.',
  },
  {
    id: 'spotlightCard',
    en: 'Spotlight Card (Pro+) — content card with date badge and rise effect.',
    ar: 'كرت سبوتلايت (برو+) — كرت محتوى بشارة تاريخ ومؤثر صعود.',
  },
  {
    id: 'productPromoCard',
    en: 'Product Promo Card (Pro+) — single product promo with hover tags + add-to-cart.',
    ar: 'كرت ترويج منتج (برو+) — منتج واحد مع شارات وزر إضافة للسلة.',
  },
];

function planBadgeLabel(plan: AppDoc['plan'], lang: Lang): string {
  if (lang === 'ar') {
    return { free: 'مجاني', starter: 'برو', pro: 'برو +', atelier: 'ماكس +' }[plan];
  }
  return { free: 'Free', starter: 'Pro', pro: 'Pro+', atelier: 'Max+' }[plan];
}

const legalPolicySlugs = ['terms', 'privacy'] as const satisfies readonly PolicySlug[];

function renderLegalPolicies(lang: Lang): ReactNode {
  const intro =
    lang === 'ar'
      ? 'نقلنا الشروط والخصوصية إلى الدليل حتى تبقى كل وثائق المنصة في مكان واحد. الروابط القديمة تتحول إلى هذا الدليل، والنص القانوني الكامل متاح هنا.'
      : 'Terms and Privacy now live inside the docs so the platform references stay in one place. The old links redirect here, and the full legal text remains available below.';

  return (
    <div className="docs-legal-wrap">
      <p>{intro}</p>
      <div className="docs-legal-grid">
        {legalPolicySlugs.map((slug) => {
          const policy = getPolicy(lang, slug);
          return (
            <details key={policy.slug} className="docs-legal-card" open={slug === 'terms'}>
              <summary>
                <span>
                  <strong>{policy.title}</strong>
                  <small>{policy.description}</small>
                </span>
                <em>{policy.lastUpdated}</em>
              </summary>
              <div className="docs-legal-body">
                {policy.intro.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {policy.sections.map((section) => (
                  <section key={section.title}>
                    <h4>{section.title}</h4>
                    {section.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                    {section.bullets?.length ? (
                      <ul>
                        {section.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                ))}
                <p className="docs-legal-contact">
                  {policy.contact.label}{' '}
                  <a href={`mailto:${policy.contact.email}`}>{policy.contact.email}</a>
                </p>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function localizedHref(locale: Lang, href: string): string {
  if (href.startsWith('#') || href.startsWith('mailto:')) return href;
  if (locale === 'en') return href;
  if (href === '/') return '/ar';
  return `/ar${href}`;
}

function getDocsNavItems(locale: Lang): Navigation2Item[] {
  const docsHref = localizedHref(locale, '/docs');
  const beginHref = localizedHref(locale, '/begin');
  const templatesHref = localizedHref(locale, '/templates');
  const accountHref = '/account';

  if (locale === 'ar') {
    return [
      {
        href: beginHref,
        label: 'المنتج',
        children: [
          { href: beginHref, label: 'ابدأ متجر', description: 'أنشئ متجراً جديداً من البداية.' },
          { href: templatesHref, label: 'القوالب', description: 'استعرض نقاط البداية الجاهزة.' },
          { href: '/begin/souqy', label: 'استوديو سوقي', description: 'ولّد صفحات بالذكاء.' },
        ],
      },
      {
        href: docsHref,
        label: 'الدليل',
        children: [
          { href: `${docsHref}#overview`, label: 'نظرة عامة', description: 'أساسيات سوقنا.' },
          {
            href: `${docsHref}#builder`,
            label: 'البنّاء',
            description: 'البلوكات والتحرير والنشر.',
          },
          { href: `${docsHref}#legal`, label: 'قانوني', description: 'الشروط والخصوصية.' },
          { href: `${docsHref}#support`, label: 'الدعم', description: 'المساعدة وقنوات التواصل.' },
        ],
      },
      { href: accountHref, label: 'الحساب' },
    ];
  }

  return [
    {
      href: beginHref,
      label: 'Product',
      children: [
        {
          href: beginHref,
          label: 'Start a store',
          description: 'Create a new storefront from scratch.',
        },
        { href: templatesHref, label: 'Templates', description: 'Browse ready starting points.' },
        { href: '/begin/souqy', label: 'Souqy Studio', description: 'Generate pages with AI.' },
      ],
    },
    {
      href: docsHref,
      label: 'Docs',
      children: [
        { href: `${docsHref}#overview`, label: 'Overview', description: 'The Souqna basics.' },
        {
          href: `${docsHref}#builder`,
          label: 'Builder',
          description: 'Blocks, editing, and publishing.',
        },
        { href: `${docsHref}#legal`, label: 'Legal', description: 'Terms and privacy.' },
        { href: `${docsHref}#support`, label: 'Support', description: 'Help and contact routes.' },
      ],
    },
    { href: accountHref, label: 'Account' },
  ];
}

function DocsTopNav({ locale }: { locale: Lang }) {
  const isRtl = locale === 'ar';
  const homeHref = localizedHref(locale, '/');
  const docsLangHref = isRtl ? '/docs#overview' : '/ar/docs#overview';
  const docsLangLabel = isRtl ? 'EN' : 'AR';

  return (
    <Navigation2
      className="sq-docs-nav fixed top-0 z-50"
      brandHref={homeHref}
      brandLabel="Souqna home"
      brand={<SouqnaLockup ariaLabel="" height={28} className="sq-docs-wordmark" />}
      items={getDocsNavItems(locale)}
      actions={
        <div className="sq-docs-nav-actions">
          <ThemeToggle compact />
          <Link
            href={docsLangHref}
            className="sq-docs-locale-toggle"
            aria-label={isRtl ? 'Switch to English' : 'Switch to Arabic'}
          >
            {docsLangLabel}
          </Link>
          <SignedOut>
            <Link href="/sign-up" className="sq-docs-nav-cta">
              {isRtl ? 'ابدأ' : 'Begin'}
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/account" className="sq-docs-nav-cta">
              {isRtl ? 'لوحة التحكم' : 'Dashboard'}
            </Link>
          </SignedIn>
        </div>
      }
    />
  );
}

const SECTIONS: Section[] = [
  {
    id: 'overview',
    title: { en: 'What is Souqna', ar: 'شنو هو سوقنا' },
    body: {
      en: (
        <>
          <p>
            Souqna is a bilingual storefront platform built in Doha for Qatari and GCC merchants.
            You sign up, pick a template, customize everything in a visual builder, point a domain,
            and go live — all in one afternoon, in Arabic and English from day one.
          </p>
          <p>
            Souqna is opinionated about three things: <strong>RTL is non-negotiable</strong>,{' '}
            <strong>your data is yours</strong>, and{' '}
            <strong>your storefront should look like you, not us</strong>. There are no hidden fees,
            no Souqna branding on your store, and every integration uses your own credentials.
          </p>
        </>
      ),
      ar: (
        <>
          <p>
            سوقنا منصّة متاجر ثنائية اللغة مبنية في الدوحة للتجّار في قطر والخليج. تسجّل، تختار
            قالب، تعدّل كل شي بالبنّاء البصري، تربط دومينك، وتنزل أونلاين — كل هذا في عصر واحد، عربي
            وإنجليزي من أول يوم.
          </p>
          <p>
            سوقنا متمسّكة بثلاث أشياء: <strong>دعم العربية واتجاه RTL مو خيار</strong>،{' '}
            <strong>بياناتك ملكك</strong>، و<strong>متجرك لازم يبيّن هويّتك مو هويّتنا</strong>. ما
            فيه رسوم خفيّة، ولا براندنق علينا في متجرك، وكل تكامل يستخدم بياناتك أنت.
          </p>
        </>
      ),
    },
  },
  {
    id: 'getting-started',
    title: { en: 'Getting started', ar: 'البداية' },
    body: {
      en: (
        <>
          <ol>
            <li>
              Click <strong>Begin</strong> in the nav and create an account. We use Clerk for
              sign-in, so you can use email, Google, or Apple.
            </li>
            <li>Verify your email — Clerk sends a code; paste it in.</li>
            <li>
              Land on your account dashboard at <code>/account</code>. Your first storefront is
              created automatically on a Souqna subdomain.
            </li>
            <li>Open the builder, swap the placeholder content, and publish.</li>
          </ol>
          <p>
            You don\u2019t need a credit card to start. The Free plan gets you 1 storefront,
            10 products, 1 template, 25 checkout orders per month, and Souqna branding.
          </p>
        </>
      ),
      ar: (
        <>
          <ol>
            <li>
              اضغط <strong>ابدأ</strong> من القائمة وسوّ حساب. نستخدم Clerk لتسجيل الدخول، تقدر تدخل
              بإيميل، Google، أو Apple.
            </li>
            <li>أكّد إيميلك — Clerk يرسل لك رمز، ألصقه.</li>
            <li>
              توصل لوحة حسابك على <code>/account</code>. أوّل متجر ينشأ تلقائياً على دومين فرعي من
              سوقنا.
            </li>
            <li>افتح البنّاء، بدّل المحتوى الافتراضي، وانشر.</li>
          </ol>
          <p>
            ما تحتاج بطاقة ائتمانية للبداية. الباقة المجانية تعطيك متجر واحد، ٣ قوالب، والبنّاء
            كامل.
          </p>
        </>
      ),
    },
  },
  {
    id: 'account',
    title: { en: 'Your account & settings', ar: 'حسابك والإعدادات' },
    body: {
      en: (
        <>
          <p>
            Everything personal lives under <code>/account</code>:
          </p>
          <ul>
            <li>
              <strong>Profile</strong> — name, photo, language preference, theme.
            </li>
            <li>
              <strong>Brand settings</strong> — your storefront logo, glyph, accent colour,
              typography pairing.
            </li>
            <li>
              <strong>Plan</strong> — see your tier, usage, billing cycle, and upgrade or downgrade
              at <code>/account/settings/plan</code>.
            </li>
            <li>
              <strong>Apps</strong> — install integrations and paste credentials per storefront.
            </li>
            <li>
              <strong>Audit</strong> — sensitive actions are recorded so you always know what
              happened.
            </li>
          </ul>
        </>
      ),
      ar: (
        <>
          <p>
            كل شي شخصي تحت <code>/account</code>:
          </p>
          <ul>
            <li>
              <strong>الملف الشخصي</strong> — اسمك، صورتك، اللغة، الثيم.
            </li>
            <li>
              <strong>إعدادات الهوية</strong> — شعار المتجر، الرمز، اللون المميّز، اقتران الخطوط.
            </li>
            <li>
              <strong>الباقة</strong> — تشوف باقتك، الاستخدام، دورة الفوترة، وتقدر ترقّى أو تنزّل من{' '}
              <code>/account/settings/plan</code>.
            </li>
            <li>
              <strong>التطبيقات</strong> — ثبّت التكاملات وألصق البيانات لكل متجر على حدة.
            </li>
            <li>
              <strong>السجلّ</strong> — الإجراءات الحسّاسة كلها مسجّلة عشان دائماً تعرف شنو صار.
            </li>
          </ul>
        </>
      ),
    },
  },
  {
    id: 'storefronts',
    title: { en: 'Storefronts & domains', ar: 'المتاجر والدومينات' },
    body: {
      en: (
        <>
          <p>
            Each storefront gets a free Souqna subdomain (e.g. <code>your-brand.souqna.qa</code>)
            the moment it\u2019s created. On any paid plan you can add your own custom domain —
            Souqna provisions it through Vercel and the SSL certificate is automatic.
          </p>
          <ul>
            <li>
              Add the domain in <code>Settings → Domain</code> and update the DNS records we show
              you.
            </li>
            <li>
              Both your subdomain and your custom domain serve the same storefront — search engines
              see one canonical URL.
            </li>
            <li>
              Every storefront supports Arabic and English with native RTL parity. The
              visitor\u2019s language is remembered.
            </li>
            <li>
              Light and dark themes are built in. You set the defaults; visitors can flip with one
              tap.
            </li>
          </ul>
        </>
      ),
      ar: (
        <>
          <p>
            كل متجر ياخذ دومين فرعي مجاني (مثلاً <code>your-brand.souqna.qa</code>) لحظة ما ينشأ.
            على أي باقة مدفوعة تقدر تضيف دومينك الخاص — سوقنا تجهّزه من خلال Vercel وشهادة SSL
            تتركّب تلقائياً.
          </p>
          <ul>
            <li>
              أضف الدومين من <code>الإعدادات ← الدومين</code> وحدّث سجلات DNS اللي نوريك إياها.
            </li>
            <li>
              الدومين الفرعي والدومين الخاص الاثنين يعرضون نفس المتجر — محركات البحث تشوف رابط واحد
              رسمي.
            </li>
            <li>كل متجر يدعم العربية والإنجليزية مع توازن كامل في اتجاه RTL. لغة الزائر تنحفظ.</li>
            <li>الثيم الفاتح والغامق جاهزين. أنت تحدّد الافتراضي؛ الزائر يقلب بضغطة.</li>
          </ul>
        </>
      ),
    },
  },
  {
    id: 'builder',
    title: { en: 'The visual builder', ar: 'البنّاء البصري' },
    body: {
      en: (
        <>
          <p>
            Open any page and you get a three-pane editor: a block library on the left, a live
            preview in the middle, and an inspector on the right. Drag a block in, adjust its props,
            see the change instantly. Publish when you\u2019re happy.
          </p>
          <p>Every block type Souqna supports today:</p>
          <ul>
            {BLOCKS.map((b) => (
              <li key={b.id}>
                <code>{b.id}</code> — {b.en}
              </li>
            ))}
          </ul>
          <p>
            Each block has a <em>Style</em> panel for spacing, alignment, colour scheme, and (on
            Pro+) premium variants like
            <code> pro-aurora</code>, <code>pro-magnetic</code>, and <code>pro-neon</code>. If you
            downgrade later, the renderer silently falls back to the classic look — your draft never
            breaks.
          </p>
        </>
      ),
      ar: (
        <>
          <p>
            افتح أي صفحة ويطلع لك محرّر بثلاث لوحات: مكتبة البلوكات يسار، معاينة مباشرة بالنص،
            وإعدادات تفصيلية يمين. اسحب بلوك، عدّل خصائصه، شوف التغيير لحظياً. وانشر لما تخلّص.
          </p>
          <p>كل أنواع البلوكات اللي تدعمها سوقنا حالياً:</p>
          <ul>
            {BLOCKS.map((b) => (
              <li key={b.id}>
                <code>{b.id}</code> — {b.ar}
              </li>
            ))}
          </ul>
          <p>
            كل بلوك له لوحة <em>تنسيق</em> للمسافات، المحاذاة، نظام الألوان، و(على برو+) أنماط
            مميّزة مثل
            <code> pro-aurora</code>، <code>pro-magnetic</code>، و<code>pro-neon</code>. لو نزّلت
            الباقة لاحقاً، العارض يرجع للنمط الكلاسيكي بدون ما يكسر شي — مسوّدتك تضل سليمة.
          </p>
        </>
      ),
    },
  },
  {
    id: 'souqy',
    title: {
      en: 'Souqy (Beta) — the AI page generator',
      ar: 'سوقي (تجريبي) — مولّد الصفحات بالذكاء الاصطناعي',
    },
    body: {
      en: (
        <>
          <p className="rounded-md border border-[color:var(--surface-rule)] bg-[color:var(--surface-elevated)] p-3 text-sm">
            <strong>Beta notice.</strong> Souqy is an AI feature that\u2019s still warming up. Treat
            its output as a fast first draft you\u2019ll polish in the builder.
          </p>
          <p>
            Souqy generates a complete page of Souqna blocks from a short prompt. Tell it what you
            want — "an editorial homepage for a perfume atelier in Arabic and English, gold accents,
            three featured products" — and Souqy returns a ready-to-edit block layout that you can
            then refine block by block.
          </p>
          <p>
            <strong>How to use it</strong>
          </p>
          <ol>
            <li>
              Open the builder and click <em>Generate with Souqy</em>.
            </li>
            <li>
              Describe your page in one or two sentences. Mention the language, the tone, and any
              products you want featured.
            </li>
            <li>Souqy drafts the page; you review, swap blocks, and publish.</li>
          </ol>
          <p>
            <strong>Prompting tips</strong>
          </p>
          <ul>
            <li>
              Be specific about audience and tone (e.g. "calm, editorial, Khaleeji audience").
            </li>
            <li>Name the section types you want (hero, gallery, featured product, contact).</li>
            <li>Mention bilingual upfront if you want both languages drafted at once.</li>
          </ul>
          <p>
            <strong>Current beta limitations</strong>
          </p>
          <ul>
            <li>
              Souqy is gated to <strong>Pro +</strong> and above.
            </li>
            <li>It drafts pages, not entire stores or product catalogs.</li>
            <li>Output may need editorial polish — always proofread, especially Arabic.</li>
            <li>
              It can\u2019t place premium variants you don\u2019t have access to on your plan.
            </li>
          </ul>
        </>
      ),
      ar: (
        <>
          <p className="rounded-md border border-[color:var(--surface-rule)] bg-[color:var(--surface-elevated)] p-3 text-sm">
            <strong>تنويه: تجريبي.</strong> سوقي ميزة ذكاء اصطناعي لسّا تتسخّن. اعتبر مخرجاتها
            مسوّدة أولى سريعة تشتغل عليها بعدها بالبنّاء.
          </p>
          <p>
            سوقي يولّد صفحة كاملة من بلوكات سوقنا انطلاقاً من وصف قصير. قلّه شنو تبي — "صفحة رئيسية
            أدبيّة لأتيليه عطور بالعربي والإنجليزي، لمسات ذهبية، وثلاث منتجات مميّزة" — وسوقي يرجع
            لك تخطيط بلوكات جاهز للتعديل تشتغل عليه بلوك بلوك.
          </p>
          <p>
            <strong>كيف تستخدمه</strong>
          </p>
          <ol>
            <li>
              افتح البنّاء واضغط <em>ولّد بسوقي</em>.
            </li>
            <li>اوصف الصفحة في جملة أو اثنتين. اذكر اللغة، النبرة، وأي منتجات تبيها مميّزة.</li>
            <li>سوقي يكتب المسوّدة؛ أنت تراجع، تبدّل بلوكات، وتنشر.</li>
          </ol>
          <p>
            <strong>نصائح في الوصف</strong>
          </p>
          <ul>
            <li>كن واضح عن الجمهور والنبرة (مثلاً "هادئ، أدبي، جمهور خليجي").</li>
            <li>اذكر أنواع الأقسام اللي تبيها (هيرو، معرض، منتج مميّز، تواصل).</li>
            <li>اذكر ثنائي اللغة من البداية لو تبي يكتب اللغتين مرة وحدة.</li>
          </ul>
          <p>
            <strong>حدود النسخة التجريبية</strong>
          </p>
          <ul>
            <li>
              سوقي متاح بدءاً من باقة <strong>برو +</strong> وفوق.
            </li>
            <li>يكتب صفحات، مو متاجر كاملة ولا كتالوجات منتجات.</li>
            <li>المخرجات تحتاج تنقيح تحريري دائماً — راجع النص، خاصة العربي.</li>
            <li>ما يقدر يحط أنماط مميّزة باقتك ما تدعمها.</li>
          </ul>
        </>
      ),
    },
  },
  {
    id: 'products',
    title: { en: 'Products & catalogue', ar: 'المنتجات والكتالوج' },
    body: {
      en: (
        <>
          <p>
            Manage your catalogue under <code>/account/products</code>. Each product carries a
            bilingual title, description, price, photos, and an optional category. Products power
            the <code>productGrid</code>, <code>productList</code>,<code>featuredProduct</code>, and{' '}
            <code>productPromoCard</code> blocks — pick a product in the inspector and the block
            reflects it on every storefront page that uses it.
          </p>
          <ul>
            <li>Photos are uploaded to Vercel Blob and served from the edge.</li>
            <li>
              Inventory and SKU fields are optional; use them when you want stock-aware behavior.
            </li>
            <li>Drafts and live products are separated — nothing goes public until you publish.</li>
          </ul>
        </>
      ),
      ar: (
        <>
          <p>
            دير كتالوجك من <code>/account/products</code>. كل منتج له عنوان ووصف ثنائيين، سعر، صور،
            وتصنيف اختياري. المنتجات تغذّي بلوكات <code>productGrid</code>، <code>productList</code>
            ، <code>featuredProduct</code>، و<code>productPromoCard</code> — اختر المنتج من
            الإعدادات والبلوك يعكسه في كل صفحة يستخدمه فيها.
          </p>
          <ul>
            <li>الصور ترفع على Vercel Blob وتقدّم من Edge.</li>
            <li>المخزون و SKU اختياريين؛ استخدمهم لو تبي سلوك يعتمد على المخزون.</li>
            <li>المسوّدات والمنتجات المنشورة منفصلين — ما يصير شي علني إلا لما تنشر.</li>
          </ul>
        </>
      ),
    },
  },
  {
    id: 'orders',
    title: { en: 'Orders, inquiries & checkout', ar: 'الطلبات، الاستفسارات، والدفع' },
    body: {
      en: (
        <>
          <p>
            Souqna supports two flows out of the box: <strong>Inquire</strong> (lead capture) and{' '}
            <strong>Order</strong> (cart + checkout). Founders selling bespoke or made-to-order
            pieces typically use Inquire; founders selling standard SKUs use Order. You can mix
            both.
          </p>
          <ul>
            <li>
              <strong>Inquiries</strong> — visitor fills out the Inquire dialog; the lead lands in
              your dashboard, your email, and any connected app (Notion, HubSpot, Sheets, Zapier).
            </li>
            <li>
              <strong>Orders</strong> — visitors add to cart, choose a shipping option (Aramex when
              connected), and pay through whichever payment app you\u2019ve enabled.
            </li>
            <li>Order status updates the customer automatically by email.</li>
          </ul>
        </>
      ),
      ar: (
        <>
          <p>
            سوقنا تدعم مسارَين جاهزين: <strong>استفسار</strong> (جمع leads) و<strong>طلب</strong>{' '}
            (سلة + دفع). المؤسسين اللي يبيعون قطع تفصيل أو طلبات خاصة عادة يستخدمون الاستفسار؛ اللي
            يبيعون منتجات جاهزة يستخدمون الطلب. تقدر تخلط الاثنين.
          </p>
          <ul>
            <li>
              <strong>الاستفسارات</strong> — الزائر يعبّي نموذج الاستفسار؛ يوصل لوحتك، إيميلك، وأي
              تطبيق مربوط (نوشن، HubSpot، Sheets، Zapier).
            </li>
            <li>
              <strong>الطلبات</strong> — الزائر يضيف للسلة، يختار شحن (Aramex لو مربوط)، ويدفع من
              بوابة الدفع اللي مفعّلها.
            </li>
            <li>تحديث حالة الطلب يوصل الزبون بالإيميل تلقائياً.</li>
          </ul>
        </>
      ),
    },
  },
  {
    id: 'apps',
    title: { en: 'Apps & integrations', ar: 'التطبيقات والتكاملات' },
    body: {
      en: (
        <>
          <p>
            Souqna ships with a marketplace of integrations under <code>/account/apps</code>. Each
            app is per-storefront — install it once, paste credentials, and it stays scoped to that
            store. Below is everything that ships in v1.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {APPS.map((app) => (
              <div
                key={app.id}
                className="rounded-md border border-[color:var(--surface-rule)] p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="m-0 text-base font-semibold">{app.name.en}</h4>
                  <span className="text-[10px] uppercase tracking-wider text-[color:var(--ink-muted)]">
                    {planBadgeLabel(app.plan, 'en')}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[color:var(--ink-muted)]">{app.what.en}</p>
                <p className="mt-2 text-xs text-[color:var(--ink-faint)]">
                  <strong>Needs:</strong> {app.needs.en}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-[color:var(--ink-muted)]">
            More OAuth integrations are queued (Mailchimp, Klaviyo, WhatsApp Business, Instagram
            Shop, and Tap Payments). They appear in the marketplace as <em>coming soon</em> until
            they ship.
          </p>
        </>
      ),
      ar: (
        <>
          <p>
            سوقنا فيها سوق تكاملات تحت <code>/account/apps</code>. كل تطبيق لكل متجر بشكل منفصل —
            ثبّته مرة، ألصق البيانات، ويضل محدود على ذاك المتجر. تحت كل اللي ينزل في النسخة الأولى.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {APPS.map((app) => (
              <div
                key={app.id}
                className="rounded-md border border-[color:var(--surface-rule)] p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="m-0 text-base font-semibold">{app.name.ar}</h4>
                  <span className="text-[10px] uppercase tracking-wider text-[color:var(--ink-muted)]">
                    {planBadgeLabel(app.plan, 'ar')}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[color:var(--ink-muted)]">{app.what.ar}</p>
                <p className="mt-2 text-xs text-[color:var(--ink-faint)]">
                  <strong>يحتاج:</strong> {app.needs.ar}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-[color:var(--ink-muted)]">
            تكاملات OAuth إضافية بالطابور (Mailchimp، Klaviyo، WhatsApp Business، Instagram Shop، و
            Tap Payments). تظهر في السوق بعلامة <em>قريباً</em> لين تنزل.
          </p>
        </>
      ),
    },
  },
  {
    id: 'plans',
    title: { en: 'Plans & pricing', ar: 'الباقات والأسعار' },
    body: {
      en: (
        <>
          <p>
            Souqna has four tiers. Annual billing saves about 35%. You upgrade or downgrade at any
            time from
            <code> /account/settings/plan</code>. Downgrades never delete content — premium block
            variants quietly fall back to their classic equivalents.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[color:var(--surface-rule)] text-left">
                  <th className="py-2 pe-3">Plan</th>
                  <th className="py-2 pe-3">Price</th>
                  <th className="py-2 pe-3">Storefronts</th>
                  <th className="py-2">Includes</th>
                </tr>
              </thead>
              <tbody>
                {PLANS_TABLE.map((p) => (
                  <tr key={p.id} className="border-b border-[color:var(--surface-rule)] align-top">
                    <td className="py-3 pe-3 font-semibold">{p.en.name}</td>
                    <td className="py-3 pe-3">{p.en.price}</td>
                    <td className="py-3 pe-3">{p.en.stores}</td>
                    <td className="py-3">
                      {p.en.tpl}
                      <div className="text-xs text-[color:var(--ink-muted)] mt-1">{p.en_tag}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-[color:var(--ink-muted)]">
            Souqy AI generation is gated to <strong>Pro +</strong> and above. Premium block variants
            and animated text/image blocks unlock at <strong>Pro +</strong>. The bleeding-edge
            templates (Noctis, Bazaar) ship with <strong>Max +</strong>.
          </p>
        </>
      ),
      ar: (
        <>
          <p>
            سوقنا فيها أربع باقات. الفوترة السنوية توفّر تقريباً ٣٥٪. تقدر ترقّى أو تنزّل في أي وقت
            من
            <code> /account/settings/plan</code>. التنزيل ما يحذف محتوى — الأنماط المميّزة ترجع
            لشكلها الكلاسيكي بهدوء.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[color:var(--surface-rule)] text-start">
                  <th className="py-2 pe-3">الباقة</th>
                  <th className="py-2 pe-3">السعر</th>
                  <th className="py-2 pe-3">المتاجر</th>
                  <th className="py-2">المحتوى</th>
                </tr>
              </thead>
              <tbody>
                {PLANS_TABLE.map((p) => (
                  <tr key={p.id} className="border-b border-[color:var(--surface-rule)] align-top">
                    <td className="py-3 pe-3 font-semibold">{p.ar.name}</td>
                    <td className="py-3 pe-3">{p.ar.price}</td>
                    <td className="py-3 pe-3">{p.ar.stores}</td>
                    <td className="py-3">
                      {p.ar.tpl}
                      <div className="text-xs text-[color:var(--ink-muted)] mt-1">{p.ar_tag}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-[color:var(--ink-muted)]">
            توليد سوقي بالذكاء الاصطناعي يبدأ من باقة <strong>برو +</strong> وفوق. الأنماط المميّزة
            وبلوكات النص والصورة المتحركة تفتح من <strong>برو +</strong>. القوالب الجريئة (Noctis،
            Bazaar) تجي مع <strong>ماكس +</strong>.
          </p>
        </>
      ),
    },
  },
  {
    id: 'analytics',
    title: { en: 'Analytics', ar: 'التحليلات' },
    body: {
      en: (
        <>
          <p>
            Out of the box, Souqna tracks page views, product views, inquiries, and orders, and
            surfaces them in your dashboard at
            <code> /account/analytics</code>. We use PostHog server-side and Vercel Analytics for
            web vitals — neither sees PII.
          </p>
          <p>
            For deeper analytics, install <strong>TikTok Pixel</strong>,{' '}
            <strong>Google Sheets export</strong>, the <strong>SEO Assistant</strong>, or the
            upcoming GA4 / Meta Pixel apps.
          </p>
        </>
      ),
      ar: (
        <>
          <p>
            من الصندوق، سوقنا تتبّع المشاهدات، تصفّح المنتجات، الاستفسارات، والطلبات، وتعرضها في
            لوحتك على
            <code> /account/analytics</code>. نستخدم PostHog من السيرفر و Vercel Analytics لمؤشرات
            الويب — والاثنين ما يشوفون بيانات شخصية.
          </p>
          <p>
            للتحليلات الأعمق، ثبّت <strong>بكسل تيك توك</strong>،{' '}
            <strong>تصدير Google Sheets</strong>، <strong>مساعد السيو</strong>، أو تطبيقات GA4 /
            Meta Pixel القادمة.
          </p>
        </>
      ),
    },
  },
  {
    id: 'email',
    title: { en: 'Notifications & email', ar: 'الإشعارات والإيميل' },
    body: {
      en: (
        <>
          <p>
            Transactional emails (sign-up confirmation, inquiry receipt, order updates) are sent via
            Postmark with Resend as a fallback. They\u2019re designed in your storefront\u2019s
            typography and signed off as your brand, not Souqna.
          </p>
          <p>You can disable individual notifications from your account settings.</p>
        </>
      ),
      ar: (
        <>
          <p>
            الإيميلات التشغيلية (تأكيد الحساب، إيصال الاستفسار، تحديثات الطلب) ترسل عبر Postmark و
            Resend كاحتياطي. مصمّمة بخطوط متجرك وموقّعة باسم علامتك، مو سوقنا.
          </p>
          <p>تقدر توقّف أي إشعار على حدة من إعدادات حسابك.</p>
        </>
      ),
    },
  },
  {
    id: 'security',
    title: { en: 'Security & data', ar: 'الأمان والبيانات' },
    body: {
      en: (
        <>
          <ul>
            <li>
              <strong>Authentication</strong> — Clerk handles sign-in, sessions, and email
              verification. Passwords never touch our servers.
            </li>
            <li>
              <strong>Database</strong> — Neon Postgres with encrypted connections. Credentials for
              integrations are stored encrypted at rest.
            </li>
            <li>
              <strong>Files</strong> — Vercel Blob storage, served from the edge.
            </li>
            <li>
              <strong>Audit log</strong> — every sensitive action (plan changes, app installs,
              credential updates) is recorded with who, when, and what.
            </li>
            <li>
              <strong>No PII in logs</strong> — error reporting is scrubbed and we never log
              customer payment data.
            </li>
          </ul>
        </>
      ),
      ar: (
        <>
          <ul>
            <li>
              <strong>المصادقة</strong> — Clerk يدير تسجيل الدخول، الجلسات، وتأكيد الإيميل. كلمات
              المرور ما تمرّ على سيرفراتنا أبداً.
            </li>
            <li>
              <strong>قاعدة البيانات</strong> — Neon Postgres باتصالات مشفّرة. بيانات التكاملات
              تتخزّن مشفّرة.
            </li>
            <li>
              <strong>الملفات</strong> — تخزين Vercel Blob، تتقدّم من Edge.
            </li>
            <li>
              <strong>سجلّ التدقيق</strong> — كل إجراء حسّاس (تغيير الباقة، تثبيت تطبيق، تحديث
              بيانات) مسجّل بمن، متى، وشنو.
            </li>
            <li>
              <strong>ما فيه بيانات شخصية في السجلات</strong> — التقارير الخطأ منقّاة، وبيانات الدفع
              للزبون ما نسجّلها أبداً.
            </li>
          </ul>
        </>
      ),
    },
  },
  {
    id: 'legal',
    title: { en: 'Legal', ar: 'قانوني' },
    body: {
      en: renderLegalPolicies('en'),
      ar: renderLegalPolicies('ar'),
    },
  },
  {
    id: 'languages',
    title: { en: 'Languages & RTL', ar: 'اللغات و RTL' },
    body: {
      en: (
        <>
          <p>
            Souqna is bilingual at the spine, not as an afterthought. Every page, every block, every
            email exists in Arabic and English. The visitor\u2019s language is detected from the URL
            prefix (<code>/ar</code> for Arabic, no prefix for English) and remembered.
          </p>
          <p>
            RTL parity is enforced — we use logical CSS properties (<code>margin-inline-start</code>
            , not <code>margin-left</code>), so anything that looks right in English looks right in
            Arabic, automatically. Arabic typography now uses Thmanyah Sans for UI and Thmanyah
            Serif Display for headings.
          </p>
        </>
      ),
      ar: (
        <>
          <p>
            سوقنا ثنائية اللغة من العمود الفقري، مو بعدين. كل صفحة، كل بلوك، وكل إيميل موجود بالعربي
            والإنجليزي. لغة الزائر تتعرّف من بادئة الرابط (<code>/ar</code> للعربي، بدون بادئة
            للإنجليزي) وتنحفظ.
          </p>
          <p>
            توازن RTL مفروض — نستخدم خصائص CSS منطقية (<code>margin-inline-start</code> بدل{' '}
            <code>margin-left</code>)، عشان أي شي يطلع تمام بالإنجليزي يطلع تمام بالعربي تلقائياً.
            الطباعة العربية تستخدم نوتو كوفي + أميري.
          </p>
        </>
      ),
    },
  },
  {
    id: 'support',
    title: { en: 'Support & help', ar: 'الدعم والمساعدة' },
    body: {
      en: (
        <>
          <p>
            Email <a href="mailto:support@souqna.qa">support@souqna.qa</a> — we reply in Arabic or
            English, whichever you wrote in. Max + plans get white-glove support with a dedicated
            WhatsApp line.
          </p>
          <p>
            For feature ideas and roadmap, write to{' '}
            <a href="mailto:hello@souqna.qa">hello@souqna.qa</a>.
          </p>
        </>
      ),
      ar: (
        <>
          <p>
            راسلنا على <a href="mailto:support@souqna.qa">support@souqna.qa</a> — نرد بالعربي أو
            الإنجليزي حسب ما كتبت. باقة ماكس + تجي معها دعم بالقفازات البيضاء وخط واتساب مخصّص.
          </p>
          <p>
            للأفكار وخارطة الطريق، اكتب لنا على <a href="mailto:hello@souqna.qa">hello@souqna.qa</a>
            .
          </p>
        </>
      ),
    },
  },
];

export function DocsContent({ initialLang }: { initialLang: Lang }) {
  const lang = initialLang;
  const [active, setActive] = useState<string>(SECTIONS[0]!.id);
  const isRtl = lang === 'ar';

  const ids = useMemo(() => SECTIONS.map((s) => s.id), []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids]);

  const tocLabel = isRtl ? 'في هذا الدليل' : 'In this guide';
  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={lang}
      className="sq-docs"
      style={{
        fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
        color: 'var(--ink-strong)',
      }}
    >
      <DocsTopNav locale={lang} />
      <div className="docs-shell px-6 pb-24 pt-36 md:px-12 md:pt-44">
        <div className="mx-auto" style={{ maxWidth: 'var(--max-w-editorial)' }}>
          <header className="mb-12 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 md:max-w-[760px]">
              <div
                className="font-mono text-[11px] uppercase tracking-[0.18em]"
                style={{ color: 'var(--color-maroon)' }}
              >
                {isRtl ? 'الدليل' : 'Documentation'}
              </div>
              <h1
                className="mt-3 m-0 text-balance"
                style={{
                  fontFamily: isRtl ? 'var(--font-arabic-serif)' : 'var(--font-serif)',
                  fontWeight: isRtl ? 700 : 300,
                  fontSize: 'clamp(44px, 6vw, 92px)',
                  lineHeight: isRtl ? 1.08 : 0.94,
                  letterSpacing: 0,
                }}
              >
                {isRtl ? 'كل ما تحتاج معرفته عن سوقنا' : 'Everything you need to know about Souqna'}
              </h1>
              <p
                className="mt-5 max-w-[60ch] text-[color:var(--ink-muted)]"
                style={{ fontSize: 17, lineHeight: 1.65 }}
              >
                {isRtl
                  ? 'دليل شامل للتجّار: من تسجيل الحساب لين الإطلاق، البنّاء البصري، التطبيقات، الباقات، وكل التفاصيل اللي تحتاجها.'
                  : 'A complete guide for merchants: from sign-up to launch, the visual builder, integrations, plans, and every detail in between.'}
              </p>
            </div>
          </header>

          <div className="grid gap-12 md:grid-cols-[220px_1fr]">
            <aside className="docs-toc md:sticky md:top-28 md:self-start">
              <div
                className="font-mono text-[10px] uppercase tracking-[0.18em] mb-3"
                style={{ color: 'var(--ink-muted)' }}
              >
                {tocLabel}
              </div>
              <nav>
                <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
                  {SECTIONS.map((s) => {
                    const isActive = active === s.id;
                    return (
                      <li key={s.id}>
                        <a
                          href={`#${s.id}`}
                          className="block py-1 text-sm no-underline transition-colors"
                          style={{
                            color: isActive ? 'var(--color-maroon)' : 'var(--ink-strong)',
                            borderInlineStart: '2px solid',
                            borderInlineStartColor: isActive ? 'var(--color-gold)' : 'transparent',
                            paddingInlineStart: 10,
                          }}
                        >
                          {(lang === 'ar' ? s.title.ar : s.title.en) as ReactNode}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </aside>

            <article className="docs-article min-w-0">
              {SECTIONS.map((s) => (
                <section
                  key={s.id}
                  id={s.id}
                  className="docs-section scroll-mt-28 border-t border-[color:var(--surface-rule)] pt-10 first:border-t-0 first:pt-0 mb-14"
                >
                  <h2
                    className="m-0 mb-5"
                    style={{
                      fontFamily: isRtl ? 'var(--font-arabic-serif)' : 'var(--font-serif)',
                      fontWeight: isRtl ? 700 : 400,
                      fontSize: 'clamp(28px, 3.5vw, 48px)',
                      letterSpacing: 0,
                      lineHeight: isRtl ? 1.14 : 1.05,
                    }}
                  >
                    {(lang === 'ar' ? s.title.ar : s.title.en) as ReactNode}
                  </h2>
                  <div className="docs-prose">{lang === 'ar' ? s.body.ar : s.body.en}</div>
                </section>
              ))}
            </article>
          </div>
        </div>
      </div>

      <style jsx global>{`
        body:has(.sq-docs) [data-public-chrome='navigation'] {
          display: none !important;
        }
        .sq-docs {
          --sq-docs-bg: var(--sq-bg, var(--surface-bg));
          --sq-docs-ink: var(--sq-ink, var(--ink-strong));
          --sq-docs-muted: var(--sq-muted, var(--ink-muted));
          --sq-docs-rule: var(--sq-rule, var(--surface-rule));
          --sq-docs-glass: color-mix(in srgb, var(--surface-bg) 72%, transparent);
          min-height: 100dvh;
          background:
            radial-gradient(
              circle at 12% 8%,
              color-mix(in srgb, var(--accent) 16%, transparent),
              transparent 28%
            ),
            radial-gradient(
              circle at 88% 4%,
              color-mix(in srgb, var(--color-maroon) 12%, transparent),
              transparent 30%
            ),
            var(--surface-bg);
          color: var(--ink-strong);
        }
        .sq-docs-nav {
          left: 0;
          right: 0;
          padding: 13px clamp(18px, 4vw, 52px);
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--surface-bg) 72%, transparent),
            transparent
          );
          pointer-events: none;
        }
        .sq-docs-nav .rb-nav-shell,
        .sq-docs-nav .rb-nav-dropdown,
        .sq-docs-nav a,
        .sq-docs-nav button {
          pointer-events: auto;
        }
        .sq-docs-nav .rb-nav-shell {
          background: var(--sq-docs-glass) !important;
          border-color: color-mix(in srgb, var(--ink-strong) 13%, transparent) !important;
          box-shadow:
            0 1px 0 color-mix(in srgb, var(--ink-strong) 5%, transparent) inset,
            0 18px 60px color-mix(in srgb, var(--ink-strong) 10%, transparent) !important;
        }
        html[data-theme='dark'] .sq-docs {
          --sq-docs-glass: color-mix(in srgb, var(--surface-bg) 62%, transparent);
        }
        html[data-theme='dark'] .sq-docs-nav .rb-nav-shell {
          box-shadow:
            0 1px 0 color-mix(in srgb, var(--ink-strong) 8%, transparent) inset,
            0 18px 70px rgba(0, 0, 0, 0.5) !important;
        }
        .sq-docs-nav .rb-nav-link {
          color: var(--ink-muted) !important;
        }
        .sq-docs-nav .rb-nav-link:hover,
        .sq-docs-nav .rb-nav-shell > a {
          color: var(--ink-strong) !important;
        }
        .sq-docs-nav .rb-nav-dropdown {
          background: var(--sq-docs-glass) !important;
          border-color: color-mix(in srgb, var(--ink-strong) 13%, transparent) !important;
          box-shadow: 0 24px 70px color-mix(in srgb, var(--ink-strong) 18%, transparent) !important;
        }
        .sq-docs-nav .rb-nav-dropdown a {
          color: var(--ink-strong) !important;
        }
        .sq-docs-nav .rb-nav-dropdown a:hover,
        .sq-docs-nav .lg\\:hidden a[href]:hover {
          background: color-mix(in srgb, var(--ink-strong) 6%, transparent) !important;
        }
        .sq-docs-nav .rb-nav-dropdown a > span:last-child:not(:first-child),
        .sq-docs-nav .lg\\:hidden a[href] span:last-child {
          color: var(--ink-muted) !important;
        }
        .sq-docs-nav .lg\\:hidden a[href] {
          background: color-mix(in srgb, var(--surface-elevated) 42%, transparent) !important;
          border-color: color-mix(in srgb, var(--ink-strong) 13%, transparent) !important;
          color: var(--ink-strong) !important;
        }
        .sq-docs-nav .lg\\:hidden button[aria-expanded] {
          background: var(--ink-strong) !important;
          color: var(--surface-bg) !important;
        }
        .sq-docs-wordmark {
          color: var(--ink-strong);
        }
        .sq-docs-nav-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
        }
        .sq-docs-locale-toggle,
        .sq-docs-nav-cta {
          display: inline-flex;
          min-height: 34px;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
          border-radius: 999px;
          text-decoration: none;
        }
        .sq-docs-locale-toggle {
          border: 1px solid color-mix(in srgb, var(--ink-strong) 16%, transparent);
          background: color-mix(in srgb, var(--surface-bg) 50%, transparent);
          padding: 7px 12px;
          color: var(--ink-strong);
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0;
        }
        .sq-docs-nav-cta {
          background: var(--ink-strong);
          padding: 8px 14px;
          color: var(--surface-bg) !important;
          font-size: 13px;
          font-weight: 700;
          line-height: 1;
        }
        .sq-docs[dir='rtl'] .sq-docs-nav :where(a, button, span) {
          font-family: var(--font-arabic);
          font-weight: 700;
        }
        .docs-shell {
          --docs-grid: color-mix(in srgb, var(--ink-strong) 9%, transparent);
          min-height: 100dvh;
          background:
            linear-gradient(var(--docs-grid) 1px, transparent 1px),
            linear-gradient(90deg, var(--docs-grid) 1px, transparent 1px), transparent;
          background-size: 44px 44px;
        }
        .docs-toc {
          background: color-mix(in srgb, var(--surface-bg) 82%, transparent);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }
        .docs-toc {
          border: 1px solid var(--surface-rule);
          border-radius: 8px;
          padding: 18px;
        }
        .docs-section {
          padding-top: clamp(32px, 5vw, 56px);
        }
        .sq-docs .docs-prose p {
          font-size: 16px;
          line-height: ${isRtl ? '1.85' : '1.7'};
          color: var(--ink-strong);
          margin: 0 0 1em;
        }
        .sq-docs .docs-prose ul,
        .sq-docs .docs-prose ol {
          margin: 0 0 1.2em;
          padding-inline-start: 1.4em;
          line-height: ${isRtl ? '1.85' : '1.7'};
          font-size: 16px;
        }
        .sq-docs .docs-prose li {
          margin-bottom: 0.45em;
        }
        .sq-docs .docs-prose code {
          font-family: var(--font-mono);
          font-size: 0.86em;
          background: color-mix(in srgb, var(--surface-elevated) 88%, transparent);
          border: 1px solid var(--surface-rule);
          border-radius: 4px;
          padding: 0.1em 0.4em;
        }
        .sq-docs .docs-prose strong {
          color: var(--ink-strong);
          font-weight: 600;
        }
        .sq-docs .docs-prose a {
          color: var(--color-maroon);
          text-decoration-color: var(--color-gold);
          text-underline-offset: 3px;
        }
        .sq-docs .docs-prose table {
          margin: 0.5em 0 1em;
          border-collapse: separate;
          border-spacing: 0;
          overflow: hidden;
          border: 1px solid var(--surface-rule);
          border-radius: 8px;
        }
        .sq-docs .docs-prose th {
          font-weight: 600;
          color: var(--ink-strong);
          background: color-mix(in srgb, var(--surface-elevated) 72%, transparent);
        }
        .sq-docs .docs-prose td,
        .sq-docs .docs-prose th {
          border-bottom: 1px solid var(--surface-rule);
          padding: 0.85rem;
        }
        .sq-docs .docs-prose h4 {
          font-family: ${isRtl ? 'var(--font-arabic-serif)' : 'var(--font-serif)'};
          font-weight: 600;
        }
        .docs-legal-wrap {
          display: grid;
          gap: 18px;
        }
        .docs-legal-grid {
          display: grid;
          gap: 16px;
        }
        .docs-legal-card {
          overflow: hidden;
          border: 1px solid var(--surface-rule);
          border-radius: 8px;
          background: color-mix(in srgb, var(--surface-elevated) 80%, transparent);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }
        .docs-legal-card summary {
          display: flex;
          cursor: pointer;
          list-style: none;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          padding: 18px;
        }
        .docs-legal-card summary::-webkit-details-marker {
          display: none;
        }
        .docs-legal-card summary strong {
          display: block;
          font-size: 18px;
        }
        .docs-legal-card summary small,
        .docs-legal-card summary em {
          display: block;
          color: var(--ink-muted);
          font-size: 12px;
          font-style: normal;
          line-height: 1.5;
        }
        .docs-legal-body {
          border-top: 1px solid var(--surface-rule);
          padding: 18px;
        }
        .docs-legal-body section {
          margin-top: 22px;
        }
        .docs-legal-body h4 {
          margin: 0 0 10px;
          font-size: 18px;
        }
        .docs-legal-contact {
          margin-top: 22px !important;
          border-top: 1px dashed var(--surface-rule);
          padding-top: 16px;
        }
      `}</style>
    </div>
  );
}
