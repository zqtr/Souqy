'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import {
  siApplepay,
  siClerk,
  siCloudflare,
  siGooglesheets,
  siInstagram,
  siMailchimp,
  siMeta,
  siVercel,
  siWhatsapp,
  siZapier,
} from 'simple-icons';
import type { SimpleIcon } from 'simple-icons';
import Footer8 from '@/components/footer-8';
import HalftoneWave from '@/components/halftone-wave';
import { Navigation2 } from '@/components/navigation-2';
import { MetalFrame } from '@/components/primitives/MetalFrame';
import { Pricing5 } from '@/components/pricing-5';
import RotatingText from '@/components/react-bits/RotatingText';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import type { Locale } from '@/i18n/locales';
import { LocaleToggle } from './LocaleToggle';

type Props = {
  locale: Locale;
};

type OnboardingVideo = {
  key: string;
  label: string;
  caption: string;
  src: string | null;
  srcKind?: 'image' | 'video';
  zoom?: number;
  fields: readonly string[];
};

type IntegrationLogo = {
  icon?: SimpleIcon;
  key: string;
  label: string;
  more?: boolean;
  path?: string;
  viewBox?: string;
};

const skipCashIconPath =
  'M58,65.1L40.5,82.5c0-0.1,0-0.2,0.1-0.3c0.1-0.5,0.2-0.9,0.2-1.4c0-0.2,0-0.4,0.1-0.6c0-0.4,0.1-0.7,0.1-1 c0-0.2,0-0.4,0-0.5c0-0.3,0-0.7,0-1c0-0.1,0-0.3,0-0.4c0-0.4,0-0.8,0-1.1c-0.3-5.1-2.6-10-6.3-13.9c0-0.1-0.1-0.1-0.2-0.2l0,0 l-1.2-1.2l1.4-1.4c3.8-3.9,6.1-8.8,6.6-14c0.1-0.6,0.1-1.2,0.1-1.9c0-0.2,0-0.3,0-0.5c0-0.5,0-1-0.1-1.5c0-0.1,0-0.2,0-0.3 c-0.1-0.5-0.1-1-0.2-1.5l17,17C60.3,59,60.3,62.8,58,65.1 M33.5,86.2H10.7c-0.7,0-1-0.5-1-0.7c-0.1-0.2-0.2-0.7,0.2-1.2L31.2,63 l1.3,1.3c0,0,0,0,0,0c3.3,3.3,5.2,7.6,5.5,12.1c0,0.2,0,0.5,0,0.8c0,0.1,0,0.3,0,0.4c0,0.2,0,0.4,0,0.6c0,0.2,0,0.5,0,0.8 c0,0.1,0,0.2,0,0.3c0,0.4-0.1,0.7-0.1,1.1c0,0,0,0,0,0c-0.2,1.2-0.5,2.5-1,3.9c0,0,0,0,0,0.1c-0.1,0.4-0.3,0.7-0.5,1.1 c0,0.1-0.1,0.2-0.1,0.3C35.4,86,34.4,86.2,33.5,86.2 M4.7,32.4c-2.3-2.3-2.3-6,0-8.3L22.1,6.6c0,0.1,0,0.2-0.1,0.3 c-0.1,0.5-0.2,0.9-0.2,1.4c0,0.2,0,0.4-0.1,0.6c0,0.4-0.1,0.7-0.1,1c0,0.2,0,0.4,0,0.5c0,0.3,0,0.7,0,1c0,0.1,0,0.3,0,0.4 c0,0.4,0,0.8,0,1.1c0.3,5.1,2.6,10,6.3,13.9c0,0,0,0,0.1,0.1l1.3,1.3L28,29.6c-3.8,3.9-6.2,8.9-6.6,14c-0.1,0.6-0.1,1.2-0.1,1.8 c0,0.2,0,0.3,0,0.5c0,0.5,0,1,0.1,1.5c0,0.1,0,0.2,0,0.4c0.1,0.5,0.1,1,0.3,1.5L4.7,32.4z M29.2,2.9h22.7c0.7,0,1,0.5,1,0.7 c0.1,0.2,0.2,0.7-0.2,1.2L31.4,26.1l-1.3-1.3c0,0,0,0,0,0c-3.3-3.3-5.2-7.6-5.5-12.1c0-0.2,0-0.5,0-0.8c0,0,0-0.1,0-0.1 c0-0.3,0-0.5,0-0.8c0,0,0-0.1,0-0.1c0-1.4,0.2-3.1,0.8-4.9c0,0,0,0,0,0c0.1-0.4,0.3-0.9,0.5-1.3C25.9,4.4,26,4.3,26,4.2 c0.1-0.2,0.2-0.5,0.3-0.7C27.3,3.1,28.2,2.9,29.2,2.9 M33.8,56.1c-0.4,0.4-0.7,0.8-1.1,1.3l-1.4,1.4l-2.7-2.7 c-3.1-3.2-4.6-7.6-4.2-12.2c0.1-1.1,0.3-2.2,0.6-3.3c0.3-0.9,0.6-1.9,1-2.8c0.1-0.1,0.1-0.3,0.2-0.4c1-2.1,2.3-4,4-5.7l1.3-1.3 l2.6,2.6c3.2,3.2,4.7,7.6,4.3,12.3C38,49.1,36.4,52.9,33.8,56.1 M40.6,35.3l-4.5-4.5c0,0,0,0,0,0l-2.5-2.5L54.8,6.9 c1.2-1.2,1.5-2.9,0.9-4.4C55,1,53.6,0,51.9,0H29.2c-1.5,0-3,0.3-4.5,0.9c0,0-0.1,0-0.1,0.1c0,0-0.1,0-0.1,0l-1.8,1 c0,0-0.1,0.1-0.1,0.1c-0.1,0.1-0.3,0.2-0.4,0.3l-0.3,0.2c-0.2,0.2-0.5,0.4-0.7,0.6L2.6,22c-3.4,3.4-3.4,9,0,12.5l19.5,19.4 c0,0,0,0,0,0l4.5,4.5c0,0,0,0,0,0l2.5,2.5L7.9,82.2c-1.2,1.2-1.5,2.9-0.9,4.4c0.6,1.5,2.1,2.5,3.8,2.5h22.7c1.5,0,3-0.3,4.5-0.9 c0,0,0,0,0.1,0c0,0,0.1,0,0.1,0l1.8-1c0.1,0,0.1-0.1,0.2-0.1c0.1-0.1,0.2-0.2,0.5-0.4l0.2-0.1c0.2-0.2,0.5-0.4,0.7-0.6l18.7-18.7 c3.4-3.4,3.4-9,0-12.5L40.6,35.3z';

const home = {
  en: {
    nav: [
      ['work', 'Workplace'],
      ['process', 'How it works'],
      ['atelier', 'AI studio'],
      ['contact', 'Pricing'],
    ],
    badge: 'Made In Doha For GCC',
    heroA: 'A workplace for',
    heroB: 'home businesses',
    heroC: '',
    echo: 'مكان عمل لمشاريع البيت',
    body:
      'Open a store, write the pages, take the orders, and talk to the customer in Arabic and English on one calm cream surface. Souqna sets up the storefront, the back of house, and the AI on the line. You stay yourself.',
    primary: 'Start your store',
    secondary: 'See it work · شاهد كيف يعمل',
    manifesto: 'Open account',
    marquee: ['Workplace', 'مكان عمل', 'Storefront', 'واجهة', 'Orders', 'طلبات', 'AI studio', 'استوديو الذكاء', 'Arabic + English', 'عربي وإنجليزي'],
    workEyebrow: 'Onboarding · ابدأ من هنا',
    workTitle: 'Three small questions, then your workplace opens.',
    workAr: 'ثلاثة أسئلة قصيرة ثم يفتح مكان عملك.',
    processEyebrow: 'How Souqna works',
    processTitle: 'From a name to the first sale, without splitting your work across tools.',
    atelierEyebrow: 'AI studio',
    atelierTitle: 'The storefront, back office, and AI assistant stay on one surface.',
    atelierBody:
      'Drop one image and one sentence. Souqna drafts product pages, alt text, bilingual captions, customer replies, and launch tasks in your voice.',
    journalEyebrow: 'How-to',
    journalTitle: 'Quiet, but useful. The real numbers appear as founders open stores.',
    contactEyebrow: 'Begin',
    contactTitle: 'Open your store today.',
    contactBody: 'No credit card to start. Bilingual from day one. Pause any time.',
    contactCta: 'Start',
  },
  ar: {
    nav: [
      ['work', 'مكان العمل'],
      ['process', 'كيف يعمل'],
      ['atelier', 'استوديو الذكاء'],
      ['contact', 'الأسعار'],
    ],
    badge: 'صنع في الدوحة للخليج',
    heroA: 'مكان عمل',
    heroB: 'لمشاريع البيت',
    heroC: '',
    echo: 'A workplace for home businesses',
    body:
      'افتح متجراً، اكتب الصفحات، استقبل الطلبات، وتحدث مع العميل بالعربية والإنجليزية على سطح هادئ واحد. سوقنا يجهز الواجهة والتشغيل والذكاء على الخط، وأنت تبقى بنفسك.',
    primary: 'ابدأ متجرك',
    secondary: 'شاهد كيف يعمل',
    manifesto: 'افتح الحساب',
    marquee: ['مكان عمل', 'Workplace', 'واجهة', 'Storefront', 'طلبات', 'Orders', 'استوديو الذكاء', 'AI studio', 'عربي وإنجليزي', 'Arabic + English'],
    workEyebrow: 'ابدأ من هنا · Onboarding',
    workTitle: 'ثلاثة أسئلة قصيرة ثم يفتح مكان عملك.',
    workAr: 'Three small questions, then your workplace opens.',
    processEyebrow: 'كيف يعمل سوقنا',
    processTitle: 'من الاسم إلى أول عملية بيع، من دون توزيع العمل بين أدوات كثيرة.',
    atelierEyebrow: 'استوديو الذكاء',
    atelierTitle: 'الواجهة والتشغيل ومساعد الذكاء يبقون على سطح واحد.',
    atelierBody:
      'أضف صورة واحدة وجملة واحدة. سوقنا يكتب صفحات المنتجات والنص البديل والمنشورات والردود ومهام الإطلاق بنبرة مشروعك.',
    journalEyebrow: 'شرح الاستخدام',
    journalTitle: 'هادئ، لكنه نافع. الأرقام الحقيقية تظهر عندما تفتح المتاجر.',
    contactEyebrow: 'ابدأ',
    contactTitle: 'افتح متجرك اليوم.',
    contactBody: 'لا تحتاج بطاقة للبدء. ثنائي اللغة من اليوم الأول. أوقفه متى أردت.',
    contactCta: 'ابدأ',
  },
} satisfies Record<Locale, Record<string, string | string[][] | string[]>>;

