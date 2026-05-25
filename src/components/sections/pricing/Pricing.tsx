'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import type { Locale } from '@/i18n/locales';
import type { Copy } from '@/content/copy';
import { Eyebrow } from '@/components/primitives/Eyebrow';
import { Reveal } from '@/components/motion/Reveal';
import { parseHeadline } from '@/lib/headline';
import {
  ANNUAL_DISCOUNT_PCT,
  annualSavingsFor,
  PLAN_LIMITS,
  PLANS,
  priceFor,
  type BillingCycle,
  type Plan,
} from '@/lib/plans';

type Props = {
  locale: Locale;
  copy: Copy;
};

const TAGLINE: Record<Plan, { en: string; ar: string }> = {
  free: {
    en: 'Launch a branded starter storefront with clear growth limits.',
    ar: 'ولّد أول متجر لك وأطلق الأساسيات.',
  },
  starter: {
    en: 'The conversion plan for merchants ready to sell seriously.',
    ar: 'أطلق متاجر أكثر مع نطاق خاص ودعم.',
  },
  pro: {
    en: 'Scale with Souqy, AI generation, team tools, and marketing apps.',
    ar: 'أضف سوقي، أصول الذكاء، نصوص المنتجات، وتطبيقات النمو.',
  },
  atelier: {
    en: 'Run agencies, operators, and multi-brand commerce workspaces.',
    ar: 'وسّع التشغيل بذكاء متقدم وتكاملات ومقاعد فريق.',
  },
};

const FEATURES_EN: Record<Plan, { intro: string; bullets: string[] }> = {
  free: {
    intro: "What's included:",
    bullets: [
      '1 storefront',
      '10 products',
      '1 template',
      '25 orders per month',
      'Souqna branding locked',
      '5% transaction fee',
      'Upgrade to unlock growth tools',
    ],
  },
  starter: {
    intro: 'Everything in Free:',
    bullets: [
      '2 storefronts',
      'Unlimited products',
      '5 templates',
      'Custom domain',
      'Remove branding',
      'Basic analytics',
      'WhatsApp integration',
      'Discount codes + SEO settings',
      '100 AI credits per month',
      '3% transaction fee',
      'Email support',
    ],
  },
  pro: {
    intro: 'Everything in Pro:',
    bullets: [
      '8 storefronts',
      'Souqy AI operator',
      'AI branding assets',
      'EN + AR AI generation',
      'Marketing apps',
      'Meta/TikTok integrations',
      'Team members',
      'Automation flows',
      'Premium templates and builder blocks',
      'Advanced analytics',
      '1% transaction fee',
      'Priority support',
    ],
  },
  atelier: {
    intro: 'Everything in Pro+:',
    bullets: [
      'Unlimited storefronts',
      'Team workspace',
      'Client permissions',
      'White-label tools',
      'API access',
      'Advanced analytics AI',
      'Bulk operations',
      'Advanced SEO AI',
      'Early access features',
      '0% transaction fee',
      'Dedicated support',
    ],
  },
};

const FEATURES_AR: Record<Plan, { intro: string; bullets: string[] }> = {
  free: {
    intro: 'يشمل:',
    bullets: [
      'متجر واحد',
      '٣ قوالب بدائية',
      'أداة البناء كاملة',
      'متجر ثنائي اللغة',
      'نطاق فرعي — yourbrand.souqna.qa',
    ],
  },
  starter: {
    intro: 'كل اللي في مجاني:',
    bullets: [
      'متجران',
      '٥ قوالب تجارة',
      'نطاق مخصص — yourbrand.com',
      'دعم بالبريد والدردشة',
    ],
  },
  pro: {
    intro: 'كل اللي في برو:',
    bullets: [
      '٨ متاجر',
      'أصول هوية وتسويق بالذكاء الاصطناعي',
      'مشغّل سوقي الذكي',
      'نصوص منتجات بالعربي والإنجليزي',
      'إضافات التسويق والتحليلات',
      'دعم واتساب',
    ],
  },
  atelier: {
    intro: 'كل اللي في برو +:',
    bullets: [
      'متاجر بلا حدود',
      'كل البلوكات المميزة',
      'ذكاء التسعير و SEO المتقدم',
      'دفعات شهرية',
      'دعم الفريق',
    ],
  },
};

