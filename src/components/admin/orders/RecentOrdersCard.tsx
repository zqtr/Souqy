'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { markOrderPaid, markOrderRefunded } from '@/app/actions/checkout';
import type { Order, OrderStatus, PaymentStatus } from '@/lib/checkout-orders';
import { adminPhrase } from '@/components/admin/adminLocale';

type Props = {
  storeSlug: string;
  orders: Order[];
  limit?: number;
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'pending',
  confirmed: 'confirmed',
  preparing: 'preparing',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'unpaid',
  marked_paid: 'paid',
  payment_failed: 'failed',
  refunded: 'refunded',
};

export function RecentOrdersCard({ storeSlug, orders, limit = 5 }: Props) {
  const rows = orders.slice(0, limit);
  const locale = useLocale();
  const t = (text: string) => adminPhrase(locale, text);

  return (
    <section
      aria-label={t('Recent orders')}
      style={{
        position: 'relative',
        marginBottom: 20,
        borderRadius: 18,
        padding: 1,
        background:
          'linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(212,212,216,0.55) 50%, rgba(255,255,255,0.85) 100%)',
        boxShadow:
          '0 1px 2px rgba(15,23,42,0.04), 0 20px 48px -24px rgba(15,23,42,0.18)',
      }}
    >
      <div
        style={{
          borderRadius: 17,
          background:
            'linear-gradient(180deg, color-mix(in srgb, #ffffff 92%, transparent) 0%, color-mix(in srgb, #ffffff 78%, transparent) 100%)',
          backdropFilter: 'blur(14px) saturate(140%)',
          WebkitBackdropFilter: 'blur(14px) saturate(140%)',
          padding: '20px 22px',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 14,
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#71717a',
                marginBottom: 4,
              }}
            >
              {t('Recent · live')}
            </div>
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--font-serif, var(--font-sans))',
                fontSize: 20,
                fontWeight: 600,
                color: '#18181b',
                letterSpacing: '-0.01em',
              }}
            >
              {t('Quick actions')}
            </h2>
          </div>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: '#71717a',
              letterSpacing: '0.06em',
            }}
          >
            {rows.length.toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-US')} {t('of')} {orders.length.toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-US')}
          </span>
        </header>

        {rows.length === 0 ? (
          <div
            style={{
              padding: '32px 22px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.55)',
              border: '1px dashed rgba(161,161,170,0.4)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#a1a1aa',
                marginBottom: 8,
              }}
            >
              {t('Waiting for first order')}
            </div>
            <div
              style={{
                fontSize: 14,
                color: '#52525b',
                maxWidth: 380,
                margin: '0 auto',
                lineHeight: 1.55,
              }}
            >
              {t('Mark Paid · Print Invoice · Refund will appear here per-order the moment a buyer checks out on your storefront.')}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((order) => (
              <OrderRow key={order.id} order={order} storeSlug={storeSlug} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function OrderRow({ order, storeSlug }: { order: Order; storeSlug: string }) {
  const router = useRouter();
  const locale = useLocale();
  const t = (text: string) => adminPhrase(locale, text);
  const [pending, startTransition] = useTransition();
  const [busyAction, setBusyAction] = useState<'paid' | 'refund' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const itemCount = order.items.reduce((sum, it) => sum + it.quantity, 0);
  const canMarkPaid = order.paymentStatus === 'unpaid' || order.paymentStatus === 'payment_failed';
  const canRefund = order.paymentStatus === 'marked_paid';

  function handleMarkPaid() {
    setError(null);
    setBusyAction('paid');
    startTransition(async () => {
      const r = await markOrderPaid({ slug: storeSlug, orderId: order.id });
      if (r.status === 'error') setError(r.message ?? t('Could not mark paid'));
      else router.refresh();
      setBusyAction(null);
    });
  }

  function handleRefund() {
    setError(null);
    setBusyAction('refund');
    startTransition(async () => {
      const r = await markOrderRefunded({ slug: storeSlug, orderId: order.id });
      if (r.status === 'error') setError(r.message ?? t('Could not refund'));
      else router.refresh();
      setBusyAction(null);
    });
  }

  function handlePrintInvoice() {
    const href = `/account/orders/${order.id}/print?store=${encodeURIComponent(storeSlug)}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.9fr) minmax(0, 0.9fr) auto',
        alignItems: 'center',
        gap: 14,
        padding: '12px 14px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.55)',
        border: '1px solid rgba(212,212,216,0.55)',
        transition: 'background 120ms ease, border-color 120ms ease',
        opacity: pending ? 0.7 : 1,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: '#71717a',
            letterSpacing: '0.04em',
          }}
        >
          #{order.id.slice(0, 8).toUpperCase()}
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: '#18181b',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {order.customerName}
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#71717a',
          }}
        >
          {itemCount.toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-US')} {itemCount === 1 ? t('item') : t('items')} · {formatAge(order.createdAt)}
        </div>
      </div>

      <div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 15,
            fontWeight: 600,
            color: '#18181b',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {order.currency} {Number(order.totalQar).toLocaleString()}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          <GlassPill tone={paymentTone(order.paymentStatus)}>
            {t(PAYMENT_LABEL[order.paymentStatus])}
          </GlassPill>
          <GlassPill tone={statusTone(order.orderStatus)}>
            {t(STATUS_LABEL[order.orderStatus])}
          </GlassPill>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#52525b', minWidth: 0 }}>
        {order.address?.city ?? '—'}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <ActionButton
          onClick={handleMarkPaid}
          disabled={!canMarkPaid || pending}
          loading={busyAction === 'paid'}
          variant="primary"
          title={canMarkPaid ? t('Mark this order as paid') : t('Already settled or refunded')}
        >
          {t('Mark paid')}
        </ActionButton>
        <ActionButton
          onClick={handlePrintInvoice}
          disabled={pending}
          variant="ghost"
          title={t('Open printable invoice')}
        >
          {t('Print')}
        </ActionButton>
        <ActionButton
          onClick={handleRefund}
          disabled={!canRefund || pending}
          loading={busyAction === 'refund'}
          variant="danger"
          title={canRefund ? t('Refund this order') : t('Only paid orders can be refunded')}
        >
          {t('Refund')}
        </ActionButton>
      </div>

      {error && (
        <div
          style={{
            gridColumn: '1 / -1',
            fontSize: 12,
            color: '#b91c1c',
            background: 'rgba(254,226,226,0.6)',
            padding: '6px 10px',
            borderRadius: 8,
            marginTop: 4,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  loading,
  variant,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant: 'primary' | 'ghost' | 'danger';
  title?: string;
  children: React.ReactNode;
}) {
  const styles: Record<typeof variant, React.CSSProperties> = {
    primary: {
      background: 'linear-gradient(180deg, #27272a 0%, #18181b 100%)',
      color: '#fafafa',
      border: '1px solid #18181b',
      boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset',
    },
    ghost: {
      background: 'rgba(255,255,255,0.7)',
      color: '#27272a',
      border: '1px solid rgba(161,161,170,0.45)',
    },
    danger: {
      background: 'rgba(255,255,255,0.7)',
      color: '#b91c1c',
      border: '1px solid rgba(220,38,38,0.35)',
    },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        ...styles[variant],
        padding: '6px 12px',
        borderRadius: 8,
        fontSize: 12.5,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'opacity 120ms ease, transform 120ms ease',
      }}
    >
      {loading ? '…' : children}
    </button>
  );
}

function GlassPill({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'critical' | 'info' | 'neutral';
  children: React.ReactNode;
}) {
  const palette: Record<typeof tone, { color: string; bg: string; border: string }> = {
    success: {
      color: '#047857',
      bg: 'rgba(209,250,229,0.7)',
      border: 'rgba(16,185,129,0.35)',
    },
    warning: {
      color: '#a16207',
      bg: 'rgba(254,243,199,0.7)',
      border: 'rgba(202,138,4,0.35)',
    },
    critical: {
      color: '#b91c1c',
      bg: 'rgba(254,226,226,0.7)',
      border: 'rgba(220,38,38,0.35)',
    },
    info: {
      color: '#1d4ed8',
      bg: 'rgba(219,234,254,0.7)',
      border: 'rgba(59,130,246,0.35)',
    },
    neutral: {
      color: '#52525b',
      bg: 'rgba(244,244,245,0.7)',
      border: 'rgba(161,161,170,0.4)',
    },
  };
  const p = palette[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: p.color,
        background: p.bg,
        border: `1px solid ${p.border}`,
      }}
    >
      {children}
    </span>
  );
}

function paymentTone(s: PaymentStatus): 'success' | 'warning' | 'critical' | 'info' | 'neutral' {
  if (s === 'marked_paid') return 'success';
  if (s === 'payment_failed') return 'critical';
  if (s === 'refunded') return 'critical';
  return 'warning';
}
function statusTone(s: OrderStatus): 'success' | 'warning' | 'critical' | 'info' | 'neutral' {
  if (s === 'delivered') return 'success';
  if (s === 'cancelled') return 'critical';
  if (s === 'pending') return 'warning';
  return 'info';
}

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
