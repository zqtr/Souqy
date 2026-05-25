'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { getSubscriptionStatus, type SubscriptionStatus } from '@/app/actions/billing';
import { PLAN_LIMITS, type Plan } from '@/lib/plans';

/** Cross-tab + same-tab event fired after a successful
 *  billing activation. Listened to here so the tracker block reflects
 *  the new tier without a manual refresh. */
export const SUBSCRIPTION_CHANGED_EVENT = 'souqna:subscription-changed';

type Locale = 'en' | 'ar';

type Active = Exclude<SubscriptionStatus, { status: 'none'; plan: 'free' }>;

const STATUS_TONE: Record<Active['status'], 'gold' | 'ink' | 'maroon'> = {
  active: 'gold',
  pending: 'ink',
  cancelled: 'maroon',
  suspended: 'maroon',
  expired: 'maroon',
  failed: 'maroon',
};

const COPY = {
  en: {
    eyebrow: 'YOUR SUBSCRIPTION · اشتراكك',
    nextBilling: 'Next billing',
    lastPayment: 'Last payment',
    amount: 'Amount',
    card: 'Card',
    paymentAccount: 'SkipCash payment',
    activity: 'Activity',
    manage: 'View plans',
    daysRemaining: 'days remaining',
    dayRemaining: 'day remaining',
    periodUsed: 'period used',
    renews: 'Renews',
    expires: 'Expires',
    noRenewalDate: 'Billing date pending',
    movedFrom: (from: string, to: string) => `Moved from ${from} → ${to}`,
    subscribed: (to: string) => `Subscribed to ${to}`,
    none: '—',
    cycle: { monthly: 'monthly', annual: 'annual' } as const,
    status: {
      active: 'Active',
      pending: 'Pending',
      cancelled: 'Cancelled',
      suspended: 'Suspended',
      expired: 'Expired',
      failed: 'Payment failed',
    } as Record<Active['status'], string>,
  },
  ar: {
    eyebrow: 'YOUR SUBSCRIPTION · اشتراكك',
    nextBilling: 'الفوترة القادمة',
    lastPayment: 'آخر دفعة',
    amount: 'المبلغ',
    card: 'البطاقة',
    paymentAccount: 'دفعة SkipCash',
    activity: 'النشاط',
    manage: 'عرض الباقات',
    daysRemaining: 'يوم متبقي',
    dayRemaining: 'يوم واحد متبقي',
    periodUsed: 'من الفترة مستخدم',
    renews: 'يتجدد',
    expires: 'ينتهي',
    noRenewalDate: 'تاريخ الفوترة قيد التحديث',
    movedFrom: (from: string, to: string) => `انتقل من ${from} إلى ${to}`,
    subscribed: (to: string) => `اشتركت في ${to}`,
    none: '—',
    cycle: { monthly: 'شهرياً', annual: 'سنوياً' } as const,
    status: {
      active: 'فعّال',
      pending: 'قيد التفعيل',
      cancelled: 'ملغى',
      suspended: 'موقوف مؤقتاً',
      expired: 'منتهي',
      failed: 'فشل الدفع',
    } as Record<Active['status'], string>,
  },
} as const;

export function SubscriptionTrackerCard({
  initial,
  locale,
}: {
  initial: SubscriptionStatus;
  locale: Locale;
}) {
  const [data, setData] = useState<SubscriptionStatus>(initial);

  // Listen for activation events emitted by Billing.tsx and refetch.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => {
      void (async () => {
        try {
          const next = await getSubscriptionStatus();
          setData(next);
        } catch {
          // best-effort
        }
      })();
    };
    window.addEventListener(SUBSCRIPTION_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener(SUBSCRIPTION_CHANGED_EVENT, onChange);
    };
  }, []);

  if (data.status === 'none') return null;

  return <Card data={data} locale={locale} />;
}