export function Pricing({ locale, copy }: Props) {
  const isRtl = locale === 'ar';
  const beginHref = locale === 'en' ? '/begin' : `/${locale}/begin`;
  const t = copy.pricing;
  const [cycle, setCycle] = useState<BillingCycle>('annual');

  return (
    <section
      id="pricing"
      className="relative overflow-hidden bg-[color:var(--surface-elevated)]"
      style={{ padding: 'clamp(72px, 10vw, 132px) var(--gutter)' }}
    >
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-[color:var(--surface-rule)]" />
      <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col items-center">
        <header className="mx-auto mb-12 max-w-[900px] text-center">
          <Reveal>
            <Eyebrow tone="maroon">{t.eyebrow}</Eyebrow>
          </Reveal>
          <Reveal delay={120}>
            <h2
              className="m-0 mt-6 text-balance text-[color:var(--ink-strong)]"
              style={{
                fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
                fontWeight: isRtl ? 500 : 400,
                fontSize: 'clamp(36px, 5vw, 72px)',
                lineHeight: isRtl ? 1.2 : 0.95,
              }}
            >
              {parseHeadline(t.title, {
                accentStyle: {
                  fontFamily: isRtl
                    ? 'var(--font-arabic-serif), serif'
                    : 'var(--font-serif), serif',
                  fontStyle: 'italic',
                  fontWeight: 400,
                  color: 'var(--color-maroon)',
                },
              })}
            </h2>
          </Reveal>
          <Reveal delay={240}>
            <p
              className="mx-auto mb-0 mt-5 max-w-[66ch] text-[color:var(--ink-muted)]"
              style={{
                fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
                fontSize: 'clamp(16px, 1.35vw, 19px)',
                lineHeight: isRtl ? 1.75 : 1.55,
              }}
            >
              {t.sub}
            </p>
          </Reveal>
        </header>

        <CycleToggle value={cycle} onChange={setCycle} isRtl={isRtl} />

        <motion.div
          className="souqna-pricing-grid mt-10 grid w-full items-center gap-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.08, delayChildren: 0.08 },
            },
          }}
        >
          {PLANS.map((id) => (
            <PlanCard
              key={id}
              id={id}
              cycle={cycle}
              isRtl={isRtl}
              currency={t.currency}
              ctaLabel={t.ctaLabel}
              featuredLabel={t.featuredLabel}
              beginHref={beginHref}
            />
          ))}
        </motion.div>

        <Reveal delay={380}>
          <p
            className="mx-auto mb-0 mt-8 max-w-[760px] text-center text-[color:var(--ink-faint)]"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              lineHeight: 1.6,
              textTransform: 'uppercase',
            }}
          >
            {t.finePrint}
          </p>
        </Reveal>
      </div>

      <style jsx global>{`
        .souqna-pricing-grid {
          grid-template-columns: 1fr;
        }
        @media (min-width: 720px) {
          .souqna-pricing-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 1120px) {
          .souqna-pricing-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
      `}</style>
    </section>
  );
}