const pillars = {
  en: [
    ['01', 'Name', 'Give the project a working name. Arabic, English, or both are welcome.', 'اسم المشروع'],
    ['02', 'Kind', 'Choose the kind of home business you are opening: kitchen, boutique, salon, oud, crafts, or something else.', 'نوع النشاط'],
    ['03', 'Stage', 'Take a look for the overview', 'مرحلة المشروع'],
  ],
  ar: [
    ['01', 'الاسم', 'اكتب اسماً مبدئياً للمشروع. بالعربية أو الإنجليزية أو الاثنين.', 'Name'],
    ['02', 'النوع', 'اختر نوع مشروع البيت: مطبخ، بوتيك، صالون، عطور، حرف، أو شيء آخر.', 'Kind'],
    ['03', 'المرحلة', 'قل لسوقنا أين أنت اليوم: فكرة، تستقبل طلبات، أو لديك محل صغير.', 'Stage'],
  ],
} satisfies Record<Locale, string[][]>;

const onboardingVideos = {
  en: [
    {
      key: 'name',
      label: 'Name',
      caption: 'Project identity',
      src: '/videos/onboarding/name.gif',
      srcKind: 'image',
      fields: ['Al Sadd Kitchen', 'alsadd.souqna.qa', 'Arabic + English'],
    },
    {
      key: 'kind',
      label: 'Kind',
      caption: 'Business type',
      src: '/videos/onboarding/kind.gif',
      srcKind: 'image',
      fields: ['Kitchen', 'Boutique', 'Salon'],
    },
    {
      key: 'stage',
      label: 'Stage',
      caption: 'Where you are today',
      src: '/videos/onboarding/stage.gif',
      srcKind: 'image',
      zoom: 1.24,
      fields: ['Idea', 'Taking orders', 'Small shop'],
    },
  ],
  ar: [
    {
      key: 'name',
      label: 'الاسم',
      caption: 'هوية المشروع',
      src: '/videos/onboarding/name.gif',
      srcKind: 'image',
      fields: ['مطبخ السد', 'alsadd.souqna.qa', 'عربي وإنجليزي'],
    },
    {
      key: 'kind',
      label: 'النوع',
      caption: 'نوع النشاط',
      src: '/videos/onboarding/kind.gif',
      srcKind: 'image',
      fields: ['مطبخ', 'بوتيك', 'صالون'],
    },
    {
      key: 'stage',
      label: 'المرحلة',
      caption: 'أين أنت اليوم',
      src: '/videos/onboarding/stage.gif',
      srcKind: 'image',
      zoom: 1.24,
      fields: ['فكرة', 'تستقبل طلبات', 'محل صغير'],
    },
  ],
} satisfies Record<Locale, OnboardingVideo[]>;

const phases = {
  en: [
    ['I', 'Open', 'Souqna creates the workspace, starter storefront, catalogue structure, and bilingual content plan.', 'DAY 01'],
    ['II', 'Write', 'The AI studio drafts product pages, alt text, policy copy, and launch posts in your voice.', 'CONTENT'],
    ['III', 'Operate', 'Orders, customers, support notes, and storefront changes live together instead of scattering across tabs.', 'BACK OFFICE'],
    ['IV', 'Improve', 'The workplace notices gaps, queues useful tasks, and helps you keep the business moving.', 'ALWAYS'],
  ],
  ar: [
    ['I', 'افتح', 'سوقنا ينشئ مساحة العمل والواجهة وبنية الكتالوج وخطة المحتوى ثنائية اللغة.', 'اليوم 01'],
    ['II', 'اكتب', 'استوديو الذكاء يكتب صفحات المنتجات والنص البديل والسياسات ومنشورات الإطلاق بنبرة مشروعك.', 'المحتوى'],
    ['III', 'شغّل', 'الطلبات والعملاء وملاحظات الدعم وتعديلات الواجهة تبقى معاً بدلاً من التشتت بين نوافذ كثيرة.', 'التشغيل'],
    ['IV', 'حسّن', 'مساحة العمل تلاحظ النواقص وتقترح مهاماً نافعة وتساعدك على استمرار الحركة.', 'دائماً'],
  ],
} satisfies Record<Locale, string[][]>;

const gccCurrencyLabels = {
  en: ['Qatari', 'Saudi', 'Bahraini', 'Emirati', 'Kuwaiti', 'Omani'],
  ar: ['القطرية', 'السعودية', 'البحرينية', 'الإماراتية', 'الكويتية', 'العمانية'],
} satisfies Record<Locale, string[]>;

const integrationRows = [
  [
    { key: 'vercel', label: 'Vercel', icon: siVercel },
    { key: 'clerk', label: 'Clerk', icon: siClerk },
    { key: 'meta', label: 'Meta', icon: siMeta },
    { key: 'whatsapp', label: 'WhatsApp', icon: siWhatsapp },
    { key: 'instagram', label: 'Instagram', icon: siInstagram },
    { key: 'cloudflare', label: 'Cloudflare', icon: siCloudflare },
    { key: 'skipcash', label: 'SkipCash', path: skipCashIconPath, viewBox: '0 0 62.7 89.1' },
  ],
  [
    { key: 'apple-pay', label: 'Apple Pay', icon: siApplepay },
    { key: 'zapier', label: 'Zapier', icon: siZapier },
    { key: 'google-sheets', label: 'Google Sheets', icon: siGooglesheets },
    { key: 'mailchimp', label: 'Mailchimp', icon: siMailchimp },
    { key: 'more', label: 'More integrations', more: true },
  ],
] satisfies IntegrationLogo[][];

function IntegrationLogoMark({ item }: { item: IntegrationLogo }) {
  if (item.more) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="6" cy="12" r="2.2" />
        <circle cx="12" cy="12" r="2.2" />
        <circle cx="18" cy="12" r="2.2" />
      </svg>
    );
  }

  if (item.path) {
    return (
      <svg viewBox={item.viewBox ?? '0 0 24 24'} aria-hidden="true" focusable="false">
        <path d={item.path} />
      </svg>
    );
  }

  if (!item.icon) return null;

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={item.icon.path} />
    </svg>
  );
}

const GCC_COUNTRY_KEYS = ['qatari', 'saudi', 'bahraini', 'emirati', 'kuwaiti', 'omani'] as const;
type GccCountryKey = (typeof GCC_COUNTRY_KEYS)[number];

function GccPaymentLine({ locale }: { locale: Locale }) {
  const labels = gccCurrencyLabels[locale];
  const labelText = labels.join(', ');
  const [currencyIndex, setCurrencyIndex] = useState(0);
  const country: GccCountryKey = GCC_COUNTRY_KEYS[currencyIndex] ?? GCC_COUNTRY_KEYS[0];

  const rotator = (
    <span
      className="sq-currency-rotator"
      data-country={country}
      aria-label={labelText}
    >
      <RotatingText
        texts={labels}
        splitBy="words"
        mainClassName="sq-currency-rotator-inner"
        splitLevelClassName="sq-currency-rotator-word"
        elementLevelClassName="sq-currency-rotator-fill"
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '-120%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        rotationInterval={1700}
        onNext={setCurrencyIndex}
      />
    </span>
  );

  if (locale === 'ar') {
    return (
      <p className="sq-gcc-payments">
        <span>نقبل مدفوعات الخليج بالعملات</span>
        {rotator}
        <span>ونعمل بلغتك.</span>
      </p>
    );
  }

  return (
    <p className="sq-gcc-payments">
      <span>We accept GCC payments in</span>
      {rotator}
      <span>currency and work in your language.</span>
    </p>
  );
}