function Card({ data, locale }: { data: Active; locale: Locale }) {
  const isAr = locale === 'ar';
  const t = COPY[locale];
  const reduce = useReducedMotion();
  const tone = STATUS_TONE[data.status];

  const planLabel = PLAN_LIMITS[data.plan as Plan]?.label ?? data.plan;
  const cycleLabel = data.cycle ? t.cycle[data.cycle] : null;

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(isAr ? 'ar-QA' : 'en-GB', {
        dateStyle: 'medium',
      }),
    [isAr],
  );

  const formatDate = (iso: string | null) => {
    if (!iso) return t.none;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return t.none;
    return dateFmt.format(d);
  };

  const totalAmount = useMemo(() => {
    const multiplier = data.cycle === 'annual' ? 12 : 1;
    const amount = (data.effectivePriceQar ?? 0) * multiplier;
    const formatted = new Intl.NumberFormat(isAr ? 'ar-QA' : 'en-GB', {
      maximumFractionDigits: 0,
    }).format(amount);
    return isAr ? `${formatted} ر.ق` : `QAR ${formatted}`;
  }, [data.cycle, data.effectivePriceQar, isAr]);

  const cardLine =
    data.cardBrand && data.cardLast4 ? `${data.cardBrand} ····  ${data.cardLast4}` : null;

  const period = useMemo(() => getPeriodState(data), [data]);

  const periodEndLabel =
    data.status === 'cancelled' ||
    data.status === 'expired' ||
    data.status === 'suspended' ||
    data.status === 'failed'
      ? t.expires
      : t.renews;

  const periodEndDate = data.currentPeriodEnd ?? data.nextBillingTime ?? null;

  const sectionStyle: CSSProperties = {
    background: 'var(--surface-card, var(--surface-bg, #f6efe3))',
    border: '1px solid color-mix(in srgb, var(--admin-accent, #b58a3a) 32%, transparent)',
    borderRadius: 18,
    padding: 'clamp(20px, 3vw, 28px)',
    boxShadow: '0 1px 0 color-mix(in srgb, var(--admin-accent, #b58a3a) 14%, transparent)',
    direction: isAr ? 'rtl' : 'ltr',
  };

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={sectionStyle}
      aria-label={isAr ? 'اشتراكك' : 'Your subscription'}
    >
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--admin-accent, #b58a3a)',
        }}
      >
        {t.eyebrow}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: 20,
          alignItems: 'center',
          marginTop: 10,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontFamily: isAr
                ? 'var(--font-arabic-serif), var(--font-arabic), serif'
                : 'var(--font-serif), serif',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 'clamp(22px, 2.8vw, 32px)',
              lineHeight: 1.15,
              color: 'var(--ink-strong)',
            }}
          >
            {planLabel}
            {cycleLabel ? (
              <>
                <span aria-hidden style={{ opacity: 0.45, margin: '0 8px' }}>
                  ·
                </span>
                <span style={{ fontSize: '0.78em' }}>{cycleLabel}</span>
              </>
            ) : null}
          </h3>

          <div style={{ marginTop: 12 }}>
            <StatusPill tone={tone} label={t.status[data.status]} />
          </div>
        </div>

        <PeriodRing period={period} copy={t} locale={locale} />
      </div>

      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '14px 24px',
          margin: '24px 0 0',
          padding: 0,
        }}
      >
        <Field
          label={periodEndDate ? periodEndLabel : t.noRenewalDate}
          value={formatDate(periodEndDate)}
        />
        <Field label={t.nextBilling} value={formatDate(data.nextBillingTime)} />
        <Field label={t.lastPayment} value={formatDate(data.lastPaymentAt)} />
        <Field label={t.amount} value={totalAmount} />
        <Field label={t.card} value={cardLine ?? t.paymentAccount} mono={Boolean(cardLine)} />
      </dl>

      <ActivityDisclosure history={data.history} locale={locale} copy={t} />

      <div
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: '1px solid color-mix(in srgb, var(--ink-strong) 10%, transparent)',
          textAlign: isAr ? 'left' : 'right',
        }}
      >
        <a
          href="/#plans"
          style={{
            fontSize: 12.5,
            color: 'var(--color-maroon, #7a2230)',
            textDecoration: 'underline',
            textDecorationThickness: 1,
            textUnderlineOffset: 3,
          }}
        >
          {t.manage} →
        </a>
      </div>
    </motion.section>
  );
}

type PeriodState = {
  daysRemaining: number | null;
  percentRemaining: number;
  percentUsed: number;
  tone: 'gold' | 'ink' | 'maroon';
};

