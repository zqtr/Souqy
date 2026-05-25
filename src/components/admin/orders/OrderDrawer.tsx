'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markOrderPaid, markOrderRefunded, updateOrderStatus } from '@/app/actions/checkout';
import type { Order, OrderStatus, PaymentMethod, PaymentStatus } from '@/lib/checkout-orders';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  order: Order | null;
  onClose: () => void;
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  marked_paid: 'Paid',
  payment_failed: 'Failed',
  refunded: 'Refunded',
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cod: 'Cash on delivery',
  bank_transfer: 'Bank transfer',
  skipcash: 'SkipCash',
  sadad: 'SADAD',
  pay_link: 'Pay link',
};

const LEGAL_NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function OrderDrawer({ open, order, onClose }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  function refresh() {
    setActionError(null);
    router.refresh();
  }

  function handleStatusChange(slug: string, orderId: string, status: OrderStatus) {
    setActionError(null);
    start(async () => {
      const r = await updateOrderStatus({ slug, orderId, status });
      if (r.status === 'error') setActionError(r.message);
      else refresh();
    });
  }

  function handleMarkPaid(slug: string, orderId: string) {
    setActionError(null);
    start(async () => {
      const r = await markOrderPaid({ slug, orderId });
      if (r.status === 'error') setActionError(r.message);
      else refresh();
    });
  }

  function handleRefund(slug: string, orderId: string) {
    setActionError(null);
    start(async () => {
      const r = await markOrderRefunded({ slug, orderId });
      if (r.status === 'error') setActionError(r.message);
      else refresh();
    });
  }

  return (
    <Sheet
      open={open && order != null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[min(560px,100vw)]">
        {order ? (
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b px-6 pt-6 pb-5">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
                Order
              </p>
              <SheetTitle className="font-mono text-base font-semibold tracking-[0.04em]">
                {order.id.slice(0, 8).toUpperCase()}
              </SheetTitle>
              <SheetDescription className="text-xs">{formatLong(order.createdAt)}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <Section title="Status">
                <div className="flex flex-wrap gap-2">
                  <ToneBadge tone={statusTone(order.orderStatus)}>
                    {STATUS_LABEL[order.orderStatus]}
                  </ToneBadge>
                  <ToneBadge tone={paymentTone(order.paymentStatus)}>
                    {PAYMENT_LABEL[order.paymentStatus]}
                  </ToneBadge>
                  <Badge variant="outline" className="font-normal">
                    {METHOD_LABEL[order.paymentMethod]}
                  </Badge>
                </div>

                <div className="mt-4">
                  <StatusTransition
                    current={order.orderStatus}
                    pending={pending}
                    onChange={(s) => handleStatusChange(order.storefrontSlug, order.id, s)}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {order.paymentStatus === 'unpaid' || order.paymentStatus === 'payment_failed' ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleMarkPaid(order.storefrontSlug, order.id)}
                      disabled={pending}
                    >
                      Mark as paid
                    </Button>
                  ) : null}
                  {order.paymentStatus === 'marked_paid' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRefund(order.storefrontSlug, order.id)}
                      disabled={pending}
                    >
                      Mark as refunded
                    </Button>
                  ) : null}
                </div>

                {actionError ? (
                  <p role="alert" className="mt-3 text-xs text-[color:var(--color-maroon,#8b3a3a)]">
                    {actionError}
                  </p>
                ) : null}
              </Section>

              <Separator className="my-5" />

              <Section title="Customer">
                <div className="text-sm font-medium">{order.customerName}</div>
                <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
                {order.customerEmail ? (
                  <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                ) : null}
              </Section>

              {order.address ? (
                <>
                  <Separator className="my-5" />
                  <Section title="Address">
                    <div className="text-sm">{order.address.line1}</div>
                    {order.address.line2 ? (
                      <div className="text-xs text-muted-foreground">{order.address.line2}</div>
                    ) : null}
                    <div className="text-xs text-muted-foreground">
                      {[order.address.area, order.address.city, order.address.zip]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                    <div className="text-xs text-muted-foreground">{order.address.country}</div>
                    {order.address.notes ? (
                      <div className="mt-2 text-xs italic text-muted-foreground">
                        “{order.address.notes}”
                      </div>
                    ) : null}
                  </Section>
                </>
              ) : null}

              <Separator className="my-5" />

              <Section title="Items">
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {order.items.map((it) => (
                    <li key={it.id} className="flex items-start gap-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{it.titleSnapshot}</div>
                        {it.variantLabel ? (
                          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            Size {it.variantLabel}
                          </div>
                        ) : null}
                        {it.customInputs.height ? (
                          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {it.customInputs.heightLabel || 'Height'} {it.customInputs.height}
                          </div>
                        ) : null}
                        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          Qty {it.quantity} · {order.currency} {it.priceQarSnapshot}
                        </div>
                      </div>
                      <div className="font-mono text-xs font-medium tabular-nums">
                        {order.currency} {it.priceQarSnapshot * it.quantity}
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-col gap-1.5 border-t border-dashed pt-3 text-sm">
                  <Row label="Subtotal" value={`${order.currency} ${order.subtotalQar}`} />
                  <Row
                    label="Shipping"
                    value={
                      order.shippingQar === 0 ? 'Free' : `${order.currency} ${order.shippingQar}`
                    }
                  />
                  {order.platformFeeQar > 0 ? (
                    <Row label="Souqna fee" value={`${order.currency} ${order.platformFeeQar}`} />
                  ) : null}
                  <Row strong label="Total" value={`${order.currency} ${order.totalQar}`} />
                </div>
              </Section>

              {order.acceptedPolicies.length > 0 ? (
                <>
                  <Separator className="my-5" />
                  <Section title="Accepted policies">
                    <div className="flex flex-wrap gap-1.5">
                      {order.acceptedPolicies.map((p) => (
                        <Badge key={p} variant="secondary" className="font-normal">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </Section>
                </>
              ) : null}

              {order.notes ? (
                <>
                  <Separator className="my-5" />
                  <Section title="Buyer notes">
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {order.notes}
                    </p>
                  </Section>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function StatusTransition({
  current,
  pending,
  onChange,
}: {
  current: OrderStatus;
  pending: boolean;
  onChange: (next: OrderStatus) => void;
}) {
  const allowed = LEGAL_NEXT[current];
  if (allowed.length === 0) {
    return <p className="text-xs text-muted-foreground">No further transitions available.</p>;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        Move to
      </span>
      <div className="flex flex-wrap gap-1.5">
        {allowed.map((s) => (
          <Button
            key={s}
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => onChange(s)}
          >
            {STATUS_LABEL[s]}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between',
        strong ? 'font-semibold' : 'font-normal',
      )}
    >
      <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
      <span className={cn('font-mono tabular-nums', strong ? 'text-sm' : 'text-[13px]')}>
        {value}
      </span>
    </div>
  );
}

function ToneBadge({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'critical' | 'info' | 'neutral';
  children: React.ReactNode;
}) {
  const cls = TONE_CLS[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]',
        cls,
      )}
    >
      {children}
    </span>
  );
}

const TONE_CLS: Record<'success' | 'warning' | 'critical' | 'info' | 'neutral', string> = {
  success: 'border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  warning: 'border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  critical: 'border-rose-600/40 bg-rose-500/10 text-rose-700 dark:text-rose-400',
  info: 'border-sky-600/40 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  neutral: 'border-border bg-muted/40 text-muted-foreground',
};

function statusTone(s: OrderStatus): 'success' | 'warning' | 'critical' | 'info' | 'neutral' {
  if (s === 'delivered') return 'success';
  if (s === 'cancelled') return 'critical';
  if (s === 'pending') return 'warning';
  return 'info';
}

function paymentTone(s: PaymentStatus): 'success' | 'warning' | 'critical' | 'info' | 'neutral' {
  if (s === 'marked_paid') return 'success';
  if (s === 'payment_failed') return 'critical';
  if (s === 'refunded') return 'critical';
  return 'warning';
}

function formatLong(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