export function SouqnaHomeExperience({ locale }: Props) {
  const c = home[locale];
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const localizedHref = (href: string) => {
    if (locale !== 'ar') return href;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('/account')) {
      return href;
    }
    return `/ar${href}`;
  };
  const docsHref = localizedHref('/docs');
  const navItems =
    locale === 'ar'
      ? [
          {
            href: '#work',
            label: 'المنتج',
            children: [
              { href: localizedHref('/begin'), label: 'مكان العمل', description: 'افتح مساحة العمل الأولى.' },
              { href: '#process', label: 'كيف يعمل', description: 'خط سير سوقنا الكامل.' },
              { href: '#atelier', label: 'استوديو الذكاء', description: 'مساحة سوقي الإبداعية.' },
              { href: localizedHref('/begin/souqy'), label: 'سوقي', description: 'مولد المتاجر بالذكاء.' },
            ],
          },
          {
            href: docsHref,
            label: 'مصادر',
            children: [
              { href: localizedHref('/templates'), label: 'القوالب', description: 'تصفح قوالب المتجر الجاهزة.' },
              { href: docsHref, label: 'الدليل', description: 'اقرأ أساسيات سوقنا.' },
              { href: localizedHref('/begin'), label: 'البدء', description: 'افتح مساحة العمل الأولى.' },
              { href: `${docsHref}#support`, label: 'المساعدة', description: 'الدعم والإجابات السريعة.' },
            ],
          },
          { href: '#plans', label: 'الأسعار' },
          { href: '/souqna', label: 'سوقنا' },
        ]
      : [
          {
            href: '#work',
            label: 'Product',
            children: [
              { href: '/begin', label: 'Workplace', description: 'Open the first workspace.' },
              { href: '#process', label: 'How it works', description: 'The full Souqna flow.' },
              { href: '#atelier', label: 'AI studio', description: 'Souqy creative workspace.' },
              { href: '/begin/souqy', label: 'Souqy', description: 'AI-generated storefronts.' },
            ],
          },
          {
            href: docsHref,
            label: 'Resources',
            children: [
              { href: '/templates', label: 'Templates', description: 'Browse the storefront lineup.' },
              { href: docsHref, label: 'Docs', description: 'Read the Souqna basics.' },
              { href: '/begin', label: 'Onboarding', description: 'Open the first workspace.' },
              { href: `${docsHref}#support`, label: 'Help', description: 'Support and quick answers.' },
            ],
          },
          { href: '#plans', label: 'Pricing' },
          { href: '/souqna', label: 'Souqna' },
        ];

  useEffect(() => {
    document.body.classList.add('souqna-home-route');
    return () => document.body.classList.remove('souqna-home-route');
  }, []);

  return (
    <div className="sq-home" dir={dir}>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: homeStyles }} />
      <Navigation2
        className="sq-home-nav sticky top-0 z-50"
        brandHref={locale === 'ar' ? '/ar' : '/'}
        brandLabel="Souqna home"
        brand={
          <span className="sq-wordmark">
            <Image
              src="/favicon.svg"
              width={92}
              height={42}
              alt=""
              priority
              aria-hidden="true"
              className="sq-wordmark-lockup"
            />
          </span>
        }
        items={navItems}
        actions={
          <div className="sq-nav-actions">
            <ThemeToggle compact />
            <LocaleToggle className="sq-nav-locale" locale={locale} mode="public" />
            <SignedOut>
              <Link href="/sign-up" className="sq-nav-cta">
                {locale === 'ar' ? 'ابدأ' : 'Begin'}
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/account" className="sq-nav-cta">
                {locale === 'ar' ? 'لوحة التحكم' : 'Open dashboard'}
              </Link>
            </SignedIn>
          </div>
        }
        mobileMenuFooter={
          <div className="sq-nav-mobile-footer">
            <LocaleToggle locale={locale} mode="public" />
          </div>
        }
      />

      <main>
        <section id="top" className="sq-hero">
          <HalftoneWave
            width="100%"
            height="100%"
            className="sq-hero-halftone sq-hero-halftone-light"
            speed={1.12}
            noiseScale={3.3}
            octaves={3}
            gridDensity={64}
            dotSize={0.65}
            softness={0.35}
            contrastMin={0.13}
            contrastMax={0.8}
            scrollX={0.16}
            scrollY={0.13}
            rotation={0}
            colorA="#0A0A0A"
            colorB="#5A5650"
            backgroundColor="#E8DCC4"
            opacity={0.3}
          />
          <HalftoneWave
            width="100%"
            height="100%"
            className="sq-hero-halftone sq-hero-halftone-dark"
            speed={1}
            noiseScale={3.3}
            octaves={3}
            gridDensity={64}
            dotSize={0.65}
            softness={0.35}
            contrastMin={0.13}
            contrastMax={0.8}
            scrollX={0.15}
            scrollY={0.12}
            rotation={0}
            colorA="#F3F3EF"
            colorB="#8B8B84"
            backgroundColor="#050505"
            opacity={0.26}
          />
          <div className="sq-hero-map-overlay" aria-hidden="true">
            <Image
              src="/brand/souqna-gcc-network-map.png"
              alt=""
              fill
              priority
              sizes="100vw"
              className="sq-hero-map-image"
            />
          </div>
          <div className="sq-hero-copy">
            <div className="sq-kicker">
              <span />
              {c.badge as string}
            </div>
            <h1>
              <span>{c.heroA as string}</span>
              <em>{c.heroB as string}</em>
              {c.heroC ? <span>{c.heroC as string}</span> : null}
            </h1>
            <p className="sq-echo">{c.echo as string}</p>
            <div className="sq-hero-bottom">
              <p>{c.body as string}</p>
              <div className="sq-hero-ctas">
                <MetalFrame strength={0.55} borderRadius={999}>
                  <SignedOut>
                    <Link href="/sign-up" className="sq-button sq-button-gold">
                      {c.primary as string}
                    </Link>
                  </SignedOut>
                  <SignedIn>
                    <Link href={localizedHref('/begin')} className="sq-button sq-button-gold">
                      {c.primary as string}
                    </Link>
                  </SignedIn>
                </MetalFrame>
                <a href="#work" className="sq-button sq-button-ghost">
                  {c.secondary as string}
                </a>
                <SignedOut>
                  <Link href="/sign-up" className="sq-manifesto">
                    {c.manifesto as string}
                  </Link>
                </SignedOut>
                <SignedIn>
                  <Link href="/account" className="sq-manifesto">
                    {c.manifesto as string}
                  </Link>
                </SignedIn>
              </div>
            </div>
          </div>

        </section>

        <section
          className="sq-integrations-marquee"
          aria-label={locale === 'ar' ? 'تكاملات سوقنا' : 'Souqna integrations'}
        >
          {(() => {
            const items = integrationRows.flat();
            return (
              <div className="sq-integration-row sq-integration-row-left">
                {[...items, ...items].map((item, index) => (
                  <span
                    className="sq-integration-pill"
                    key={`${item.key}-${index}`}
                    aria-label={item.label}
                    title={item.label}
                    aria-hidden={index >= items.length ? true : undefined}
                  >
                    <IntegrationLogoMark item={item} />
                  </span>
                ))}
              </div>
            );
          })()}
        </section>

        <section id="work" className="sq-section sq-work">
          <div className="sq-section-head">
            <div>
              <p className="sq-kicker">
                <span />
                {c.workEyebrow as string}
              </p>
              <h2>{c.workTitle as string}</h2>
            </div>
            <p className="sq-side-note">{c.workAr as string}</p>
          </div>
          <div className="sq-pillars">
            {pillars[locale].map(([n, title, body, tag]) => (
              <article key={n}>
                <span>{n}</span>
                <h3>{title}</h3>
                <p>{body}</p>
                <small>{tag}</small>
              </article>
            ))}
          </div>
          <div
            className="sq-onboarding-videos"
            aria-label={locale === 'ar' ? 'مقاطع تعريفية للتسجيل' : 'Onboarding preview videos'}
          >
            {onboardingVideos[locale].map((video, index) => (
              <OnboardingVideoCard key={video.key} video={video} index={index} />
            ))}
          </div>
        </section>

        <section id="process" className="sq-section sq-process">
          <div className="sq-section-head">
            <div>
              <p className="sq-kicker">
                <span />
                {c.processEyebrow as string}
              </p>
              <h2>{c.processTitle as string}</h2>
            </div>
          </div>
          <div className="sq-process-grid">
            {phases[locale].map(([n, title, body, tag]) => (
              <article key={n}>
                <span>{n}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
                <small>{tag}</small>
              </article>
            ))}
          </div>
        </section>

        <section id="atelier" className="sq-section sq-atelier">
          <div className="sq-atelier-mark" aria-hidden>
            <ArchMark large />
          </div>
          <div className="sq-section-head">
            <div>
              <p className="sq-kicker">
                <span />
                {c.atelierEyebrow as string}
              </p>
              <h2>{c.atelierTitle as string}</h2>
            </div>
          </div>
          <p>{c.atelierBody as string}</p>
          <div className="sq-atelier-grid">
            {(locale === 'ar'
              ? ['نكتب الكود والنص والعقد بأنفسنا.', 'نفوتر بالريال، ونعمل بلغتك.', 'نبقى معك بعد الإطلاق: مرافقة مستمرة.']
              : ['We write our own code, copy, and contracts.', 'GCC payments', 'We stay after launch: continuous support, not a hand-off.']
            ).map((item, index) => (
              <article key={item}>
                <small>0{index + 1}</small>
                {index === 1 ? <GccPaymentLine locale={locale} /> : <p>{item}</p>}
              </article>
            ))}
          </div>
        </section>

        <Pricing5 locale={locale} />

        <section id="contact" className="sq-contact">
          <div>
            <p className="sq-kicker">
              <span />
              {c.contactEyebrow as string}
            </p>
            <h2>{c.contactTitle as string}</h2>
            <p>{c.contactBody as string}</p>
          </div>
          <MetalFrame strength={0.55} borderRadius={999}>
            <SignedOut>
              <Link href="/sign-up" className="sq-button sq-button-gold">
                {c.contactCta as string}
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href={localizedHref('/begin')} className="sq-button sq-button-gold">
                {c.contactCta as string}
              </Link>
            </SignedIn>
          </MetalFrame>
        </section>
        <Footer8 locale={locale} />
      </main>
    </div>
  );
}