function PeriodRing({
  period,
  copy,
  locale,
}: {
  period: PeriodState;
  copy: (typeof COPY)[Locale];
  locale: Locale;
}) {
  const isAr = locale === 'ar';
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - period.percentRemaining);
  const formattedDays =
    period.daysRemaining === null
      ? '—'
      : new Intl.NumberFormat(isAr ? 'ar-QA' : 'en-GB', {
          maximumFractionDigits: 0,
        }).format(period.daysRemaining);
  const dayLabel = period.daysRemaining === 1 ? copy.dayRemaining : copy.daysRemaining;
  const ariaLabel =
    period.daysRemaining === null
      ? copy.noRenewalDate
      : `${formattedDays} ${dayLabel}, ${period.percentUsed}% ${copy.periodUsed}`;
  const toneColor =
    period.tone === 'maroon'
      ? 'var(--color-maroon, #7a2230)'
      : period.tone === 'ink'
        ? 'var(--ink-strong)'
        : 'var(--admin-accent, #b58a3a)';

  return (
    <div
      aria-label={ariaLabel}
      role="img"
      style={{
        width: 132,
        height: 132,
        borderRadius: 999,
        display: 'grid',
        placeItems: 'center',
        position: 'relative',
        flexShrink: 0,
        background:
          'radial-gradient(circle, color-mix(in srgb, var(--surface-bg) 82%, transparent) 58%, transparent 59%)',
      }}
    >
      <svg
        width="132"
        height="132"
        viewBox="0 0 132 132"
        aria-hidden
        style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
      >
        <circle
          cx="66"
          cy="66"
          r={radius}
          fill="none"
          stroke="color-mix(in srgb, var(--ink-strong) 10%, transparent)"
          strokeWidth="10"
        />
        <circle
          cx="66"
          cy="66"
          r={radius}
          fill="none"
          stroke={toneColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: 'stroke-dashoffset 420ms ease, stroke 240ms ease',
            filter:
              'drop-shadow(0 6px 14px color-mix(in srgb, var(--admin-accent, #b58a3a) 16%, transparent))',
          }}
        />
      </svg>
      <div style={{ textAlign: 'center', color: 'var(--ink-strong)' }}>
        <strong
          style={{
            display: 'block',
            fontFamily: 'var(--font-mono)',
            fontSize: 34,
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formattedDays}
        </strong>
        <span
          style={{
            display: 'block',
            maxWidth: 84,
            marginTop: 7,
            fontSize: 10.5,
            lineHeight: 1.15,
            color: 'var(--ink-muted)',
            fontWeight: 700,
          }}
        >
          {period.daysRemaining === null ? copy.noRenewalDate : dayLabel}
        </span>
      </div>
    </div>
  );
}

function getPeriodState(data: Active): PeriodState {
  const endIso = data.currentPeriodEnd ?? data.nextBillingTime;
  const endTime = endIso ? new Date(endIso).getTime() : Number.NaN;
  if (!Number.isFinite(endTime)) {
    return {
      daysRemaining: null,
      percentRemaining: 0,
      percentUsed: 0,
      tone: data.status === 'pending' ? 'ink' : STATUS_TONE[data.status],
    };
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = data.cycle === 'annual' ? 365 : 30;
  const rawRemaining = Math.ceil((endTime - Date.now()) / dayMs);
  const daysRemaining = Math.max(0, rawRemaining);
  const percentRemaining = Math.max(0, Math.min(1, daysRemaining / totalDays));
  const percentUsed = Math.round((1 - percentRemaining) * 100);

  let tone: PeriodState['tone'] = STATUS_TONE[data.status];
  if (daysRemaining <= 0 || data.status === 'expired' || data.status === 'failed') {
    tone = 'maroon';
  } else if (daysRemaining <= 7) {
    tone = 'ink';
  }

  return {
    daysRemaining,
    percentRemaining,
    percentUsed,
    tone,
  };
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <dt
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: '4px 0 0',
          fontSize: 14,
          color: 'var(--ink-strong)',
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans), system-ui, sans-serif',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </dd>
    </div>
  );
}

