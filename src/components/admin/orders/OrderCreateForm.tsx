'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createOrderFromForm,
  type OrderActionState,
} from '@/app/actions/orders';
import { Field, inputStyle } from '@/components/admin/SettingsForm';
import { Surface } from '@/components/admin/primitives';

type ProductOption = { id: string; title: string; priceQar: number | null };

type LineItem = {
  productId: string | null;
  productTitle: string;
  unitPrice: number;
  quantity: number;
};

export function OrderCreateForm({
  storefrontSlug,
  products,
}: {
  storefrontSlug: string;
  products: ProductOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<OrderActionState>({ status: 'idle' });

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [items, setItems] = useState<LineItem[]>([
    { productId: null, productTitle: '', unitPrice: 0, quantity: 1 },
  ]);

  const [shippingTotal, setShippingTotal] = useState(0);
  const [discountTotal, setDiscountTotal] = useState(0);
  const [discountCode, setDiscountCode] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<
    'pending' | 'paid' | 'authorized'
  >('paid');
  const [status, setStatus] = useState<'open' | 'draft' | 'paid'>('paid');
  const [notes, setNotes] = useState('');

  const subtotal = items.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
  const total = Math.max(subtotal - discountTotal + shippingTotal, 0);

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [
      ...prev,
      { productId: null, productTitle: '', unitPrice: 0, quantity: 1 },
    ]);
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function pickProduct(idx: number, productId: string) {
    if (!productId) {
      updateItem(idx, { productId: null });
      return;
    }
    const p = products.find((q) => q.id === productId);
    if (!p) return;
    updateItem(idx, {
      productId: p.id,
      productTitle: p.title,
      unitPrice: p.priceQar ?? 0,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: 'idle' });
    start(async () => {
      const validItems = items.filter(
        (it) => it.productTitle.trim() && it.quantity > 0,
      );
      const result = await createOrderFromForm({
        storefrontSlug,
        customer: {
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
        },
        items: validItems,
        status,
        paymentStatus,
        fulfilmentStatus: 'unfulfilled',
        currencyCode: 'QAR',
        shippingTotal,
        discountTotal,
        discountCode: discountCode.trim() || null,
        notes: notes.trim() || null,
      });
      setState(result);
      if (result.status === 'success') {
        router.push(`/account/orders?store=${storefrontSlug}`);
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 320px',
        gap: 20,
        alignItems: 'flex-start',
      }}
      className="souqna-order-form"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <Surface padding={20}>
          <Header eyebrow="Customer" title="Who is this order for?" />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginTop: 8,
            }}
          >
            <Field label="First name">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Last name">
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                placeholder="customer@example.com"
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={inputStyle}
                placeholder="+974 5555 1234"
              />
            </Field>
          </div>
        </Surface>

        <Surface padding={20}>
          <Header
            eyebrow="Items"
            title={`${items.length} line item${items.length === 1 ? '' : 's'}`}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {items.map((it, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2.4fr 1fr 1fr 0.8fr 28px',
                  gap: 8,
                  alignItems: 'flex-end',
                }}
              >
                <Field label={idx === 0 ? 'Product' : ''}>
                  <select
                    value={it.productId ?? ''}
                    onChange={(e) => pickProduct(idx, e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">— pick or type below —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  <input
                    value={it.productTitle}
                    onChange={(e) => updateItem(idx, { productTitle: e.target.value })}
                    style={{ ...inputStyle, marginTop: 4 }}
                    placeholder="Or type a custom item title"
                  />
                </Field>
                <Field label={idx === 0 ? 'Unit price (QAR)' : ''}>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={it.unitPrice}
                    onChange={(e) =>
                      updateItem(idx, { unitPrice: Number(e.target.value) })
                    }
                    style={inputStyle}
                  />
                </Field>
                <Field label={idx === 0 ? 'Qty' : ''}>
                  <input
                    type="number"
                    min={1}
                    value={it.quantity}
                    onChange={(e) =>
                      updateItem(idx, { quantity: Number(e.target.value) })
                    }
                    style={inputStyle}
                  />
                </Field>
                <Field label={idx === 0 ? 'Total' : ''}>
                  <input
                    readOnly
                    value={(it.unitPrice * it.quantity).toFixed(2)}
                    style={{
                      ...inputStyle,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--ink-muted)',
                    }}
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  aria-label="Remove line"
                  style={{
                    width: 28,
                    height: 36,
                    borderRadius: 6,
                    border: '1px solid color-mix(in srgb, var(--ink-strong) 14%, transparent)',
                    background: 'transparent',
                    color: 'var(--ink-muted)',
                    cursor: 'pointer',
                    alignSelf: 'flex-end',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              style={{
                alignSelf: 'flex-start',
                padding: '8px 14px',
                borderRadius: 8,
                background: 'transparent',
                border: '1px dashed color-mix(in srgb, var(--ink-strong) 22%, transparent)',
                color: 'var(--admin-accent)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              + Add line item
            </button>
          </div>
        </Surface>

        <Surface padding={20}>
          <Header eyebrow="Notes" title="Internal notes" />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything to remember about this order. Customer doesn't see this."
            style={{
              ...inputStyle,
              marginTop: 8,
              minHeight: 90,
              resize: 'vertical',
            }}
          />
        </Surface>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          position: 'sticky',
          top: 76,
        }}
      >
        <Surface padding={20}>
          <Header eyebrow="Summary" title="Totals" />
          <SummaryRow label="Subtotal" value={`QAR ${subtotal.toFixed(2)}`} />
          <SummaryRow
            label="Discount"
            value={
              <input
                type="number"
                min={0}
                step="0.01"
                value={discountTotal}
                onChange={(e) => setDiscountTotal(Number(e.target.value))}
                style={{ ...inputStyle, width: 100, textAlign: 'right' }}
              />
            }
          />
          <SummaryRow
            label="Discount code"
            value={
              <input
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                style={{ ...inputStyle, width: 130, textAlign: 'right' }}
                placeholder="e.g. WELCOME10"
              />
            }
          />
          <SummaryRow
            label="Shipping"
            value={
              <input
                type="number"
                min={0}
                step="0.01"
                value={shippingTotal}
                onChange={(e) => setShippingTotal(Number(e.target.value))}
                style={{ ...inputStyle, width: 100, textAlign: 'right' }}
              />
            }
          />
          <SummaryRow
            label="Total"
            strong
            value={`QAR ${total.toFixed(2)}`}
          />
        </Surface>

        <Surface padding={20}>
          <Header eyebrow="Status" title="Order state" />
          <Field label="Order status">
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as 'open' | 'draft' | 'paid')
              }
              style={inputStyle}
            >
              <option value="paid">Paid (closed)</option>
              <option value="open">Open</option>
              <option value="draft">Draft</option>
            </select>
          </Field>
          <div style={{ height: 8 }} />
          <Field label="Payment">
            <select
              value={paymentStatus}
              onChange={(e) =>
                setPaymentStatus(
                  e.target.value as 'pending' | 'paid' | 'authorized',
                )
              }
              style={inputStyle}
            >
              <option value="paid">Paid</option>
              <option value="authorized">Authorized</option>
              <option value="pending">Pending</option>
            </select>
          </Field>
        </Surface>

        {state.status === 'error' ? (
          <div
            role="alert"
            style={{
              fontSize: 12.5,
              color: 'var(--color-maroon, #8b3a3a)',
              padding: '8px 12px',
              borderRadius: 8,
              background: 'color-mix(in srgb, var(--color-maroon, #8b3a3a) 10%, transparent)',
            }}
          >
            {state.message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          style={{
            padding: '11px 18px',
            borderRadius: 10,
            background: pending ? 'color-mix(in srgb, var(--ink-strong) 50%, transparent)' : 'var(--ink-strong)',
            color: 'var(--surface-bg)',
            border: 'none',
            fontSize: 14,
            fontWeight: 500,
            cursor: pending ? 'progress' : 'pointer',
          }}
        >
          {pending ? 'Saving…' : 'Create order'}
        </button>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .souqna-order-form { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </form>
  );
}

function Header({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header style={{ marginBottom: 4 }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--admin-accent)',
        }}
      >
        ◈ {eyebrow}
      </div>
      <h2
        style={{
          margin: '4px 0 0',
          fontFamily: 'var(--font-serif, var(--font-sans))',
          fontWeight: 400,
          fontSize: 17,
          color: 'var(--ink-strong)',
        }}
      >
        {title}
      </h2>
    </header>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 0',
        borderTop: '1px solid color-mix(in srgb, var(--ink-strong) 7%, transparent)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontSize: strong ? 16 : 13,
          fontWeight: strong ? 500 : 400,
          color: 'var(--ink-strong)',
          fontFamily: strong ? 'var(--font-serif, var(--font-sans))' : 'inherit',
        }}
      >
        {value}
      </span>
    </div>
  );
}
