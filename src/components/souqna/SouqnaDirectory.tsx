'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect } from 'react';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import Footer8 from '@/components/footer-8';
import HalftoneWave from '@/components/halftone-wave';
import { Navigation2 } from '@/components/navigation-2';
import { MetalFrame } from '@/components/primitives/MetalFrame';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import type { DiscoverPageData, DiscoverStorefront } from '@/lib/discover';
import type { BusinessType } from '@/lib/brief';
import type { Locale } from '@/i18n/locales';
import { LocaleToggle } from './LocaleToggle';

type Props = {
  locale: Locale;
  data: DiscoverPageData;
  ctaHref: string;
};

const businessTypeLabels: Record<BusinessType, { en: string; ar: string }> = {
  graphic_design: { en: 'Design', ar: 'تصميم' },
  clothing_store: { en: 'Fashion', ar: 'أزياء' },
  home_kitchen: { en: 'Home', ar: 'المنزل' },
  salon: { en: 'Salon', ar: 'صالون' },
  cafe: { en: 'Cafe', ar: 'مقهى' },
  ecommerce: { en: 'Ecommerce', ar: 'تجارة' },
  real_estate: { en: 'Real estate', ar: 'عقار' },
  photography: { en: 'Photography', ar: 'تصوير' },
  tutoring: { en: 'Tutoring', ar: 'تعليم' },
  fitness: { en: 'Fitness', ar: 'لياقة' },
  perfume_oud: { en: 'Perfume & oud', ar: 'عطور وعود' },
  auto_detailing: { en: 'Auto detailing', ar: 'عناية سيارات' },
  events_weddings: { en: 'Events', ar: 'مناسبات' },
  agriculture: { en: 'Agriculture', ar: 'زراعة' },
  courier_delivery: { en: 'Delivery', ar: 'توصيل' },
  contracting: { en: 'Contracting', ar: 'مقاولات' },
  art_gallery: { en: 'Art', ar: 'فن' },
  tailoring_abaya: { en: 'Tailoring', ar: 'خياطة' },
  fnb_brand: { en: 'Food brand', ar: 'مطاعم' },
  something_else: { en: 'Other', ar: 'أخرى' },
};

const copy = {
  en: {
    eyebrow: 'Souqna directory',
    title: 'Souqna',
    kicker: 'Top Websites This Week',
    intro:
      'A curated directory of live Souqna websites — storefronts, studios, services, and new Qatari brands built to be visited.',
    metricLabel: 'live websites indexed',
    featuredCount: 'weekly picks',
    top: 'Top Websites',
    topSub: 'Featured storefronts selected by Souqna, filled with the newest published websites.',
    new: 'Newly Launched',
    newSub: 'Fresh websites that recently went live on Souqna.',
    browse: 'Browse by Type',
    browseSub: 'Move through the directory by business category.',
    spotlight: 'Founder Spotlight',
    spotlightSub: 'A closer look at one website from this week’s public directory.',
    visit: 'Visit website',
    preview: 'Website preview',
    verified: 'Verified',
    souqy: 'Souqy built',
    featured: 'Featured',
    launched: 'Launched',
    domain: 'Live domain',
    emptyTitle: 'The first featured websites are being curated.',
    emptyBody:
      'Once merchants publish their storefronts, Souqna features them here automatically.',
    ctaTitle: 'Want your website featured on Souqna?',
    ctaBody:
      'Publish a polished storefront, keep it active, and Souqna can place it in the weekly discovery directory.',
    cta: 'Start or manage your website',
    ideasTitle: 'Next collections',
    ideas: ['Rising this week', 'Made in Qatar', 'Editor’s picks', 'Souqy built'],
    navProduct: 'Product',
    navResources: 'Resources',
    navPricing: 'Pricing',
    navSouqna: 'Souqna',
    navBegin: 'Begin',
    navDashboard: 'Open dashboard',
  },
  ar: {
    eyebrow: 'دليل سوقنا',
    title: 'سوقنا',
    kicker: 'أفضل المواقع هذا الأسبوع',
    intro:
      'دليل مختار لمواقع سوقنا الحيّة — متاجر، استوديوهات، خدمات، وعلامات قطرية جديدة تستحق الزيارة.',
    metricLabel: 'موقع حي في الدليل',
    featuredCount: 'اختيارات أسبوعية',
    top: 'أفضل المواقع',
    topSub: 'مواقع مختارة من سوقنا، ثم نكمل بأحدث المواقع المنشورة.',
    new: 'أُطلقت حديثاً',
    newSub: 'مواقع جديدة أصبحت حيّة مؤخراً على سوقنا.',
    browse: 'تصفّح حسب النوع',
    browseSub: 'استكشف الدليل حسب فئة النشاط.',
    spotlight: 'واجهة مؤسس',
    spotlightSub: 'نظرة أقرب على موقع من دليل هذا الأسبوع.',
    visit: 'زيارة الموقع',
    preview: 'معاينة الموقع',
    verified: 'موثّق',
    souqy: 'بُني بسوقي',
    featured: 'مختار',
    launched: 'أُطلق',
    domain: 'النطاق الحي',
    emptyTitle: 'نجهّز أول مجموعة من المواقع المختارة.',
    emptyBody: 'عندما ينشر التجار متاجرهم، سيعرضها سوقنا هنا تلقائياً.',
    ctaTitle: 'تريد أن يظهر موقعك في سوقنا؟',
    ctaBody:
      'انشر متجراً مصقولاً، حافظ على نشاطه، ويمكن لسوقنا وضعه في دليل الاكتشاف الأسبوعي.',
    cta: 'ابدأ أو أدر موقعك',
    ideasTitle: 'مجموعات قادمة',
    ideas: ['الصاعدة هذا الأسبوع', 'صُنع في قطر', 'اختيارات التحرير', 'مبني بسوقي'],
    navProduct: 'المنتج',
    navResources: 'المصادر',
    navPricing: 'الأسعار',
    navSouqna: 'سوقنا',
    navBegin: 'ابدأ',
    navDashboard: 'لوحة التحكم',
  },
} as const;

