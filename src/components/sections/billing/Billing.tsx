'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { startCheckout } from '@/app/actions/billing';
import { Eyebrow } from '@/components/primitives/Eyebrow';
import { SubscriptionTrackerCard } from '@/components/billing/SubscriptionTrackerCard';
import { getSubscriptionStatus, type SubscriptionStatus } from '@/app/actions/billing';
import { Reveal } from '@/components/motion/Reveal';
import { parseHeadline } from '@/lib/headline';
import {
  ANNUAL_DISCOUNT_PCT,
  PLAN_LIMITS,
  planLabel,
  priceFor,
  type BillingCycle,
  type Plan,
} from '@/lib/plans';
import type { Locale } from '@/i18n/locales';

/**
 * SkipCash billing section.
 *
 * Rendered immediately after `<Pricing>` on the home page so a visitor
 * who's chosen a tier on the marketing cards can complete checkout on
 * SkipCash's hosted page. Secrets stay server-side; this component only
 * receives the resulting redirect URL.
 */

type Props = {
  locale: Locale;
};

const PAID_PLANS = ['starter', 'pro', 'atelier'] as const;
type PaidPlan = (typeof PAID_PLANS)[number];

type CopyT = {
  eyebrow: string;
  headline: string;
  sub: string;
  pickerLabel: string;
  monthly: string;
  annual: string;
  save: string;
  perMonth: string;
  paymentNote: string;
  activating: string;
  activatingHint: string;
  success: (label: string) => string;
  backToDashboard: string;
  fallbackTitle: string;
  fallbackBody: string;
  fallbackCta: string;
  secured: string;
  needSignIn: string;
  genericError: string;
};

const COPY: { en: CopyT; ar: CopyT } = {
  en: {
    eyebrow: 'BILLING · الفوترة',
    headline: 'Pay securely. {Launch faster.}',
    sub:
      'Checkout opens on SkipCash, then your plan activates automatically — monthly or annual, your call.',
    pickerLabel: 'Choose your tier',
    monthly: 'Monthly',
    annual: 'Annual',
    save: `Save ${ANNUAL_DISCOUNT_PCT}%`,
    perMonth: 'QR · per month',
    paymentNote: 'Billed in QAR through SkipCash · يحتسب بالريال القطري',
    activating: 'Opening SkipCash…',
    activatingHint: "We're creating your secure payment link.",
    success: (label: string) => `You're now on ${label} · Thank you.`,
    backToDashboard: 'Open dashboard',
    fallbackTitle: 'Still not activated?',
    fallbackBody:
      'SkipCash did not open. Please try again or contact support if the payment was already completed.',
    fallbackCta: 'Open SkipCash checkout',
    secured: 'Secured by SkipCash · مؤمّن من SkipCash',
    needSignIn: 'Sign in to continue',
    genericError: 'Could not start checkout — please try again.',
  },
  ar: {
    eyebrow: 'BILLING · الفوترة',
    headline: 'ادفع بأمان. {وانطلق أسرع.}',
    sub:
      'الدفع يفتح عبر SkipCash، وخطتك تتفعّل تلقائياً — شهرياً أو سنوياً، الاختيار لك.',
    pickerLabel: 'اختر الباقة',
    monthly: 'شهرياً',
    annual: 'سنوياً',
    save: `وفّر ${ANNUAL_DISCOUNT_PCT}٪`,
    perMonth: 'ر.ق · شهرياً',
    paymentNote: 'يحتسب بالريال القطري عبر SkipCash · Billed in QAR',
    activating: 'نفتح SkipCash…',
    activatingHint: 'ننشئ رابط الدفع الآمن.',
    success: (label: string) => `أنت الآن على ${label} · شكراً لك.`,
    backToDashboard: 'افتح لوحة التحكم',
    fallbackTitle: 'لم يتم التفعيل بعد؟',
    fallbackBody:
      'لم يفتح SkipCash. حاول مرة أخرى أو تواصل معنا إذا تم الدفع بالفعل.',
    fallbackCta: 'افتح دفع SkipCash',
    secured: 'مؤمّن من SkipCash · Secured by SkipCash',
    needSignIn: 'سجّل الدخول للمتابعة',
    genericError: 'تعذّر بدء الدفع — حاول مرة أخرى.',
  },
} as const;