function StatusPill({ tone, label }: { tone: 'gold' | 'ink' | 'maroon'; label: string }) {
  const map = {
    gold: {
      bg: 'color-mix(in srgb, var(--color-gold, #c9a24a) 20%, transparent)',
      border: 'color-mix(in srgb, var(--admin-accent, #b58a3a) 45%, transparent)',
      fg: 'var(--ink-strong)',
    },
    ink: {
      bg: 'color-mix(in srgb, var(--ink-strong) 8%, transparent)',
      border: 'color-mix(in srgb, var(--ink-strong) 22%, transparent)',
      fg: 'var(--ink-strong)',
    },
    maroon: {
      bg: 'color-mix(in srgb, var(--color-maroon, #7a2230) 14%, transparent)',
      border: 'color-mix(in srgb, var(--color-maroon, #7a2230) 45%, transparent)',
      fg: 'var(--color-maroon, #7a2230)',
    },
  } as const;
  const c = map[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.fg,
        fontSize: 11.5,
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: 'currentColor',
          opacity: 0.7,
        }}
      />
      {label}
    </span>
  );
}

function ActivityDisclosure({
  history,
  locale,
  copy,
}: {
  history: Active['history'];
  locale: Locale;
  copy: (typeof COPY)[Locale];
}) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  if (history.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 20,
        paddingTop: 16,
        borderTop: '1px solid color-mix(in srgb, var(--ink-strong) 10%, transparent)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-strong)',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            transition: 'transform 200ms',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          ▸
        </span>
        {copy.activity} · <span lang="ar">النشاط</span>
        <span style={{ opacity: 0.5, fontWeight: 400 }}>({history.length})</span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.ol
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{
              listStyle: 'none',
              margin: '14px 0 0',
              padding: 0,
              overflow: 'hidden',
              position: 'relative',
              paddingInlineStart: 16,
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: 8,
                bottom: 8,
                insetInlineStart: 5,
                width: 1,
                background: 'color-mix(in srgb, var(--admin-accent, #b58a3a) 28%, transparent)',
              }}
            />
            {history.map((h) => (
              <HistoryRow key={h.id} entry={h} locale={locale} copy={copy} />
            ))}
          </motion.ol>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function HistoryRow({
  entry,
  locale,
  copy,
}: {
  entry: Active['history'][number];
  locale: Locale;
  copy: (typeof COPY)[Locale];
}) {
  const isAr = locale === 'ar';
  const fromLabel = entry.fromPlan
    ? (PLAN_LIMITS[entry.fromPlan as Plan]?.label ?? entry.fromPlan)
    : null;
  const toLabel = PLAN_LIMITS[entry.toPlan as Plan]?.label ?? entry.toPlan;
  const text = fromLabel ? copy.movedFrom(fromLabel, toLabel) : copy.subscribed(toLabel);
  const rel = formatRelative(entry.createdAt, isAr ? 'ar-QA' : 'en');

  return (
    <li
      style={{
        position: 'relative',
        padding: '6px 0 6px 14px',
        paddingInlineStart: 14,
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          insetInlineStart: -4,
          top: 12,
          width: 6,
          height: 6,
          borderRadius: 999,
          background: 'var(--color-gold, #c9a24a)',
        }}
      />
      <span
        style={{
          fontSize: 13,
          color: 'var(--ink-strong)',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          color: 'var(--ink-muted)',
          whiteSpace: 'nowrap',
        }}
      >
        {rel}
      </span>
    </li>
  );
}

function formatRelative(iso: string, locale: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffSec = Math.round((then - Date.now()) / 1000);
  let value = diffSec;
  let unit: Intl.RelativeTimeFormatUnit = 'second';
  const abs = (n: number) => Math.abs(n);
  if (abs(value) >= 60) {
    value = Math.round(value / 60);
    unit = 'minute';
  }
  if (abs(value) >= 60 && unit === 'minute') {
    value = Math.round(value / 60);
    unit = 'hour';
  }
  if (abs(value) >= 24 && unit === 'hour') {
    value = Math.round(value / 24);
    unit = 'day';
  }
  if (abs(value) >= 30 && unit === 'day') {
    value = Math.round(value / 30);
    unit = 'month';
  }
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit);
  } catch {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(value, unit);
  }
}