function typeLabel(type: BusinessType, locale: Locale) {
  return businessTypeLabels[type]?.[locale] ?? businessTypeLabels.something_else[locale];
}

function formatDate(date: Date | null, locale: Locale) {
  if (!date) return locale === 'ar' ? 'حديثاً' : 'Recently';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-QA' : 'en-QA', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function StorefrontMark({
  store,
  size = 44,
}: {
  store: DiscoverStorefront;
  size?: number;
}) {
  const style = store.logoUrl
    ? {
        backgroundImage: `url("${store.logoUrl}")`,
        width: size,
        height: size,
      }
    : { width: size, height: size };
  return (
    <span className="sd-mark" style={style}>
      {store.logoUrl ? null : store.businessName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function StorefrontPreview({
  store,
  locale,
}: {
  store: DiscoverStorefront;
  locale: Locale;
}) {
  const t = copy[locale];
  return (
    <div className="sd-preview" aria-label={t.preview}>
      <div className="sd-preview-chrome" aria-hidden="true">
        <span />
        <span />
        <span />
        <em>{store.domainLabel}</em>
      </div>
      <div className="sd-preview-body">
        <div className="sd-preview-head">
          <StorefrontMark store={store} size={36} />
          <div>
            <div className="sd-preview-type">{typeLabel(store.businessType, locale)}</div>
            <strong>{store.businessName}</strong>
          </div>
        </div>
        <p>{store.tagline || store.domainLabel}</p>
        <div className="sd-preview-lines" aria-hidden="true">
          <span />
          <span />
          <span style={{ width: '64%' }} />
        </div>
      </div>
    </div>
  );
}

function Badges({ store, locale }: { store: DiscoverStorefront; locale: Locale }) {
  const t = copy[locale];
  const items = [
    store.isFeatured ? t.featured : null,
    store.isVerified ? t.verified : null,
    store.isSouqyBuilt ? t.souqy : null,
  ].filter(Boolean) as string[];
  if (items.length === 0) return null;
  return (
    <div className="sd-badges" aria-label={locale === 'ar' ? 'الشارات' : 'Badges'}>
      {items.map((label) => (
        <span key={label}>{label}</span>
      ))}
    </div>
  );
}

function FeaturedCard({
  store,
  locale,
  index,
}: {
  store: DiscoverStorefront;
  locale: Locale;
  index: number;
}) {
  const t = copy[locale];
  return (
    <article className="sd-card">
      <div className="sd-card-topline">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <span>{typeLabel(store.businessType, locale)}</span>
      </div>
      <StorefrontPreview store={store} locale={locale} />
      <div className="sd-card-copy">
        <Badges store={store} locale={locale} />
        <h3>{store.businessName}</h3>
        <p>{store.tagline || store.domainLabel}</p>
      </div>
      <div className="sd-card-footer">
        <span>
          {t.launched} · {formatDate(store.publishedAt ?? store.createdAt, locale)}
        </span>
        <a href={store.liveUrl} target="_blank" rel="noreferrer">
          {t.visit}
        </a>
      </div>
    </article>
  );
}

function CompactCard({ store, locale }: { store: DiscoverStorefront; locale: Locale }) {
  const t = copy[locale];
  return (
    <article className="sd-compact-card">
      <div className="sd-compact-head">
        <StorefrontMark store={store} size={42} />
        <div className="sd-compact-headline">
          <span>{typeLabel(store.businessType, locale)}</span>
          <h3>{store.businessName}</h3>
        </div>
      </div>
      <p>{store.tagline || store.domainLabel}</p>
      <div className="sd-compact-footer">
        <small>{store.domainLabel}</small>
        <a
          href={store.liveUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${t.visit}: ${store.businessName}`}
        >
          {t.visit}
        </a>
      </div>
    </article>
  );
}

function CategoryRail({ data, locale }: { data: DiscoverPageData; locale: Locale }) {
  const t = copy[locale];
  const fallback = t.ideas.map((idea) => ({ label: idea, count: 0 }));
  const categories =
    data.categories.length > 0
      ? data.categories.map((category) => ({
          label: typeLabel(category.type, locale),
          count: category.count,
        }))
      : fallback;

  return (
    <div className="sd-category-rail" aria-label={t.browse}>
      {categories.map((category, index) => (
        <span
          key={`${category.label}-${index}`}
          className={index === 0 ? 'sd-chip sd-chip-active' : 'sd-chip'}
        >
          {category.label}
          <b>{category.count}</b>
        </span>
      ))}
    </div>
  );
}

function SpotlightCard({
  store,
  locale,
}: {
  store: DiscoverStorefront | null;
  locale: Locale;
}) {
  const t = copy[locale];

  return (
    <aside className="sd-spotlight" aria-labelledby="spotlight-title">
      <header>
        <p className="sd-eyebrow">03</p>
        <h2 id="spotlight-title">{t.spotlight}</h2>
        <p>{t.spotlightSub}</p>
      </header>

      {store ? (
        <>
          <StorefrontPreview store={store} locale={locale} />
          <div className="sd-spotlight-copy">
            <Badges store={store} locale={locale} />
            <h3>{store.businessName}</h3>
            <p>{store.tagline || store.domainLabel}</p>
          </div>
          <a href={store.liveUrl} target="_blank" rel="noreferrer" className="sd-link-cta">
            {t.visit}
          </a>
        </>
      ) : (
        <div className="sd-empty sd-empty-compact">
          <h3>{t.emptyTitle}</h3>
          <p>{t.emptyBody}</p>
        </div>
      )}
    </aside>
  );
}

export function SouqnaDirectory({ locale, data, ctaHref }: Props) {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const t = copy[locale];
  const localizedHref = (href: string) => {
    if (locale !== 'ar') return href;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('/account')) {
      return href;
    }
    return `/ar${href}`;
  };
  const docsHref = localizedHref('/docs');
  const homeHref = locale === 'ar' ? '/ar' : '/';

  const navItems =
    locale === 'ar'
      ? [
          {
            href: `${homeHref}#work`,
            label: t.navProduct,
            children: [
              { href: localizedHref('/begin'), label: 'مكان العمل', description: 'افتح مساحة العمل الأولى.' },
              { href: `${homeHref}#process`, label: 'كيف يعمل', description: 'خط سير سوقنا الكامل.' },
              { href: `${homeHref}#atelier`, label: 'استوديو الذكاء', description: 'مساحة سوقي الإبداعية.' },
              { href: localizedHref('/begin/souqy'), label: 'سوقي', description: 'مولد المتاجر بالذكاء.' },
            ],
          },
          {
            href: docsHref,
            label: t.navResources,
            children: [
              { href: localizedHref('/templates'), label: 'القوالب', description: 'تصفح قوالب المتجر الجاهزة.' },
              { href: docsHref, label: 'الدليل', description: 'اقرأ أساسيات سوقنا.' },
              { href: localizedHref('/begin'), label: 'البدء', description: 'افتح مساحة العمل الأولى.' },
            ],
          },
          { href: `${homeHref}#plans`, label: t.navPricing },
          { href: '/souqna', label: t.navSouqna },
        ]
      : [
          {
            href: '/#work',
            label: t.navProduct,
            children: [
              { href: '/begin', label: 'Workplace', description: 'Open the first workspace.' },
              { href: '/#process', label: 'How it works', description: 'The full Souqna flow.' },
              { href: '/#atelier', label: 'AI studio', description: 'Souqy creative workspace.' },
              { href: '/begin/souqy', label: 'Souqy', description: 'AI-generated storefronts.' },
            ],
          },
          {
            href: docsHref,
            label: t.navResources,
            children: [
              { href: '/templates', label: 'Templates', description: 'Browse the storefront lineup.' },
              { href: docsHref, label: 'Docs', description: 'Read the Souqna basics.' },
              { href: '/begin', label: 'Onboarding', description: 'Open the first workspace.' },
            ],
          },
          { href: '/#plans', label: t.navPricing },
          { href: '/souqna', label: t.navSouqna },
        ];

  useEffect(() => {
    document.body.classList.add('souqna-home-route');
    return () => document.body.classList.remove('souqna-home-route');
  }, []);

  const heroStore = data.spotlight ?? data.top[0] ?? data.newlyLaunched[0] ?? null;
  const marqueeItems =
    data.categories.length > 0
      ? data.categories.slice(0, 8).map((category) => typeLabel(category.type, locale))
      : t.ideas;

  return (
    <div className="sq-home sd" dir={dir}>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: directoryStyles }} />

      <Navigation2
        className="sq-home-nav sticky top-0 z-50"
        brandHref={homeHref}
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
            <LocaleToggle
              locale={locale}
              mode="public"
              publicHref={locale === 'ar' ? '/souqna' : '/ar/souqna'}
            />
            <SignedOut>
              <Link href="/sign-up" className="sq-nav-cta">
                {t.navBegin}
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/account" className="sq-nav-cta">
                {t.navDashboard}
              </Link>
            </SignedIn>
          </div>
        }
      />

      <main>
        <section className="sd-hero" aria-labelledby="souqna-discover-title">
          <HalftoneWave
            width="100%"
            height="100%"
            className="sd-hero-halftone sd-hero-halftone-light"
            speed={0.9}
            noiseScale={3.3}
            octaves={3}
            gridDensity={58}
            dotSize={0.65}
            softness={0.35}
            contrastMin={0.13}
            contrastMax={0.78}
            scrollX={0.12}
            scrollY={0.1}
            rotation={0}
            colorA="#0A0A0A"
            colorB="#5A5650"
            backgroundColor="#E8DCC4"
            opacity={0.22}
          />
          <HalftoneWave
            width="100%"
            height="100%"
            className="sd-hero-halftone sd-hero-halftone-dark"
            speed={0.86}
            noiseScale={3.3}
            octaves={3}
            gridDensity={58}
            dotSize={0.65}
            softness={0.35}
            contrastMin={0.13}
            contrastMax={0.78}
            scrollX={0.12}
            scrollY={0.1}
            rotation={0}
            colorA="#F3F3EF"
            colorB="#8B8B84"
            backgroundColor="#050505"
            opacity={0.22}
          />

          <div className="sd-hero-inner">
            <div className="sd-hero-copy">
              <p className="sd-eyebrow">
                <span />
                {t.eyebrow}
              </p>
              <h1 id="souqna-discover-title">
                <em>{t.title}</em>
              </h1>
              <p className="sd-kicker">{t.kicker}</p>
              <p className="sd-intro">{t.intro}</p>
              <div className="sd-hero-actions">
                <MetalFrame strength={0.55} borderRadius={999}>
                  <Link href={ctaHref} className="sd-button sd-button-primary">
                    {t.cta}
                  </Link>
                </MetalFrame>
                <span className="sd-hero-counter">
                  <b>{data.top.length || 0}</b>
                  {t.featuredCount}
                </span>
              </div>
            </div>

            <aside className="sd-hero-board">
              <div className="sd-meter" aria-label={`${data.totalPublished} ${t.metricLabel}`}>
                <span>{data.totalPublished}</span>
                <p>{t.metricLabel}</p>
              </div>
              {heroStore ? (
                <div className="sd-hero-preview">
                  <StorefrontPreview store={heroStore} locale={locale} />
                  <div className="sd-hero-preview-footer">
                    <span>{typeLabel(heroStore.businessType, locale)}</span>
                    <a href={heroStore.liveUrl} target="_blank" rel="noreferrer">
                      {t.visit}
                    </a>
                  </div>
                </div>
              ) : (
                <div className="sd-empty sd-empty-compact">
                  <h3>{t.emptyTitle}</h3>
                  <p>{t.emptyBody}</p>
                </div>
              )}
            </aside>
          </div>

          <div className="sd-marquee" aria-hidden="true">
            <div className="sd-marquee-track">
              {[...marqueeItems, ...marqueeItems].map((item, index) => (
                <span key={`${item}-${index}`}>{item}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="sd-section" aria-labelledby="top-websites-title">
          <div className="sd-container">
            <header className="sd-section-heading">
              <div>
                <p className="sd-eyebrow">01</p>
                <h2 id="top-websites-title">{t.top}</h2>
              </div>
              <p>{t.topSub}</p>
            </header>

            {data.top.length > 0 ? (
              <div className="sd-featured-grid">
                {data.top.map((store, index) => (
                  <FeaturedCard key={store.slug} store={store} locale={locale} index={index} />
                ))}
              </div>
            ) : (
              <div className="sd-empty">
                <h3>{t.emptyTitle}</h3>
                <p>{t.emptyBody}</p>
              </div>
            )}
          </div>
        </section>

        <section className="sd-section sd-split-section" aria-labelledby="browse-title">
          <div className="sd-container sd-split">
            <div className="sd-browse-panel">
              <header className="sd-section-heading sd-section-heading-stacked">
                <p className="sd-eyebrow">02</p>
                <h2 id="browse-title">{t.browse}</h2>
                <p>{t.browseSub}</p>
              </header>
              <CategoryRail data={data} locale={locale} />
            </div>

            <SpotlightCard store={data.spotlight} locale={locale} />
          </div>
        </section>

        <section className="sd-section" aria-labelledby="newly-launched-title">
          <div className="sd-container">
            <header className="sd-section-heading">
              <div>
                <p className="sd-eyebrow">04</p>
                <h2 id="newly-launched-title">{t.new}</h2>
              </div>
              <p>{t.newSub}</p>
            </header>

            {data.newlyLaunched.length > 0 ? (
              <div className="sd-compact-grid">
                {data.newlyLaunched.map((store) => (
                  <CompactCard key={store.slug} store={store} locale={locale} />
                ))}
              </div>
            ) : (
              <div className="sd-idea-rail" aria-label={t.ideasTitle}>
                <span>{t.ideasTitle}</span>
                {t.ideas.map((idea) => (
                  <b key={idea}>{idea}</b>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="sd-cta-section" aria-labelledby="souqna-feature-title">
          <div className="sd-container">
            <div className="sd-cta-card">
              <div>
                <p className="sd-eyebrow">05</p>
                <h2 id="souqna-feature-title">{t.ctaTitle}</h2>
                <p>{t.ctaBody}</p>
              </div>
              <MetalFrame strength={0.55} borderRadius={999}>
                <Link href={ctaHref} className="sd-button sd-button-primary">
                  {t.cta}
                </Link>
              </MetalFrame>
            </div>
          </div>
        </section>

        <Footer8 locale={locale} />
      </main>
    </div>
  );
}

const directoryStyles = `
  body.souqna-home-route [data-public-chrome],
  body:has(.sq-home) [data-public-chrome] {
    display: none !important;
  }

  .sq-home.sd {
    --sq-bg: #E8DCC4;
    --sq-paper: #E8DCC4;
    --sq-raised: rgba(42, 42, 42, 0.04);
    --sq-ink: #2A2A2A;
    --sq-muted: rgba(42, 42, 42, 0.64);
    --sq-faint: rgba(42, 42, 42, 0.1);
    --sq-charcoal: #2A2A2A;
    --sq-invert-bg: #2A2A2A;
    --sq-invert-ink: #E8DCC4;
    --sq-rule: rgba(42, 42, 42, 0.18);
    --sq-glass: rgba(232, 220, 196, 0.72);
    --sq-page-pad: clamp(18px, 4vw, 52px);
    --sq-section-y: clamp(64px, 8vw, 112px);
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

  [data-theme='dark'] .sq-home.sd {
    --sq-bg: #2A2A2A;
    --sq-paper: #2A2A2A;
    --sq-raised: rgba(232, 220, 196, 0.05);
    --sq-ink: #E8DCC4;
    --sq-muted: rgba(232, 220, 196, 0.66);
    --sq-faint: rgba(232, 220, 196, 0.12);
    --sq-charcoal: #E8DCC4;
    --sq-invert-bg: #E8DCC4;
    --sq-invert-ink: #2A2A2A;
    --sq-rule: rgba(232, 220, 196, 0.2);
    --sq-glass: rgba(42, 42, 42, 0.72);
  }

  .sq-home.sd[dir='rtl'] {
    font-family: var(--font-arabic);
    font-weight: 600;
  }

  .sq-home.sd[dir='rtl'] :where(a, button, p, span, small, h1, h2, h3, h4, li, em) {
    font-family: var(--font-arabic);
    font-weight: 600;
  }

  .sq-home.sd * { box-sizing: border-box; }
  .sq-home.sd a { color: inherit; }

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
    background: var(--sq-glass) !important;
    border-color: var(--sq-rule) !important;
    box-shadow:
      0 1px 0 color-mix(in srgb, var(--sq-ink) 5%, transparent) inset,
      0 18px 60px color-mix(in srgb, var(--sq-ink) 10%, transparent);
  }

  .sq-home-nav .rb-nav-link {
    color: var(--sq-muted) !important;
  }

  .sq-home-nav .rb-nav-link:hover {
    color: var(--sq-ink) !important;
  }

  .sq-home-nav .rb-nav-dropdown {
    background: var(--sq-glass) !important;
    border-color: var(--sq-rule) !important;
  }

  .sq-home-nav .rb-nav-dropdown a {
    color: var(--sq-ink) !important;
  }

  .sq-home-nav .rb-nav-dropdown a:hover {
    background: color-mix(in srgb, var(--sq-ink) 6%, transparent) !important;
  }

  .sq-wordmark-lockup {
    display: block;
    width: 84px;
    height: auto;
    object-fit: contain;
    filter: brightness(0) saturate(100%);
  }

  html[data-theme='dark'] .sq-wordmark-lockup {
    filter: brightness(0) saturate(100%) invert(1) !important;
  }

  .sq-nav-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sq-home.sd .sq-nav-cta {
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
    transition: transform 160ms ease, background-color 160ms ease;
  }
  .sq-home.sd .sq-nav-cta:hover {
    transform: translateY(-1px);
  }

  /* ─── Hero ─── */
  .sd-hero {
    position: relative;
    padding: clamp(120px, 16vh, 200px) var(--sq-page-pad) clamp(60px, 8vw, 96px);
    overflow: hidden;
    border-bottom: 1px solid var(--sq-rule);
  }

  .sd-hero-halftone {
    position: absolute !important;
    inset: 0;
    z-index: 0;
    pointer-events: none;
  }

  .sd-hero-halftone-dark { display: none; }
  [data-theme='dark'] .sd-hero-halftone-light { display: none; }
  [data-theme='dark'] .sd-hero-halftone-dark { display: block; }

  .sd-hero-inner {
    position: relative;
    z-index: 1;
    margin: 0 auto;
    max-width: 1200px;
    display: grid;
    gap: clamp(36px, 5vw, 60px);
    grid-template-columns: minmax(0, 1fr);
    align-items: end;
  }

  @media (min-width: 980px) {
    .sd-hero-inner {
      grid-template-columns: minmax(0, 1.15fr) minmax(320px, 460px);
    }
  }

  .sd-eyebrow {
    margin: 0 0 14px;
    color: var(--sq-muted);
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }
  .sd-eyebrow > span:first-child {
    display: inline-block;
    width: 22px;
    height: 1px;
    background: var(--sq-ink);
    opacity: 0.6;
  }

  .sd-hero h1 {
    margin: 0;
    font-family: var(--font-serif);
    font-size: clamp(64px, 11vw, 132px);
    line-height: 0.9;
    font-weight: 400;
    letter-spacing: -0.02em;
  }
  .sd-hero h1 em {
    font-style: normal;
    color: var(--sq-ink);
  }

  .sd-kicker {
    width: fit-content;
    margin: 22px 0 0;
    border: 1px solid var(--sq-rule);
    border-radius: 999px;
    padding: 6px 14px;
    color: var(--sq-ink);
    font-size: 12.5px;
    letter-spacing: 0.02em;
    background: color-mix(in srgb, var(--sq-paper) 60%, transparent);
  }

  .sd-intro {
    max-width: 56ch;
    margin: 18px 0 0;
    color: var(--sq-muted);
    font-size: clamp(15px, 1.4vw, 17px);
    line-height: 1.6;
  }

  .sd-hero-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
    margin-top: 26px;
  }

  .sd-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    padding: 13px 22px;
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    transition: transform 160ms ease;
    white-space: nowrap;
  }
  .sd-button:hover { transform: translateY(-1px); }

  .sd-button-primary {
    background: var(--sq-invert-bg);
    color: var(--sq-invert-ink);
    border: 1px solid var(--sq-invert-bg);
  }

  .sd-hero-counter {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    color: var(--sq-muted);
    font-size: 12.5px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-family: var(--font-mono);
  }
  .sd-hero-counter b {
    font-family: var(--font-serif);
    color: var(--sq-ink);
    font-size: 22px;
    font-weight: 500;
  }

  .sd-hero-board {
    display: grid;
    gap: 18px;
    align-content: end;
  }

  .sd-meter {
    border: 1px solid var(--sq-rule);
    border-radius: 18px;
    padding: 22px;
    background: color-mix(in srgb, var(--sq-paper) 72%, transparent);
    backdrop-filter: blur(14px);
    display: grid;
    gap: 4px;
  }
  .sd-meter > span {
    font-family: var(--font-serif);
    font-size: 56px;
    line-height: 1;
    letter-spacing: -0.02em;
    color: var(--sq-ink);
  }
  .sd-meter p {
    margin: 0;
    color: var(--sq-muted);
    font-size: 12px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-family: var(--font-mono);
  }

  .sd-hero-preview {
    border: 1px solid var(--sq-rule);
    border-radius: 18px;
    overflow: hidden;
    background: color-mix(in srgb, var(--sq-paper) 88%, transparent);
    backdrop-filter: blur(14px);
  }

  .sd-hero-preview-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-top: 1px solid var(--sq-rule);
    font-size: 12px;
    color: var(--sq-muted);
  }
  .sd-hero-preview-footer a {
    color: var(--sq-ink);
    text-decoration: none;
    font-weight: 500;
  }
  .sd-hero-preview-footer a:hover { text-decoration: underline; }

  /* ─── Marquee ─── */
  .sd-marquee {
    position: relative;
    z-index: 1;
    margin-top: clamp(40px, 6vw, 64px);
    border-top: 1px solid var(--sq-rule);
    border-bottom: 1px solid var(--sq-rule);
    overflow: hidden;
  }
  .sd-marquee-track {
    display: flex;
    gap: 36px;
    padding: 16px 0;
    width: max-content;
    animation: sd-marquee 38s linear infinite;
    color: var(--sq-muted);
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 11.5px;
  }
  @keyframes sd-marquee {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }
  [dir='rtl'] .sd-marquee-track {
    animation-direction: reverse;
  }

  /* ─── Sections ─── */
  .sd-section {
    position: relative;
    padding: var(--sq-section-y) var(--sq-page-pad);
  }

  .sd-container {
    width: 100%;
    max-width: 1200px;
    margin-inline: auto;
  }

  .sd-section-heading {
    display: grid;
    gap: 12px;
    align-items: end;
    margin-bottom: clamp(28px, 4vw, 44px);
  }
  @media (min-width: 720px) {
    .sd-section-heading {
      grid-template-columns: minmax(0, 1fr) minmax(0, 320px);
      gap: 24px;
    }
  }
  .sd-section-heading h2 {
    margin: 6px 0 0;
    font-family: var(--font-serif);
    font-size: clamp(32px, 4vw, 52px);
    line-height: 1.04;
    font-weight: 400;
    letter-spacing: -0.01em;
  }
  .sd-section-heading p {
    margin: 0;
    color: var(--sq-muted);
    font-size: 14.5px;
    line-height: 1.5;
  }
  .sd-section-heading-stacked {
    display: block;
    grid-template-columns: none;
  }
  .sd-section-heading-stacked h2 {
    margin-top: 6px;
  }
  .sd-section-heading-stacked p {
    margin-top: 12px;
  }

  /* ─── Featured grid ─── */
  .sd-featured-grid {
    display: grid;
    gap: clamp(18px, 2.4vw, 26px);
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }

  .sd-card {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 18px;
    border: 1px solid var(--sq-rule);
    border-radius: 20px;
    background: color-mix(in srgb, var(--sq-paper) 88%, transparent);
    transition: transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
  }
  .sd-card:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--sq-ink) 24%, transparent);
    box-shadow: 0 22px 50px color-mix(in srgb, var(--sq-ink) 12%, transparent);
  }
  .sd-card-topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--sq-muted);
  }
  .sd-card-copy h3 {
    margin: 8px 0 6px;
    font-family: var(--font-serif);
    font-size: 22px;
    font-weight: 500;
    line-height: 1.15;
    color: var(--sq-ink);
  }
  .sd-card-copy p {
    margin: 0;
    color: var(--sq-muted);
    font-size: 13.5px;
    line-height: 1.5;
  }
  .sd-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
    padding-top: 14px;
    border-top: 1px solid var(--sq-rule);
    font-size: 12.5px;
    color: var(--sq-muted);
  }
  .sd-card-footer a {
    text-decoration: none;
    color: var(--sq-ink);
    font-weight: 500;
    border-bottom: 1px solid color-mix(in srgb, var(--sq-ink) 32%, transparent);
    padding-bottom: 1px;
  }
  .sd-card-footer a:hover {
    border-bottom-color: var(--sq-ink);
  }

  .sd-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .sd-badges span {
    display: inline-block;
    border: 1px solid var(--sq-rule);
    border-radius: 999px;
    padding: 2px 9px;
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--sq-muted);
    background: color-mix(in srgb, var(--sq-paper) 64%, transparent);
  }

  /* ─── Preview chrome ─── */
  .sd-preview {
    border: 1px solid var(--sq-rule);
    border-radius: 14px;
    overflow: hidden;
    background: color-mix(in srgb, var(--sq-paper) 70%, transparent);
  }
  .sd-preview-chrome {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--sq-rule);
    background: color-mix(in srgb, var(--sq-paper) 56%, transparent);
  }
  .sd-preview-chrome span {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sq-ink) 22%, transparent);
  }
  .sd-preview-chrome em {
    margin-inline-start: 8px;
    font-style: normal;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--sq-muted);
    letter-spacing: 0.02em;
    direction: ltr;
  }
  .sd-preview-body {
    padding: 16px;
    display: grid;
    gap: 12px;
  }
  .sd-preview-head {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .sd-preview-head strong {
    display: block;
    font-family: var(--font-serif);
    font-size: 18px;
    font-weight: 500;
    color: var(--sq-ink);
  }
  .sd-preview-type {
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--sq-muted);
  }
  .sd-preview-body p {
    margin: 0;
    color: var(--sq-muted);
    font-size: 13px;
    line-height: 1.5;
  }
  .sd-preview-lines {
    display: grid;
    gap: 6px;
  }
  .sd-preview-lines span {
    display: block;
    width: 100%;
    height: 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sq-ink) 9%, transparent);
  }

  .sd-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background:
      color-mix(in srgb, var(--sq-ink) 8%, transparent) center / cover no-repeat;
    color: var(--sq-ink);
    font-family: var(--font-serif);
    font-size: 18px;
    font-weight: 500;
    flex-shrink: 0;
  }

  /* ─── Browse split ─── */
  .sd-split-section {
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--sq-ink) 4%, transparent), transparent 320px),
      transparent;
  }
  .sd-split {
    display: grid;
    gap: clamp(32px, 5vw, 56px);
  }
  @media (min-width: 980px) {
    .sd-split {
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 380px);
    }
  }

  .sd-category-rail {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 8px;
  }
  .sd-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    border-radius: 999px;
    border: 1px solid var(--sq-rule);
    background: color-mix(in srgb, var(--sq-paper) 64%, transparent);
    color: var(--sq-ink);
    font-size: 13px;
    cursor: default;
    transition: border-color 160ms ease, background 160ms ease;
  }
  .sd-chip:hover {
    border-color: color-mix(in srgb, var(--sq-ink) 30%, transparent);
  }
  .sd-chip b {
    color: var(--sq-muted);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
  }
  .sd-chip-active {
    background: var(--sq-invert-bg);
    color: var(--sq-invert-ink);
    border-color: var(--sq-invert-bg);
  }
  .sd-chip-active b {
    color: color-mix(in srgb, var(--sq-invert-ink) 70%, transparent);
  }

  .sd-spotlight {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 22px;
    border: 1px solid var(--sq-rule);
    border-radius: 22px;
    background: color-mix(in srgb, var(--sq-paper) 84%, transparent);
  }
  .sd-spotlight header h2 {
    margin: 4px 0 6px;
    font-family: var(--font-serif);
    font-size: 26px;
    font-weight: 500;
    color: var(--sq-ink);
  }
  .sd-spotlight header p {
    margin: 0;
    color: var(--sq-muted);
    font-size: 13.5px;
    line-height: 1.5;
  }
  .sd-spotlight-copy h3 {
    margin: 8px 0 6px;
    font-family: var(--font-serif);
    font-size: 22px;
    font-weight: 500;
    color: var(--sq-ink);
  }
  .sd-spotlight-copy p {
    margin: 0;
    color: var(--sq-muted);
    font-size: 13px;
    line-height: 1.5;
  }
  .sd-link-cta {
    align-self: flex-start;
    margin-top: 8px;
    color: var(--sq-ink);
    text-decoration: none;
    font-weight: 500;
    font-size: 13.5px;
    border-bottom: 1px solid color-mix(in srgb, var(--sq-ink) 32%, transparent);
    padding-bottom: 1px;
  }
  .sd-link-cta:hover { border-bottom-color: var(--sq-ink); }

  /* ─── Newly launched ─── */
  .sd-compact-grid {
    display: grid;
    gap: clamp(16px, 2.4vw, 22px);
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }
  .sd-compact-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px;
    border: 1px solid var(--sq-rule);
    border-radius: 18px;
    background: color-mix(in srgb, var(--sq-paper) 78%, transparent);
    transition: transform 200ms ease, border-color 200ms ease;
  }
  .sd-compact-card:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--sq-ink) 22%, transparent);
  }
  .sd-compact-head {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .sd-compact-headline span {
    display: block;
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--sq-muted);
  }
  .sd-compact-headline h3 {
    margin: 4px 0 0;
    font-family: var(--font-serif);
    font-size: 19px;
    font-weight: 500;
    color: var(--sq-ink);
  }
  .sd-compact-card p {
    margin: 0;
    color: var(--sq-muted);
    font-size: 13.5px;
    line-height: 1.5;
  }
  .sd-compact-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--sq-rule);
    font-size: 12.5px;
    color: var(--sq-muted);
  }
  .sd-compact-footer small {
    font-family: var(--font-mono);
    direction: ltr;
  }
  .sd-compact-footer a {
    color: var(--sq-ink);
    text-decoration: none;
    font-weight: 500;
    border-bottom: 1px solid color-mix(in srgb, var(--sq-ink) 32%, transparent);
    padding-bottom: 1px;
  }
  .sd-compact-footer a:hover { border-bottom-color: var(--sq-ink); }

  .sd-idea-rail {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    padding: 18px;
    border: 1px dashed var(--sq-rule);
    border-radius: 16px;
    color: var(--sq-muted);
    font-size: 13px;
  }
  .sd-idea-rail span {
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-size: 11px;
  }
  .sd-idea-rail b {
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--sq-rule);
    background: color-mix(in srgb, var(--sq-paper) 70%, transparent);
    color: var(--sq-ink);
    font-weight: 500;
    font-size: 13px;
  }

  /* ─── Empty ─── */
  .sd-empty {
    padding: 36px;
    border: 1px dashed var(--sq-rule);
    border-radius: 18px;
    text-align: center;
    color: var(--sq-muted);
    background: color-mix(in srgb, var(--sq-paper) 50%, transparent);
  }
  .sd-empty h3 {
    margin: 0 0 8px;
    font-family: var(--font-serif);
    font-size: 20px;
    font-weight: 500;
    color: var(--sq-ink);
  }
  .sd-empty p { margin: 0; font-size: 14px; }
  .sd-empty-compact {
    padding: 22px;
    border-radius: 16px;
  }

  /* ─── CTA section ─── */
  .sd-cta-section {
    padding: clamp(48px, 6vw, 80px) var(--sq-page-pad) clamp(72px, 9vw, 120px);
  }
  .sd-cta-card {
    display: grid;
    gap: 20px;
    padding: clamp(30px, 4vw, 48px);
    border: 1px solid var(--sq-rule);
    border-radius: 24px;
    background: var(--sq-invert-bg);
    color: var(--sq-invert-ink);
    align-items: center;
  }
  @media (min-width: 820px) {
    .sd-cta-card {
      grid-template-columns: minmax(0, 1fr) auto;
    }
  }
  .sd-cta-card h2 {
    margin: 8px 0 8px;
    font-family: var(--font-serif);
    font-size: clamp(26px, 3vw, 38px);
    font-weight: 400;
    line-height: 1.1;
    color: var(--sq-invert-ink);
  }
  .sd-cta-card .sd-eyebrow {
    color: color-mix(in srgb, var(--sq-invert-ink) 72%, transparent);
  }
  .sd-cta-card .sd-eyebrow > span:first-child {
    background: var(--sq-invert-ink);
    opacity: 0.5;
  }
  .sd-cta-card p {
    margin: 0;
    color: color-mix(in srgb, var(--sq-invert-ink) 78%, transparent);
    font-size: 14.5px;
    line-height: 1.5;
    max-width: 56ch;
  }
  .sd-cta-card .sd-button-primary {
    background: var(--sq-invert-ink);
    color: var(--sq-invert-bg);
    border-color: var(--sq-invert-ink);
  }

  /* ─── Mobile tuning ─── */
  @media (max-width: 720px) {
    .sd-hero h1 { font-size: clamp(48px, 14vw, 78px); }
    .sd-card { padding: 16px; }
    .sd-section-heading h2 { font-size: clamp(28px, 7vw, 38px); }
  }
`;