function CycleToggle({
  value,
  onChange,
  isRtl,
}: {
  value: BillingCycle;
  onChange: (next: BillingCycle) => void;
  isRtl: boolean;
}) {
  const tabs: Array<{ id: BillingCycle; label: string }> = [
    { id: 'monthly', label: isRtl ? 'شهرياً' : 'Monthly' },
    { id: 'annual', label: isRtl ? `سنوياً · وفّر ${ANNUAL_DISCOUNT_PCT}٪` : `Annual · Save ${ANNUAL_DISCOUNT_PCT}%` },
  ];

  return (
    <div className="flex items-center justify-center">
      <div
        role="tablist"
        aria-label={isRtl ? 'دورة الفوترة' : 'Billing cycle'}
        className="relative flex w-[min(100%,20rem)] items-center rounded-full border border-[color:var(--surface-rule-strong)] bg-[color:var(--surface-bg)] p-1"
      >
        <motion.div
          aria-hidden
          className="absolute bottom-1 top-1 w-[calc(50%-0.25rem)] rounded-full bg-[color:var(--color-maroon)] shadow-sm"
          style={{ insetInlineStart: '0.25rem' }}
          animate={{ x: value === 'monthly' ? '0%' : isRtl ? '-100%' : '100%' }}
          transition={{ type: 'spring', stiffness: 500, damping: 36, mass: 0.8 }}
        />
        {tabs.map((tab) => {
          const active = tab.id === value;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className="relative z-10 flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent px-3 py-2 text-center transition-colors duration-200"
              style={{
                color: active ? 'var(--ink-on-accent)' : 'var(--ink-muted)',
                fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-mono)',
                fontSize: isRtl ? 12 : 11,
                fontWeight: active ? 700 : 500,
                textTransform: isRtl ? 'none' : 'uppercase',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlanCard({
  id,
  cycle,
  isRtl,
  currency,
  ctaLabel,
  featuredLabel,
  beginHref,
}: {
  id: Plan;
  cycle: BillingCycle;
  isRtl: boolean;
  currency: string;
  ctaLabel: string;
  featuredLabel: string;
  beginHref: string;
}) {
  const plan = PLAN_LIMITS[id];
  const isFree = id === 'free';
  const isFeatured = id === 'pro';
  const isMax = id === 'atelier';
  const price = priceFor(id, cycle);
  const features = (isRtl ? FEATURES_AR : FEATURES_EN)[id];
  const reduced = useReducedMotion();

  return (
    <motion.article
      variants={{
        hidden: { opacity: 0, y: reduced ? 0 : 24 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
        },
      }}
      className="relative flex min-h-[620px] flex-col overflow-hidden rounded-lg p-5"
      style={{
        background: isFeatured
          ? 'linear-gradient(180deg, color-mix(in srgb, var(--color-gold) 28%, var(--surface-bg)) 0%, var(--surface-bg) 58%)'
          : isMax
            ? 'linear-gradient(180deg, color-mix(in srgb, var(--color-charcoal) 8%, var(--surface-bg)) 0%, var(--surface-card, var(--surface-bg)) 100%)'
            : 'var(--surface-card, var(--surface-bg))',
        border: isFeatured
          ? '1px solid color-mix(in srgb, var(--color-gold-deep) 42%, transparent)'
          : '1px solid var(--surface-rule)',
        boxShadow: isFeatured
          ? '0 26px 70px -42px color-mix(in srgb, var(--color-gold-deep) 70%, transparent)'
          : 'var(--shadow-card)',
        transform: isFeatured ? 'translateY(-14px)' : undefined,
        color: 'var(--ink-strong)',
      }}
    >
      {isFeatured ? (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-[color:var(--color-maroon)]"
        />
      ) : null}
      <div className="relative z-10 mb-4 flex items-start justify-between gap-3">
        <div>
          <p
            className="m-0 text-[color:var(--ink-muted)]"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            Souqna
          </p>
          <h3
            className="m-0 mt-2 text-[color:var(--ink-strong)]"
            style={{
              fontFamily: isRtl
                ? 'var(--font-arabic-serif), var(--font-arabic), serif'
                : 'var(--font-serif), serif',
              fontSize: 30,
              fontWeight: 500,
              lineHeight: 1,
            }}
          >
            {isRtl ? plan.labelAr : plan.label}
          </h3>
        </div>
        {isFeatured ? <Badge>{featuredLabel}</Badge> : isMax ? <Badge muted>Scale</Badge> : null}
      </div>

      <div className="relative z-10 mb-4 flex items-baseline gap-2">
        <span
          className="text-[color:var(--ink-strong)]"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'clamp(38px, 4vw, 50px)',
            fontWeight: 600,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {isFree ? (isRtl ? 'مجاني' : 'Free') : price.toLocaleString()}
        </span>
        {!isFree ? (
          <span className="text-[color:var(--ink-muted)]" style={{ fontSize: 13 }}>
            {currency} / {isRtl ? 'شهر' : 'mo'}
          </span>
        ) : null}
      </div>

      <p
        className="relative z-10 m-0 mb-6 text-[color:var(--ink-muted)]"
        style={{
          fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
          fontSize: 14,
          lineHeight: isRtl ? 1.75 : 1.55,
          minHeight: 44,
        }}
      >
        {isRtl ? TAGLINE[id].ar : TAGLINE[id].en}
      </p>

      <PlanCardCta
        plan={id}
        cycle={cycle}
        isFeatured={isFeatured}
        ctaLabel={ctaLabel}
        beginHref={beginHref}
      />

      {!isFree ? (
        <p
          className="relative z-10 m-0 mt-4 text-[color:var(--ink-faint)]"
          style={{
            fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-mono)',
            fontSize: isRtl ? 11 : 10,
            lineHeight: 1.5,
            textTransform: isRtl ? 'none' : 'uppercase',
          }}
        >
          {cycle === 'annual'
            ? isRtl
              ? `يوفّر ${annualSavingsFor(id).toLocaleString()} ${currency} سنوياً`
              : `Saves ${annualSavingsFor(id).toLocaleString()} ${currency} yearly`
            : isRtl
              ? `${priceFor(id, 'annual').toLocaleString()} ${currency}/شهر عند الدفع سنوياً`
              : `${priceFor(id, 'annual').toLocaleString()} ${currency}/mo when billed yearly`}
        </p>
      ) : null}

      <div className="relative z-10 mt-8 flex flex-1 flex-col gap-4">
        <p
          className="m-0 text-[color:var(--ink-strong)]"
          style={{
            fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {features.intro}
        </p>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {features.bullets.map((feature) => (
            <FeatureRow key={feature} featured={isFeatured} isRtl={isRtl}>
              {feature}
            </FeatureRow>
          ))}
        </ul>
      </div>
    </motion.article>
  );
}

function FeatureRow({
  featured,
  isRtl,
  children,
}: {
  featured: boolean;
  isRtl: boolean;
  children: ReactNode;
}) {
  return (
    <li
      className="flex items-center gap-3 text-[color:var(--ink-muted)]"
      style={{
        fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
        fontSize: 13.5,
        lineHeight: isRtl ? 1.7 : 1.45,
      }}
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
        style={{
          background: featured ? 'var(--color-maroon)' : 'var(--ink-strong)',
          color: featured ? 'var(--ink-on-accent)' : 'var(--surface-bg)',
        }}
      >
        <Check aria-hidden size={12} strokeWidth={3} />
      </span>
      <span>{children}</span>
    </li>
  );
}

function PlanCardCta({
  plan,
  cycle,
  isFeatured,
  ctaLabel,
  beginHref,
}: {
  plan: Plan;
  cycle: BillingCycle;
  isFeatured: boolean;
  ctaLabel: string;
  beginHref: string;
}) {
  const sharedStyle: CSSProperties = {
    minHeight: 48,
    borderRadius: 8,
    background: isFeatured ? 'var(--color-maroon)' : 'var(--color-gold)',
    color: isFeatured ? 'var(--ink-on-accent)' : 'var(--ink-on-gold)',
    border: isFeatured ? '1px solid var(--color-maroon)' : '1px solid var(--color-gold-deep)',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    textDecoration: 'none',
    width: '100%',
  };

  if (plan === 'free') {
    return (
      <Link
        href={`${beginHref}?tier=free`}
        className="relative z-10 inline-flex items-center justify-center gap-2 transition-transform duration-200 hover:scale-[1.02]"
        style={sharedStyle}
      >
        <span>{ctaLabel}</span>
        <span aria-hidden className="rtl-flip-arrow">
          →
        </span>
      </Link>
    );
  }

  const href = `#billing?plan=${plan}&cycle=${cycle}`;
  const onClick = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (typeof window === 'undefined') return;
    history.replaceState(null, '', href);
    document.getElementById('billing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <a
      href={href}
      onClick={onClick}
      className="relative z-10 inline-flex items-center justify-center gap-2 transition-transform duration-200 hover:scale-[1.02]"
      style={sharedStyle}
    >
      <span>{ctaLabel}</span>
      <span aria-hidden className="rtl-flip-arrow">
        →
      </span>
    </a>
  );
}

function Badge({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className="rounded-full px-3 py-1"
      style={{
        background: muted
          ? 'color-mix(in srgb, var(--ink-strong) 8%, transparent)'
          : 'color-mix(in srgb, var(--color-maroon) 14%, transparent)',
        color: muted ? 'var(--ink-muted)' : 'var(--color-maroon)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