export function Billing({ locale }: Props) {
  const isRtl = locale === 'ar';
  const t = COPY[isRtl ? 'ar' : 'en'];

  const [plan, setPlan] = useState<PaidPlan>('pro');
  const [cycle, setCycle] = useState<BillingCycle>('annual');
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);

  // Initial subscription fetch — silent if signed-out (action returns
  // the `none` sentinel). Re-fetches on the cross-tab event are
  // handled inside `<SubscriptionTrackerCard>` itself.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await getSubscriptionStatus();
        if (!cancelled) setSubscription(res);
      } catch {
        // best-effort — not signed in or backend not yet deployed.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [phase, setPhase] = useState<
    | { kind: 'idle' }
    | { kind: 'creating' }
    | { kind: 'success'; plan: Plan }
    | { kind: 'error'; message: string; offerFallback: boolean }
  >({ kind: 'idle' });

  // Read `#billing?plan=pro&cycle=annual` (or plain query) on mount so
  // the marketing pricing cards can deep-link a chosen tier.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = readBillingParams();
    if (params.plan && (PAID_PLANS as readonly string[]).includes(params.plan)) {
      setPlan(params.plan as PaidPlan);
    }
    if (params.cycle === 'monthly' || params.cycle === 'annual') {
      setCycle(params.cycle);
    }
  }, []);

  const monthlyQar = priceFor(plan, cycle);

  const onSkipCashCheckout = useCallback(async () => {
    setPhase({ kind: 'creating' });
    const res = await startCheckout({ plan, cycle });
    if (res.status === 'redirect' || res.status === 'sign_in') {
      window.location.href = res.url;
      return;
    }
    setPhase({ kind: 'error', message: t.genericError, offerFallback: false });
  }, [plan, cycle, t.genericError]);

  return (
    <section
      id="billing"
      style={{
        background:
          'linear-gradient(180deg, var(--surface-bg, #f6efe3) 0%, var(--surface-elevated, #efe6d5) 100%)',
        padding: 'clamp(72px, 10vw, 120px) clamp(20px, 4vw, 48px)',
      }}
    >
      <div className="mx-auto" style={{ maxWidth: 760 }}>
        <header style={{ marginBottom: 32, textAlign: isRtl ? 'right' : 'left' }}>
          <Reveal>
            <Eyebrow tone="maroon">{t.eyebrow}</Eyebrow>
          </Reveal>
          <Reveal delay={120}>
            <h2
              className="m-0 mt-6 text-balance text-[color:var(--ink-strong)]"
              style={{
                fontFamily: isRtl
                  ? 'var(--font-arabic), var(--font-sans)'
                  : 'var(--font-sans)',
                fontWeight: isRtl ? 500 : 400,
                fontSize: 'clamp(30px, 4vw, 56px)',
                lineHeight: isRtl ? 1.2 : 1,
                letterSpacing: isRtl ? '-0.005em' : '-0.03em',
              }}
            >
              {parseHeadline(t.headline, {
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
              className="m-0 mt-5 max-w-[55ch] text-[color:var(--ink-muted)]"
              style={{
                fontFamily: isRtl
                  ? 'var(--font-arabic), var(--font-sans)'
                  : 'var(--font-sans)',
                fontSize: 'clamp(15px, 1.2vw, 17px)',
                lineHeight: isRtl ? 1.7 : 1.55,
              }}
            >
              {t.sub}
            </p>
          </Reveal>
        </header>

        {subscription && subscription.status !== 'none' ? (
          <div style={{ marginBottom: 24 }}>
            <SubscriptionTrackerCard initial={subscription} locale={isRtl ? 'ar' : 'en'} />
          </div>
        ) : null}

        <div
          style={{
            background: 'var(--surface-card, #fdfaf3)',
            border:
              '1px solid color-mix(in srgb, var(--color-gold-deep, #a8893f) 32%, transparent)',
            borderRadius: 18,
            padding: 'clamp(20px, 3vw, 32px)',
            boxShadow:
              '0 1px 0 color-mix(in srgb, var(--color-gold-deep, #a8893f) 14%, transparent), 0 30px 60px -40px color-mix(in srgb, var(--color-gold-deep, #a8893f) 50%, transparent)',
          }}
        >
          <TierPicker plan={plan} onChange={setPlan} isRtl={isRtl} t={t} />

          <CycleToggle value={cycle} onChange={setCycle} isRtl={isRtl} t={t} />

          <PricePreview qar={monthlyQar} isRtl={isRtl} t={t} />

          <div
            style={{
              marginTop: 20,
              padding: 14,
              borderRadius: 12,
              border:
                '1px solid color-mix(in srgb, var(--color-gold-deep, #a8893f) 28%, transparent)',
              background:
                'color-mix(in srgb, var(--color-gold-deep, #a8893f) 5%, var(--surface-bg, #f6efe3))',
              minHeight: 80,
            }}
          >
            {phase.kind === 'success' ? (
              <SuccessState plan={phase.plan} isRtl={isRtl} t={t} />
            ) : phase.kind === 'creating' ? (
              <ActivatingState isRtl={isRtl} t={t} />
            ) : (
              <HostedOnlyButton onClick={onSkipCashCheckout} t={t} />
            )}
          </div>

          {phase.kind === 'error' ? (
            <FallbackBlock
              message={phase.message}
              offerFallback={phase.offerFallback}
              onClick={onSkipCashCheckout}
              isRtl={isRtl}
              t={t}
            />
          ) : null}

          <p
            style={{
              margin: '14px 0 0',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--ink-faint, #8a7e6a)',
              textAlign: 'center',
            }}
          >
            {t.secured}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function TierPicker({
  plan,
  onChange,
  isRtl,
  t,
}: {
  plan: PaidPlan;
  onChange: (next: PaidPlan) => void;
  isRtl: boolean;
  t: CopyT;
}) {
  return (
    <div>
      <p
        style={{
          margin: 0,
          marginBottom: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        {t.pickerLabel}
      </p>
      <div
        role="tablist"
        aria-label={t.pickerLabel}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 8,
        }}
      >
        {PAID_PLANS.map((id) => {
          const active = id === plan;
          const limits = PLAN_LIMITS[id];
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(id)}
              style={{
                padding: '12px 10px',
                borderRadius: 10,
                cursor: 'pointer',
                background: active
                  ? 'var(--ink-strong, #1f1b16)'
                  : 'var(--surface-bg, #f6efe3)',
                color: active
                  ? 'var(--color-gold, #c9a961)'
                  : 'var(--ink-strong, #1f1b16)',
                border: active
                  ? '1px solid var(--ink-strong, #1f1b16)'
                  : '1px solid color-mix(in srgb, var(--ink-strong) 14%, transparent)',
                fontFamily: isRtl
                  ? 'var(--font-arabic-serif), var(--font-arabic), serif'
                  : 'var(--font-serif), serif',
                fontWeight: 500,
                fontSize: 15,
                transition: 'all 200ms ease',
              }}
            >
              {isRtl ? limits.labelAr : limits.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CycleToggle({
  value,
  onChange,
  isRtl,
  t,
}: {
  value: BillingCycle;
  onChange: (next: BillingCycle) => void;
  isRtl: boolean;
  t: CopyT;
}) {
  const tabs: Array<{ id: BillingCycle; label: string; chip?: string }> = [
    { id: 'monthly', label: t.monthly },
    { id: 'annual', label: t.annual, chip: t.save },
  ];
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        marginTop: 18,
        marginBottom: 18,
      }}
    >
      <div
        role="tablist"
        aria-label="Billing cycle"
        style={{
          display: 'inline-flex',
          gap: 4,
          padding: 4,
          borderRadius: 999,
          background:
            'color-mix(in srgb, var(--ink-strong) 5%, var(--surface-bg))',
          border:
            '1px solid color-mix(in srgb, var(--ink-strong) 10%, transparent)',
        }}
      >
        {tabs.map((tab) => {
          const active = tab.id === value;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: 999,
                border: 'none',
                background: active ? 'var(--ink-strong)' : 'transparent',
                color: active ? '#fff' : 'var(--ink-muted)',
                cursor: 'pointer',
                fontFamily: isRtl
                  ? 'var(--font-arabic), var(--font-mono)'
                  : 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'background 200ms ease, color 200ms ease',
              }}
            >
              <span>{tab.label}</span>
              {tab.chip ? (
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: active
                      ? 'rgba(201,169,97,0.95)'
                      : 'color-mix(in srgb, var(--color-gold-deep) 18%, transparent)',
                    color: active ? '#1f1b16' : 'var(--color-gold-deep)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.14em',
                    fontWeight: 600,
                  }}
                >
                  {tab.chip}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PricePreview({
  qar,
  isRtl,
  t,
}: {
  qar: number;
  isRtl: boolean;
  t: CopyT;
}) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '14px 0 6px',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: isRtl
              ? 'var(--font-arabic-serif), var(--font-arabic), serif'
              : 'var(--font-serif), serif',
            fontWeight: 500,
            fontSize: 'clamp(34px, 5vw, 48px)',
            color: 'var(--ink-strong)',
            letterSpacing: '-0.01em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {isRtl
            ? `${qar.toLocaleString()} ر.ق`
            : `QR ${qar.toLocaleString()}`}
        </span>
        <span
          style={{
            fontSize: 12,
            color: 'var(--ink-muted)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.06em',
          }}
        >
          / {isRtl ? 'شهرياً' : 'month'}
        </span>
      </div>
      <p
        style={{
          margin: '6px 0 0',
          fontSize: 11,
          color: 'var(--ink-faint, #8a7e6a)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.04em',
        }}
      >
        {t.paymentNote}
      </p>
    </div>
  );
}

function ActivatingState({
  isRtl,
  t,
}: {
  isRtl: boolean;
  t: CopyT;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '12px 8px',
        textAlign: 'center',
      }}
    >
      <Spinner />
      <p
        style={{
          margin: 0,
          fontFamily: isRtl
            ? 'var(--font-arabic-serif), serif'
            : 'var(--font-serif), serif',
          fontStyle: 'italic',
          fontSize: 16,
          color: 'var(--ink-strong)',
        }}
      >
        {t.activating}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: 'var(--ink-muted)',
          fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
        }}
      >
        {t.activatingHint}
      </p>
    </div>
  );
}

function SuccessState({
  plan,
  isRtl,
  t,
}: {
  plan: Plan;
  isRtl: boolean;
  t: CopyT;
}) {
  const dashHref = isRtl ? '/ar/account' : '/account';
  const label = isRtl ? PLAN_LIMITS[plan].labelAr : planLabel(plan);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: '4px 8px',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: isRtl
            ? 'var(--font-arabic-serif), serif'
            : 'var(--font-serif), serif',
          fontStyle: 'italic',
          fontSize: 18,
          color: 'var(--ink-strong)',
        }}
      >
        {t.success(label)}
      </p>
      <a
        href={dashHref}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 22px',
          borderRadius: 999,
          background: 'var(--color-gold, #c9a961)',
          color: 'var(--ink-on-gold, var(--ink-strong))',
          textDecoration: 'none',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 600,
          border: '1px solid var(--color-gold)',
        }}
      >
        {t.backToDashboard}
        <span aria-hidden>→</span>
      </a>
    </div>
  );
}