function OnboardingVideoCard({
  video,
  index,
}: {
  video: OnboardingVideo;
  index: number;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <article className="sq-onboarding-video">
      <div className="sq-onboarding-frame">
        {failed || !video.src ? (
          <OnboardingVideoFallback video={video} />
        ) : video.srcKind === 'image' ? (
          <Image
            src={video.src}
            alt=""
            fill
            sizes="(max-width: 920px) 100vw, 33vw"
            className="sq-onboarding-media"
            style={video.zoom ? { transform: `scale(${video.zoom})` } : undefined}
            unoptimized
            onError={() => setFailed(true)}
          />
        ) : (
          <video
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            aria-label={video.label}
            style={video.zoom ? { transform: `scale(${video.zoom})` } : undefined}
            onError={() => setFailed(true)}
            onCanPlay={(event) => {
              event.currentTarget.play().catch(() => undefined);
            }}
          >
            <source src={video.src} type="video/mp4" />
          </video>
        )}
      </div>
      <div className="sq-onboarding-caption">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <h3>{video.label}</h3>
        <small>{video.caption}</small>
      </div>
    </article>
  );
}

function OnboardingVideoFallback({ video }: { video: OnboardingVideo }) {
  return (
    <div className="sq-onboarding-fallback" aria-hidden>
      <div className="sq-onboarding-window">
        <i />
        <i />
        <i />
        <span />
      </div>
      <div className="sq-onboarding-screen">
        <div className="sq-onboarding-prompt">
          <span />
          <strong>{video.label}</strong>
        </div>
        <div className="sq-onboarding-options">
          {video.fields.map((field) => (
            <span key={field}>{field}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ArchMark({
  large = false,
  small = false,
}: {
  large?: boolean;
  small?: boolean;
}) {
  const size = large ? 360 : small ? 16 : 32;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      focusable="false"
    >
      <path
        d="M14 58V31C14 21.1 22.1 13 32 13s18 8.1 18 18v27"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M23 58V34c0-5 4-9 9-9s9 4 9 9v24"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".55"
      />
    </svg>
  );
}

const homeStyles = `
  body.souqna-home-route [data-public-chrome],
  body:has(.sq-home) [data-public-chrome] {
    display: none !important;
  }

  .sq-home {
    --sq-bg: #E8DCC4;
    --sq-paper: #E8DCC4;
    --sq-raised: rgba(42, 42, 42, 0.04);
    --sq-ink: #2A2A2A;
    --sq-muted: rgba(42, 42, 42, 0.64);
    --sq-faint: rgba(42, 42, 42, 0.1);
    --sq-maroon: #2A2A2A;
    --sq-gold: #2A2A2A;
    --sq-gold-deep: #2A2A2A;
    --sq-charcoal: #2A2A2A;
    --sq-invert-bg: #2A2A2A;
    --sq-invert-ink: #E8DCC4;
    --sq-rule: rgba(42, 42, 42, 0.18);
    --sq-glass: rgba(232, 220, 196, 0.72);
    --sq-page-pad: clamp(18px, 4vw, 52px);
    --sq-section-y: clamp(64px, 8vw, 112px);
    --sq-section-gap: clamp(34px, 5vw, 58px);
    min-height: 100dvh;
    background:
      linear-gradient(var(--sq-faint) 1px, transparent 1px),
      linear-gradient(90deg, var(--sq-faint) 1px, transparent 1px),
      var(--sq-bg);
    background-size: 44px 44px;
    color: var(--sq-ink);
    font-family: var(--font-sans);
    overflow-x: clip;
  }

  [data-theme='dark'] .sq-home {
    --sq-bg: #2A2A2A;
    --sq-paper: #2A2A2A;
    --sq-raised: rgba(232, 220, 196, 0.05);
    --sq-ink: #E8DCC4;
    --sq-muted: rgba(232, 220, 196, 0.66);
    --sq-faint: rgba(232, 220, 196, 0.12);
    --sq-maroon: #E8DCC4;
    --sq-gold: #E8DCC4;
    --sq-gold-deep: #E8DCC4;
    --sq-charcoal: #E8DCC4;
    --sq-invert-bg: #E8DCC4;
    --sq-invert-ink: #2A2A2A;
    --sq-rule: rgba(232, 220, 196, 0.2);
    --sq-glass: rgba(42, 42, 42, 0.72);
  }

  .sq-home[dir='rtl'] {
    font-family: var(--font-arabic);
    font-weight: 700;
  }

  .sq-home[dir='rtl'] :where(a, button, p, span, small, h1, h2, h3, h4, li) {
    font-family: var(--font-arabic);
    font-weight: 700;
  }

  .sq-home * { box-sizing: border-box; }
  .sq-home a { color: inherit; }

  .sq-home-nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 70;
    padding: 13px var(--sq-page-pad);
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--sq-bg) 58%, transparent), transparent);
    border-bottom: 0;
    pointer-events: none;
  }

  .sq-home-nav .rb-nav-shell,
  .sq-home-nav .rb-nav-dropdown,
  .sq-home-nav a,
  .sq-home-nav button {
    pointer-events: auto;
  }

  .sq-home-nav .rb-nav-shell {
    background: rgba(255, 255, 255, 0.64) !important;
    border-color: rgba(17, 17, 17, 0.12) !important;
    color: #111111;
  }

  html[data-theme='dark'] .sq-home-nav .rb-nav-shell {
    background: rgba(10, 10, 10, 0.58) !important;
    border-color: rgba(255, 255, 255, 0.12) !important;
    color: #ffffff;
    box-shadow: 0 18px 70px rgba(0, 0, 0, 0.42);
  }

  html[data-theme='light'] .sq-home-nav .rb-nav-shell {
    background: rgba(255, 255, 255, 0.64) !important;
    border-color: rgba(17, 17, 17, 0.12) !important;
    color: #111111;
  }

  html[data-theme='dark'] .sq-home-nav :where(.rb-nav-link) {
    color: rgba(255, 255, 255, 0.78) !important;
  }

  html[data-theme='dark'] .sq-home-nav :where(.rb-nav-link:hover) {
    color: #ffffff !important;
  }

  html[data-theme='light'] .sq-home-nav :where(.rb-nav-link) {
    color: rgba(17, 17, 17, 0.72) !important;
  }

  html[data-theme='light'] .sq-home-nav :where(.rb-nav-link:hover) {
    color: #111111 !important;
  }

  .sq-wordmark {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: #111111;
    font-weight: 700;
    text-decoration: none;
    letter-spacing: 0;
  }

  html[data-theme='dark'] .sq-wordmark {
    color: #ffffff !important;
  }

  .sq-wordmark-lockup {
    display: block;
    width: 84px;
    height: auto;
    max-width: 30vw;
    object-fit: contain;
    filter: brightness(0) saturate(100%);
  }

  html[data-theme='dark'] .sq-wordmark-lockup {
    filter: brightness(0) saturate(100%) invert(1) !important;
  }

  html[data-theme='light'] .sq-wordmark-lockup {
    filter: brightness(0) saturate(100%) !important;
  }

  .sq-home-nav :where(a, button) {
    font-family: var(--font-sans);
  }

  .sq-home[dir='rtl'] .sq-home-nav :where(a, button, span) {
    font-family: var(--font-arabic);
    font-weight: 700;
  }

  .sq-home-nav :where(a[href^="#"]) {
    text-underline-offset: 4px;
  }

  .sq-home-nav :where(a[href^="#"]:hover) {
    text-decoration: none;
  }

  .sq-home-nav :where([aria-label="Souqna home"]) {
    color: #111111;
  }

  html[data-theme='dark'] .sq-home-nav :where([aria-label="Souqna home"]) {
    color: #ffffff !important;
  }

  .sq-home-nav :where([aria-label="Souqna home"]:focus-visible, a:focus-visible, button:focus-visible) {
    outline: 2px solid currentColor;
    outline-offset: 4px;
  }

  .sq-home-nav :where(button) {
    border: 0;
    cursor: pointer;
  }

  .sq-home-nav :where(button, a) {
    -webkit-tap-highlight-color: transparent;
  }

  .sq-home-nav :where(.sq-nav-actions) {
    display: block;
  }

  .sq-nav-links {
    display: flex;
    justify-content: center;
    gap: clamp(14px, 3vw, 34px);
    font-size: 13px;
  }

  .sq-nav-links a {
    text-decoration: none;
    color: var(--sq-muted);
  }

  .sq-nav-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }

  .sq-nav-mobile-footer {
    display: none;
  }

  /* ─── Navigation2 palette overrides ────────────────────────────────
     Repaint the registry-installed Navigation2 capsule + dropdowns in
     the Souqna palette WITHOUT modifying the component itself.
     Uses .sq-* tokens scoped to .sq-home — they flip correctly with
     [data-theme='dark']. Specificity: .sq-home-nav <descendant> beats
     raw Tailwind utilities.
  ─────────────────────────────────────────────────────────────────── */

  /* Capsule (desktop + mobile) — uses --sq-glass which already flips */
  .sq-home-nav .rb-nav-shell {
    background: var(--sq-glass);
    border-color: var(--sq-rule);
    box-shadow:
      0 1px 0 color-mix(in srgb, var(--sq-ink) 5%, transparent) inset,
      0 18px 60px color-mix(in srgb, var(--sq-ink) 10%, transparent);
  }
  [data-theme='dark'] .sq-home-nav .rb-nav-shell {
    box-shadow:
      0 1px 0 color-mix(in srgb, var(--sq-ink) 8%, transparent) inset,
      0 18px 70px rgba(0, 0, 0, 0.5);
  }

  /* Brand link inside the capsule */
  .sq-home-nav .rb-nav-shell > a[aria-label="Souqna home"] {
    color: var(--sq-ink);
  }

  /* Top-level link / dropdown trigger text */
  .sq-home-nav .rb-nav-link {
    color: var(--sq-muted);
  }
  .sq-home-nav .rb-nav-link:hover {
    color: var(--sq-ink);
  }
  .sq-home-nav .rb-nav-link:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--sq-ink) 22%, transparent);
  }

  /* Dropdown panel */
  .sq-home-nav .rb-nav-dropdown {
    background: var(--sq-glass);
    border-color: var(--sq-rule);
    box-shadow: 0 24px 70px color-mix(in srgb, var(--sq-ink) 18%, transparent);
  }


  /* Dropdown items */
  .sq-home-nav .rb-nav-dropdown a {
    color: var(--sq-ink);
  }
  .sq-home-nav .rb-nav-dropdown a:hover {
    background: color-mix(in srgb, var(--sq-ink) 6%, transparent);
  }
  .sq-home-nav .rb-nav-dropdown a > span:last-child:not(:first-child) {
    color: var(--sq-muted);
  }

  /* Mobile menu items + hamburger */
  .sq-home-nav .lg\\:hidden a[href] {
    background: color-mix(in srgb, var(--sq-paper) 36%, transparent);
    border-color: var(--sq-rule);
    color: var(--sq-ink);
  }
  .sq-home-nav .lg\\:hidden a[href]:hover {
    background: color-mix(in srgb, var(--sq-paper) 64%, transparent);
  }
  .sq-home-nav .lg\\:hidden button[aria-expanded] {
    background: var(--sq-invert-bg);
    color: var(--sq-invert-ink);
  }
  .sq-home-nav .lg\\:hidden button[aria-expanded]:hover {
    background: color-mix(in srgb, var(--sq-invert-bg) 88%, var(--sq-invert-ink));
  }

  /* CTA button (Begin / Open dashboard).
     Scoped under .sq-home so its specificity (0,2,0) beats the existing
     .sq-home a { color: inherit } rule (0,1,1) — otherwise the color
     declaration gets lost and the link inherits white from chrome. */
  .sq-home .sq-nav-cta {
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    border-radius: 9999px;
    padding: 8px 14px;
    background: var(--sq-invert-bg);
    color: var(--sq-invert-ink);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: -0.01em;
    text-decoration: none;
    transition: background-color 160ms ease, color 160ms ease, transform 160ms ease;
  }
  .sq-home .sq-nav-cta:hover {
    background: color-mix(in srgb, var(--sq-invert-bg) 86%, var(--sq-invert-ink));
    transform: translateY(-1px);
  }
  .sq-home .sq-nav-cta:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--sq-invert-bg) 30%, transparent);
  }

  @media (max-width: 1023px) {
    .sq-nav-locale {
      display: none !important;
    }

    .sq-nav-mobile-footer {
      display: block;
      padding-top: 4px;
    }

    .sq-nav-mobile-footer :where(a, button) {
      width: 100%;
      min-height: 42px;
      justify-content: center;
      background: color-mix(in srgb, var(--sq-paper) 58%, transparent) !important;
    }

    .sq-home-nav .lg\\:hidden .rb-nav-shell {
      border-radius: 30px;
    }

    .sq-home-nav .lg\\:hidden .rb-nav-shell > div:first-child {
      gap: 8px;
      padding: 10px 12px;
      min-width: 0;
    }

    .sq-home-nav .lg\\:hidden .rb-nav-shell > div:first-child > a {
      flex: 0 1 auto;
      min-width: 0;
    }

    .sq-home-nav .lg\\:hidden .rb-nav-shell > div:first-child > div {
      flex: 0 0 auto;
      gap: 6px;
      min-width: 0;
    }

    .sq-home-nav .lg\\:hidden button[aria-expanded] {
      width: 40px;
      height: 40px;
      flex: 0 0 40px;
    }

    .sq-home .sq-nav-cta {
      min-height: 40px;
      max-width: min(40vw, 154px);
      padding: 8px 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 12.5px;
    }
  }

  .sq-hero {
    --sq-hero-bg: #E8DCC4;
    --sq-hero-text: #0A0A0A;
    --sq-hero-muted: rgba(10, 10, 10, 0.66);
    --sq-hero-rule: rgba(10, 10, 10, 0.18);
    --sq-hero-accent: #2A2A2A;
    --sq-hero-accent-strong: #0A0A0A;
    --sq-hero-line: rgba(10, 10, 10, 0.07);
    --sq-hero-line-soft: rgba(10, 10, 10, 0.05);
    --sq-hero-glow: rgba(10, 10, 10, 0.06);
    --sq-hero-vignette: rgba(232, 220, 196, 0.18);
    --sq-hero-vignette-strong: rgba(209, 199, 178, 0.5);
    --sq-hero-spot-a: rgba(10, 10, 10, 0.05);
    --sq-hero-spot-b: rgba(10, 10, 10, 0.07);
    --sq-hero-spot-c: rgba(10, 10, 10, 0.04);
    --sq-hero-blend: multiply;
    --sq-hero-ghost-bg: rgba(10, 10, 10, 0.04);
    min-height: min(880px, calc(100dvh - 66px));
    position: relative;
    isolation: isolate;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: center;
    justify-items: start;
    overflow: hidden;
    padding: clamp(64px, 9vw, 126px) var(--sq-page-pad) clamp(58px, 8vw, 98px);
    background: var(--sq-hero-bg);
    color: var(--sq-hero-text);
    transition: background-color 320ms ease, color 320ms ease;
  }

  [data-theme='dark'] .sq-hero {
    --sq-hero-bg: #0A0A0A;
    --sq-hero-text: #F7F7F3;
    --sq-hero-muted: rgba(247, 247, 243, 0.7);
    --sq-hero-rule: rgba(247, 247, 243, 0.2);
    --sq-hero-accent: #E7E6E0;
    --sq-hero-accent-strong: #C8C7C0;
    --sq-hero-line: rgba(247, 247, 243, 0.1);
    --sq-hero-line-soft: rgba(247, 247, 243, 0.08);
    --sq-hero-glow: rgba(255, 255, 255, 0.14);
    --sq-hero-vignette: rgba(10, 10, 10, 0.2);
    --sq-hero-vignette-strong: rgba(10, 10, 10, 0.72);
    --sq-hero-spot-a: rgba(255, 255, 255, 0.08);
    --sq-hero-spot-b: rgba(255, 255, 255, 0.12);
    --sq-hero-spot-c: rgba(255, 255, 255, 0.07);
    --sq-hero-blend: screen;
    --sq-hero-ghost-bg: rgba(255, 255, 255, 0.06);
  }

  .sq-hero ::selection {
    background: rgba(255, 255, 255, 0.18);
    color: #ffffff;
  }

  .sq-hero::before,
  .sq-hero::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
  }

  .sq-hero::before {
    background:
      linear-gradient(var(--sq-hero-line) 1px, transparent 1px),
      linear-gradient(90deg, var(--sq-hero-line-soft) 1px, transparent 1px),
      radial-gradient(circle at 78% 48%, var(--sq-hero-glow), transparent 38%),
      linear-gradient(90deg, var(--sq-hero-vignette), var(--sq-hero-vignette-strong));
    background-size: 44px 44px, 44px 44px, auto, auto;
    animation: sq-hero-grid-drift 22s linear infinite;
  }

  .sq-hero::after {
    background:
      radial-gradient(circle at 12% 18%, var(--sq-hero-spot-a), transparent 28%),
      radial-gradient(circle at 62% 22%, var(--sq-hero-spot-b), transparent 24%),
      radial-gradient(circle at 42% 88%, var(--sq-hero-spot-c), transparent 32%),
      linear-gradient(180deg, var(--sq-hero-vignette), var(--sq-hero-vignette-strong));
    background-size: 130% 130%, 140% 140%, 160% 160%, auto;
    mix-blend-mode: var(--sq-hero-blend);
    opacity: 0.84;
    animation: sq-hero-ambient-sweep 13s ease-in-out infinite alternate;
  }

  .sq-hero-halftone {
    position: absolute !important;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    opacity: 1;
    mix-blend-mode: normal;
    transform: scale(1.035);
    transform-origin: center;
    will-change: filter, opacity, transform;
    animation: sq-hero-halftone-breathe 10s ease-in-out infinite alternate;
  }

  .sq-hero-halftone-dark {
    display: none;
  }

  .sq-hero-map-overlay {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    opacity: 0.46;
    mix-blend-mode: multiply;
    overflow: hidden;
    transform: scale(1.02);
    transform-origin: center;
    mask-image:
      radial-gradient(ellipse at 60% 50%, #000 0 46%, rgba(0, 0, 0, 0.68) 68%, transparent 96%);
    -webkit-mask-image:
      radial-gradient(ellipse at 60% 50%, #000 0 46%, rgba(0, 0, 0, 0.68) 68%, transparent 96%);
  }

  .sq-hero-map-overlay::before,
  .sq-hero-map-overlay::after {
    content: "";
    position: absolute;
    z-index: 2;
    pointer-events: none;
  }

  .sq-hero-map-overlay::before {
    inset: 0 auto 0 0;
    width: 24%;
    background: linear-gradient(90deg, color-mix(in srgb, var(--sq-hero-bg) 88%, transparent), transparent);
  }

  .sq-hero-map-overlay::after {
    inset: auto 0 0 0;
    height: 26%;
    background: linear-gradient(0deg, color-mix(in srgb, var(--sq-hero-bg) 90%, transparent), transparent);
  }

  .sq-hero-map-image {
    object-fit: cover;
    object-position: center 48%;
    transform: scale(1.26);
    transform-origin: center;
    filter: saturate(0.72) contrast(1.05) brightness(0.9);
  }

  .sq-home[dir='rtl'] .sq-hero-map-overlay {
    mask-image:
      radial-gradient(ellipse at 46% 50%, #000 0 48%, rgba(0, 0, 0, 0.68) 70%, transparent 96%);
    -webkit-mask-image:
      radial-gradient(ellipse at 46% 50%, #000 0 48%, rgba(0, 0, 0, 0.68) 70%, transparent 96%);
  }

  .sq-home[dir='rtl'] .sq-hero-map-image {
    object-position: 46% 48%;
    transform: scale(1.28);
  }

  .sq-home[dir='rtl'] .sq-hero-map-overlay::before {
    inset: 0 0 0 auto;
    background: linear-gradient(270deg, color-mix(in srgb, var(--sq-hero-bg) 88%, transparent), transparent);
  }

  [data-theme='dark'] .sq-hero-map-overlay {
    opacity: 0.48;
    mix-blend-mode: normal;
  }

  [data-theme='dark'] .sq-hero-map-image {
    filter: saturate(0.68) contrast(1.06) brightness(0.86);
  }

  [data-theme='dark'] .sq-hero-halftone-light {
    display: none;
  }

  [data-theme='dark'] .sq-hero-halftone-dark {
    display: block;
    opacity: 1;
    mix-blend-mode: normal;
  }

  .sq-hero-copy {
    position: relative;
    z-index: 3;
    max-width: min(100%, 980px);
  }

  .sq-home[dir='rtl'] .sq-hero {
    justify-items: end;
  }

  .sq-home[dir='rtl'] .sq-hero-copy {
    text-align: right;
  }

  .sq-kicker {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    margin: 0 0 24px;
    color: var(--sq-gold-deep);
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .sq-hero .sq-kicker {
    color: var(--sq-hero-accent);
    opacity: 0;
    animation: sq-hero-rise 680ms cubic-bezier(0.2, 0.78, 0.18, 1) 80ms forwards;
  }

  .sq-kicker span {
    width: 26px;
    height: 1px;
    background: currentColor;
  }

  .sq-hero h1 {
    max-width: min(100%, 980px);
    margin: 0;
    color: var(--sq-hero-text);
    font-size: clamp(50px, 7vw, 104px);
    font-family: var(--font-english);
    font-weight: 500;
    letter-spacing: 0;
    line-height: 0.9;
    text-wrap: balance;
  }

  .sq-hero h1 span,
  .sq-hero h1 em {
    display: block;
    opacity: 0;
    transform: translate3d(0, 34px, 0);
    filter: blur(10px);
    animation: sq-hero-rise 860ms cubic-bezier(0.2, 0.78, 0.18, 1) forwards;
  }

  .sq-hero h1 span:nth-child(1) {
    animation-delay: 180ms;
  }

  .sq-hero h1 em {
    color: var(--sq-hero-accent);
    font-family: var(--font-english);
    font-style: italic;
    font-weight: 500;
    animation-delay: 300ms;
    text-shadow: 0 0 22px rgba(255, 255, 255, 0.16);
  }

  .sq-hero h1 span:nth-child(3) {
    animation-delay: 420ms;
  }

  .sq-home[dir='rtl'] .sq-hero h1,
  .sq-home[dir='rtl'] .sq-section h2,
  .sq-home[dir='rtl'] .sq-contact h2 {
    font-family: var(--font-arabic-serif);
    font-weight: 700;
    line-height: 1.08;
  }

  .sq-home[dir='rtl'] .sq-hero h1 span,
  .sq-home[dir='rtl'] .sq-hero h1 em {
    font-family: var(--font-arabic-serif);
    font-weight: 700;
  }

  .sq-home[dir='rtl'] .sq-hero h1 em {
    font-style: normal;
  }

  .sq-echo {
    margin: 22px 0 0;
    color: var(--sq-muted);
    font-size: clamp(20px, 2.2vw, 32px);
    line-height: 1.3;
    opacity: 0;
    animation: sq-hero-rise 760ms cubic-bezier(0.2, 0.78, 0.18, 1) 470ms forwards;
  }

  .sq-hero .sq-echo {
    color: var(--sq-hero-muted);
  }

  .sq-hero-bottom {
    display: flex;
    flex-direction: column;
    gap: 22px;
    align-items: flex-start;
    margin-top: clamp(28px, 5vh, 54px);
    opacity: 0;
    animation: sq-hero-rise 760ms cubic-bezier(0.2, 0.78, 0.18, 1) 620ms forwards;
  }

  .sq-hero-bottom p {
    margin: 0;
    color: var(--sq-muted);
    font-size: clamp(15px, 1.2vw, 16px);
    line-height: 1.58;
    max-width: 720px;
  }

  .sq-hero .sq-hero-bottom p {
    color: var(--sq-hero-muted);
  }

  .sq-hero-ctas {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-start;
    gap: 10px;
  }

  .sq-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 10px 17px;
    border-radius: 999px;
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
    border: 1px solid transparent;
  }

  .sq-button-gold,
  .sq-home a.sq-button-gold {
    background: var(--sq-gold);
    color: var(--sq-bg);
  }

  .sq-hero .sq-button-gold,
  .sq-home .sq-hero a.sq-button-gold {
    border-color: rgba(255, 255, 255, 0.86);
    background: #F7F7F3;
    color: #111111;
    box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
  }

  .sq-button-ghost {
    border-color: var(--sq-rule);
    background: var(--sq-glass);
    color: var(--sq-ink);
  }

  .sq-hero .sq-button-ghost {
    border-color: var(--sq-hero-rule);
    background: var(--sq-hero-ghost-bg);
    color: var(--sq-hero-text);
  }

  .sq-manifesto {
    color: var(--sq-muted);
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0;
    text-decoration: none;
    text-transform: uppercase;
  }

  .sq-hero .sq-manifesto {
    color: var(--sq-hero-muted);
  }

  @keyframes sq-hero-rise {
    from {
      opacity: 0;
      transform: translate3d(0, 28px, 0);
      filter: blur(10px);
    }
    to {
      opacity: 1;
      transform: translate3d(0, 0, 0);
      filter: blur(0);
    }
  }

  @keyframes sq-hero-grid-drift {
    from {
      background-position: 0 0, 0 0, 78% 48%, 0 0;
    }
    to {
      background-position: 44px 44px, -44px 44px, 72% 52%, 0 0;
    }
  }

  @keyframes sq-hero-ambient-sweep {
    from {
      opacity: 0.58;
      transform: translate3d(-1.4%, -0.8%, 0) scale(1.01);
    }
    to {
      opacity: 0.94;
      transform: translate3d(1.8%, 1%, 0) scale(1.045);
    }
  }

  @keyframes sq-hero-halftone-breathe {
    from {
      filter: contrast(0.92) brightness(0.82);
      opacity: 0.88;
      transform: scale(1.025);
    }
    to {
      filter: contrast(1.16) brightness(1.08);
      opacity: 1;
      transform: scale(1.065);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sq-hero::before,
    .sq-hero::after,
    .sq-hero-halftone,
    .sq-hero .sq-kicker,
    .sq-hero h1 span,
    .sq-hero h1 em,
    .sq-echo,
    .sq-hero-bottom {
      animation: none;
      opacity: 1;
      transform: none;
      filter: none;
    }
  }

  .sq-integrations-marquee {
    position: relative;
    overflow: hidden;
    display: grid;
    gap: 10px;
    border-block: 1px solid var(--sq-rule);
    background:
      linear-gradient(90deg, var(--sq-bg), color-mix(in srgb, var(--sq-bg) 78%, transparent), var(--sq-bg)),
      color-mix(in srgb, var(--sq-charcoal) 94%, var(--sq-bg));
    color: var(--sq-invert-ink);
    padding: 18px 0;
  }

  .sq-integrations-marquee::before,
  .sq-integrations-marquee::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 2;
    width: min(17vw, 180px);
    pointer-events: none;
  }

  .sq-integrations-marquee::before {
    left: 0;
    background: linear-gradient(90deg, var(--sq-bg), transparent);
  }

  .sq-integrations-marquee::after {
    right: 0;
    background: linear-gradient(270deg, var(--sq-bg), transparent);
  }

  .sq-integration-row {
    display: flex;
    gap: 10px;
    width: max-content;
    will-change: transform;
  }

  .sq-integration-row-left {
    animation: sq-integrations-left 32s linear infinite;
  }

  .sq-integration-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: clamp(76px, 8vw, 112px);
    height: clamp(52px, 5.5vw, 68px);
    border: 1px solid color-mix(in srgb, var(--sq-invert-ink) 12%, transparent);
    border-radius: 26px;
    background: color-mix(in srgb, var(--sq-invert-bg) 25%, transparent);
    color: var(--sq-invert-ink);
    padding: 0;
    line-height: 1;
    white-space: nowrap;
    transition:
      background 180ms ease,
      border-color 180ms ease,
      opacity 180ms ease,
      transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1);
    opacity: 0.85;
  }

  .sq-integration-pill:hover {
    opacity: 1;
    background: color-mix(in srgb, var(--sq-invert-bg) 40%, transparent);
    border-color: color-mix(in srgb, var(--sq-invert-ink) 22%, transparent);
    transform: translateY(-2px);
  }

  .sq-integration-pill:active {
    transform: translateY(0) scale(0.96);
    transition-duration: 80ms;
  }

  .sq-integration-pill svg {
    display: block;
    width: clamp(28px, 3vw, 40px);
    height: clamp(28px, 3vw, 40px);
    fill: currentColor;
  }

  @keyframes sq-integrations-left {
    from { transform: translate3d(0, 0, 0); }
    to { transform: translate3d(-50%, 0, 0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .sq-integration-row-left {
      animation: none;
      transform: none;
    }
  }

  .sq-section {
    padding: var(--sq-section-y) var(--sq-page-pad);
  }

  .sq-section-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: clamp(20px, 3.5vw, 32px);
    max-width: 1400px;
    margin: 0 auto var(--sq-section-gap);
  }

  .sq-section h2,
  .sq-contact h2 {
    max-width: 1000px;
    margin: 0;
    font-size: clamp(36px, 5vw, 72px);
    font-weight: 300;
    line-height: 1;
    letter-spacing: 0;
    text-wrap: balance;
  }

  .sq-side-note {
    color: var(--sq-muted);
    font-size: 16px;
    margin: 0;
  }

  .sq-pillars {
    max-width: 1400px;
    margin: 0 auto;
    border-top: 1px solid var(--sq-rule);
  }

  .sq-pillars article {
    display: grid;
    grid-template-columns: 58px 0.9fr 1.35fr 0.72fr;
    gap: clamp(18px, 3vw, 26px);
    align-items: center;
    padding: clamp(24px, 3vw, 30px) 0;
    border-bottom: 1px solid var(--sq-rule);
  }

  .sq-pillars span,
  .sq-process-grid article > span {
    color: var(--sq-gold-deep);
    font-family: var(--font-serif);
    font-size: clamp(26px, 2.6vw, 32px);
    font-style: italic;
  }

  .sq-pillars h3,
  .sq-process-grid h3,
  .sq-notes h3 {
    margin: 0;
    font-size: clamp(22px, 2.6vw, 34px);
    font-weight: 400;
    line-height: 1.05;
  }

  .sq-home[dir='rtl'] .sq-pillars h3,
  .sq-home[dir='rtl'] .sq-process-grid h3,
  .sq-home[dir='rtl'] .sq-notes h3,
  .sq-home[dir='rtl'] .sq-atelier-grid p {
    font-family: var(--font-arabic-serif);
    font-weight: 700;
  }

  .sq-pillars p,
  .sq-process-grid p {
    margin: 0;
    color: var(--sq-muted);
    font-size: 15.5px;
    line-height: 1.55;
  }

  .sq-pillars small,
  .sq-process-grid small,
  .sq-notes small {
    color: var(--sq-muted);
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .sq-onboarding-videos {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(12px, 1.6vw, 18px);
    max-width: 1400px;
    margin: clamp(22px, 3vw, 34px) auto 0;
  }

  .sq-onboarding-video {
    overflow: hidden;
    border: 1px solid var(--sq-rule);
    border-radius: 8px;
    background: color-mix(in srgb, var(--sq-ink) 7%, transparent);
  }

  .sq-onboarding-frame {
    position: relative;
    aspect-ratio: 486 / 361;
    overflow: hidden;
    border-bottom: 1px solid var(--sq-rule);
    background:
      linear-gradient(90deg, color-mix(in srgb, var(--sq-rule) 64%, transparent) 1px, transparent 1px),
      linear-gradient(0deg, color-mix(in srgb, var(--sq-rule) 52%, transparent) 1px, transparent 1px),
      #1e1e1b;
    background-size: 36px 36px;
  }

  .sq-onboarding-frame video,
  .sq-onboarding-media {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    transform-origin: center;
  }

  .sq-onboarding-caption {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    align-items: baseline;
    padding: 14px;
  }

  .sq-onboarding-caption span {
    color: var(--sq-gold-deep);
    font-family: var(--font-serif);
    font-size: 24px;
    font-style: italic;
    line-height: 1;
  }

  .sq-onboarding-caption h3 {
    margin: 0;
    font-size: clamp(18px, 2vw, 24px);
    font-weight: 400;
    line-height: 1.05;
  }

  .sq-onboarding-caption small {
    grid-column: 2;
    color: var(--sq-muted);
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .sq-onboarding-fallback {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-rows: auto 1fr;
    color: var(--sq-bg);
  }

  .sq-onboarding-window {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    padding: 10px 12px;
    border-bottom: 1px solid color-mix(in srgb, var(--sq-bg) 16%, transparent);
    background: color-mix(in srgb, var(--sq-ink) 78%, transparent);
  }

  .sq-onboarding-window i {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sq-bg) 34%, transparent);
  }

  .sq-onboarding-window span {
    width: min(46%, 160px);
    height: 7px;
    margin-inline-start: auto;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sq-bg) 18%, transparent);
  }

  .sq-onboarding-screen {
    display: grid;
    align-content: center;
    gap: 14px;
    padding: clamp(14px, 2.2vw, 24px);
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--sq-maroon) 42%, transparent), transparent 54%),
      color-mix(in srgb, var(--sq-ink) 86%, transparent);
  }

  .sq-onboarding-prompt {
    display: grid;
    gap: 8px;
  }

  .sq-onboarding-prompt span {
    width: 42px;
    height: 4px;
    border-radius: 999px;
    background: var(--sq-gold);
  }

  .sq-onboarding-prompt strong {
    color: var(--sq-bg);
    font-family: var(--font-serif);
    font-size: clamp(22px, 3vw, 34px);
    font-weight: 400;
    line-height: 1;
  }

  .sq-onboarding-options {
    display: grid;
    gap: 8px;
  }

  .sq-onboarding-options span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border: 1px solid color-mix(in srgb, var(--sq-bg) 16%, transparent);
    border-radius: 6px;
    padding: 9px 10px;
    color: color-mix(in srgb, var(--sq-bg) 76%, transparent);
    font-size: 12px;
  }

  .sq-process {
    background: var(--sq-invert-bg);
    color: var(--sq-invert-ink);
  }

  .sq-process .sq-muted,
  .sq-process .sq-kicker {
    color: var(--sq-gold);
  }

  .sq-process-grid {
    max-width: 1400px;
    margin: 0 auto;
    border-top: 1px solid color-mix(in srgb, var(--sq-invert-ink) 30%, transparent);
  }

  .sq-process-grid article {
    display: grid;
    grid-template-columns: 60px 1fr 88px;
    gap: clamp(18px, 3vw, 26px);
    padding: clamp(22px, 2.8vw, 26px) 0;
    border-bottom: 1px solid color-mix(in srgb, var(--sq-invert-ink) 20%, transparent);
    align-items: start;
  }

  .sq-process-grid p,
  .sq-process-grid small {
    color: color-mix(in srgb, var(--sq-invert-ink) 68%, transparent);
  }

  .sq-atelier {
    position: relative;
    overflow: hidden;
    background: var(--sq-maroon);
    color: var(--sq-bg);
    padding-block: clamp(40px, 5vw, 72px);
  }

  .sq-atelier > * {
    position: relative;
    z-index: 1;
    max-width: 1400px;
    margin-inline: auto;
  }

  .sq-atelier .sq-kicker {
    color: var(--sq-gold);
  }

  .sq-atelier h2 {
    color: var(--sq-bg);
  }

  .sq-atelier > p:not(.sq-kicker) {
    max-width: 720px;
    margin-top: 14px;
    color: color-mix(in srgb, var(--sq-bg) 76%, transparent);
    font-size: 18px;
    line-height: 1.55;
  }

  .sq-atelier-mark {
    position: absolute;
    z-index: 0;
    inset: auto auto -80px -70px;
    color: var(--sq-gold);
    opacity: 0.18;
  }

  [dir='rtl'] .sq-atelier-mark {
    inset: auto -70px -80px auto;
  }

  .sq-atelier-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(22px, 3vw, 30px);
    margin-top: clamp(26px, 3.2vw, 34px);
    padding-top: clamp(18px, 2.4vw, 24px);
    border-top: 1px solid color-mix(in srgb, var(--sq-bg) 36%, transparent);
  }

  .sq-atelier-grid small {
    color: var(--sq-gold);
    font-family: var(--font-serif);
    font-size: 22px;
    font-style: italic;
  }

  .sq-atelier-grid p {
    margin: 12px 0 0;
    color: var(--sq-bg);
    font-size: clamp(19px, 2vw, 21px);
    line-height: 1.38;
  }

  .sq-gcc-payments {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 0.18em;
    row-gap: 0.08em;
  }

  .sq-currency-rotator {
    display: inline-flex;
    flex-shrink: 0;
    color: var(--color-gold);
    font-family: var(--font-english);
    font-style: italic;
    line-height: 1.35;
    vertical-align: baseline;
    white-space: nowrap;
  }

  .sq-currency-rotator .text-rotate,
  .sq-currency-rotator-inner {
    display: inline-flex;
    flex-wrap: nowrap;
    align-items: baseline;
    vertical-align: baseline;
    line-height: 1.35;
    white-space: nowrap;
  }

  .sq-currency-rotator-word {
    display: inline-flex;
    overflow: hidden;
    white-space: nowrap;
    line-height: 1.35;
  }

  .sq-currency-rotator-fill {
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    -webkit-text-fill-color: transparent;
    font-weight: 600;
    white-space: nowrap;
  }

  .sq-home[dir='rtl'] .sq-currency-rotator {
    font-family: var(--font-arabic-serif);
    font-style: normal;
  }

  [data-theme='dark'] .sq-currency-rotator {
    color: #9a5f31;
  }

  /* Flag-tinted striped gradients per country (background-clip: text). */
  .sq-currency-rotator[data-country='qatari'] .sq-currency-rotator-fill {
    background-image: linear-gradient(90deg, #ffffff 0%, #ffffff 50%, #8a1538 50%, #8a1538 100%);
  }

  .sq-currency-rotator[data-country='saudi'] .sq-currency-rotator-fill {
    background-image: linear-gradient(90deg, #006c35 0%, #006c35 50%, #ffffff 50%, #ffffff 100%);
  }

  .sq-currency-rotator[data-country='bahraini'] .sq-currency-rotator-fill {
    background-image: linear-gradient(90deg, #d72027 0%, #d72027 50%, #ffffff 50%, #ffffff 100%);
  }

  .sq-currency-rotator[data-country='emirati'] .sq-currency-rotator-fill {
    background-image: linear-gradient(
      90deg,
      #ce1126 0%,
      #ce1126 25%,
      #007a3d 25%,
      #007a3d 50%,
      #ffffff 50%,
      #ffffff 75%,
      #000000 75%,
      #000000 100%
    );
  }

  .sq-currency-rotator[data-country='kuwaiti'] .sq-currency-rotator-fill {
    background-image: linear-gradient(
      90deg,
      #ce1126 0%,
      #ce1126 33.33%,
      #007a3d 33.33%,
      #007a3d 66.66%,
      #000000 66.66%,
      #000000 100%
    );
  }

  .sq-currency-rotator[data-country='omani'] .sq-currency-rotator-fill {
    background-image: linear-gradient(
      90deg,
      #d8232a 0%,
      #d8232a 33.33%,
      #ffffff 33.33%,
      #ffffff 66.66%,
      #007a3d 66.66%,
      #007a3d 100%
    );
  }

  .sq-notes {
    max-width: 1400px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(18px, 3vw, 32px);
  }

  .sq-notes article {
    border-top: 1px solid var(--sq-rule);
    padding-top: 20px;
  }

  .sq-note-art {
    height: clamp(170px, 19vw, 210px);
    margin-bottom: 18px;
    display: grid;
    place-items: center;
    color: var(--sq-gold);
    overflow: hidden;
  }

  .sq-note-1 { background: var(--sq-maroon); }
  .sq-note-2 { background: var(--sq-gold); color: var(--sq-ink); }
  .sq-note-3 { background: var(--sq-charcoal); }

  .sq-note-art svg {
    width: clamp(92px, 10vw, 128px);
    height: clamp(92px, 10vw, 128px);
    opacity: 0.7;
  }

  .sq-notes h3 {
    margin-top: 12px;
  }

  .sq-contact {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: clamp(22px, 4vw, 34px);
    padding: clamp(62px, 8vw, 104px) var(--sq-page-pad);
    background: var(--sq-charcoal);
    color: var(--sq-bg);
  }

  .sq-contact > div {
    max-width: 760px;
  }

  .sq-contact .sq-kicker {
    color: var(--sq-gold);
  }

  .sq-contact p:not(.sq-kicker) {
    margin: 16px 0 0;
    color: color-mix(in srgb, var(--sq-bg) 68%, transparent);
    font-size: 17px;
  }

  @media (max-width: 920px) {
    .sq-home-nav {
      grid-template-columns: auto auto;
    }
    .sq-nav-links {
      display: none;
    }
    .sq-hero {
      grid-template-columns: 1fr;
      min-height: auto;
      padding-block: clamp(46px, 9vw, 72px);
    }
    .sq-pillars article {
      grid-template-columns: 48px 1fr;
    }
    .sq-pillars article p,
    .sq-pillars article small {
      grid-column: 2;
    }
    .sq-onboarding-videos {
      grid-template-columns: 1fr;
    }
    .sq-atelier-grid,
    .sq-notes {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .sq-home-nav {
      padding: 10px 8px;
      gap: 8px;
    }
    .sq-wordmark-lockup {
      width: 68px;
    }
    .sq-nav-actions {
      gap: 5px;
    }
    .sq-home-nav .lg\\:hidden .rb-nav-shell > div:first-child {
      padding: 9px 10px;
    }
    .sq-home .sq-nav-cta {
      max-width: min(39vw, 142px);
      padding-inline: 11px;
    }
    .sq-hero {
      padding: 40px 14px 52px;
    }
    .sq-hero h1 {
      font-size: clamp(42px, 13vw, 62px);
      line-height: 0.94;
    }
    .sq-home[dir='rtl'] .sq-hero h1 {
      line-height: 1.08;
    }
    .sq-echo {
      margin-top: 18px;
      font-size: clamp(18px, 6vw, 26px);
    }
    .sq-hero-bottom {
      margin-top: 24px;
      gap: 20px;
    }
    .sq-hero-bottom p {
      font-size: 15px;
    }
    .sq-integrations-marquee {
      padding-block: 14px;
      gap: 8px;
    }
    .sq-integration-pill {
      width: 64px;
      height: 48px;
      border-radius: 20px;
    }
    .sq-integration-pill svg {
      width: 28px;
      height: 28px;
    }
    .sq-section,
    .sq-contact {
      padding: 56px 14px;
    }
    .sq-section-head,
    .sq-contact {
      display: block;
    }
    .sq-section-head {
      margin-bottom: 32px;
    }
    .sq-section h2,
    .sq-contact h2 {
      font-size: clamp(34px, 10vw, 50px);
      line-height: 1.04;
    }
    .sq-home[dir='rtl'] .sq-section h2,
    .sq-home[dir='rtl'] .sq-contact h2 {
      line-height: 1.12;
    }
    .sq-side-note {
      margin-top: 18px;
      font-size: 15px;
    }
    .sq-contact .sq-button {
      margin-top: 26px;
    }
    .sq-pillars article {
      gap: 14px;
      padding-block: 22px;
    }
    .sq-onboarding-caption {
      padding: 12px;
    }
    .sq-onboarding-options span {
      font-size: 11px;
    }
    .sq-process-grid article {
      grid-template-columns: 48px 1fr;
      gap: 14px;
      padding-block: 22px;
    }
    .sq-process-grid small {
      grid-column: 2;
    }
    .sq-atelier > p:not(.sq-kicker) {
      font-size: 16px;
    }
    .sq-atelier-grid {
      margin-top: 34px;
      padding-top: 24px;
    }
    .sq-note-art {
      height: 168px;
    }
    .sq-contact p:not(.sq-kicker) {
      font-size: 16px;
      line-height: 1.55;
    }
  }

  @media (max-width: 390px) {
    .sq-wordmark-lockup {
      width: 62px;
    }
    .sq-home-nav .lg\\:hidden .rb-nav-shell > div:first-child {
      gap: 6px;
      padding-inline: 8px;
    }
    .sq-nav-actions {
      gap: 4px;
    }
    .sq-home .sq-nav-cta {
      max-width: 132px;
      padding-inline: 10px;
      font-size: 12px;
    }
  }
`;