function FallbackBlock({
  message,
  offerFallback,
  onClick,
  isRtl,
  t,
}: {
  message: string;
  offerFallback: boolean;
  onClick: () => void;
  isRtl: boolean;
  t: CopyT;
}) {
  return (
    <div
      role="alert"
      style={{
        marginTop: 14,
        padding: 12,
        borderRadius: 10,
        background:
          'color-mix(in srgb, var(--color-maroon, #8B3A3A) 6%, transparent)',
        border:
          '1px solid color-mix(in srgb, var(--color-maroon, #8B3A3A) 22%, transparent)',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: 'var(--color-maroon, #8B3A3A)',
          fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
        }}
      >
        <strong style={{ marginInlineEnd: 6 }}>{t.fallbackTitle}</strong>
        {message}
      </p>
      {offerFallback ? (
        <button
          type="button"
          onClick={onClick}
          style={{
            marginTop: 10,
            padding: '8px 14px',
            borderRadius: 999,
            background: 'transparent',
            border: '1px solid var(--color-maroon, #8B3A3A)',
            color: 'var(--color-maroon, #8B3A3A)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {t.fallbackCta}
        </button>
      ) : null}
    </div>
  );
}

function HostedOnlyButton({
  onClick,
  t,
}: {
  onClick: () => void;
  t: CopyT;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        padding: '14px 20px',
        borderRadius: 999,
        background: 'var(--ink-strong, #1f1b16)',
        color: 'var(--color-gold, #c9a961)',
        border: '1px solid var(--ink-strong)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      {t.fallbackCta}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        border: '2px solid color-mix(in srgb, var(--color-gold-deep) 30%, transparent)',
        borderTopColor: 'var(--color-gold-deep, #a8893f)',
        animation: 'souqna-billing-spin 800ms linear infinite',
        display: 'inline-block',
      }}
    >
      <style>{`@keyframes souqna-billing-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

function readBillingParams(): { plan?: string; cycle?: string } {
  if (typeof window === 'undefined') return {};
  const out: { plan?: string; cycle?: string } = {};
  // Support either `?plan=&cycle=#billing` or `#billing?plan=&cycle=`.
  const sp = new URLSearchParams(window.location.search);
  if (sp.get('plan')) out.plan = sp.get('plan') ?? undefined;
  if (sp.get('cycle')) out.cycle = sp.get('cycle') ?? undefined;
  const hash = window.location.hash || '';
  const q = hash.indexOf('?');
  if (q > -1) {
    const hp = new URLSearchParams(hash.slice(q + 1));
    if (hp.get('plan')) out.plan = hp.get('plan') ?? undefined;
    if (hp.get('cycle')) out.cycle = hp.get('cycle') ?? undefined;
  }
  return out;
}
