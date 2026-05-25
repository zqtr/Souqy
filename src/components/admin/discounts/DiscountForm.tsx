'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  saveDiscount,
  removeDiscount,
  type DiscountActionState,
} from '@/app/actions/discounts';
import { Field, inputStyle } from '@/components/admin/SettingsForm';
import { Surface } from '@/components/admin/primitives';

type Initial = {
  id?: number;
  kind?: 'code' | 'automatic';
  code?: string;
  title?: string | null;
  valueType?: 'percentage' | 'fixed_amount' | 'free_shipping';
  value?: number;
  appliesTo?: 'all' | 'products' | 'categories';
  minimumSubtotal?: number | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  status?: 'active' | 'scheduled' | 'expired' | 'disabled';
  startsAt?: Date | null;
  endsAt?: Date | null;
};

function toInputDate(d: Date | null | undefined): string {
  if (!d) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromInputDate(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function DiscountForm({
  storefrontSlug,
  initial,
  mode,
}: {
  storefrontSlug: string;
  initial?: Initial;
  mode: 'create' | 'edit';
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [removing, startRemove] = useTransition();
  const [state, setState] = useState<DiscountActionState>({ status: 'idle' });

  const [code, setCode] = useState(initial?.code ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [valueType, setValueType] = useState<
    'percentage' | 'fixed_amount' | 'free_shipping'
  >(initial?.valueType ?? 'percentage');
  const [value, setValue] = useState<number>(initial?.value ?? 10);
  const [appliesTo, setAppliesTo] = useState<'all' | 'products' | 'categories'>(
    initial?.appliesTo ?? 'all',
  );
  const [minimumSubtotal, setMinimumSubtotal] = useState<number | ''>(
    initial?.minimumSubtotal ?? '',
  );
  const [usageLimit, setUsageLimit] = useState<number | ''>(initial?.usageLimit ?? '');
  const [perCustomerLimit, setPerCustomerLimit] = useState<number | ''>(
    initial?.perCustomerLimit ?? '',
  );
  const [status, setStatus] = useState<'active' | 'scheduled' | 'expired' | 'disabled'>(
    initial?.status ?? 'active',
  );
  const [startsAt, setStartsAt] = useState(toInputDate(initial?.startsAt));
  const [endsAt, setEndsAt] = useState(toInputDate(initial?.endsAt));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: 'idle' });
    start(async () => {
      const result = await saveDiscount({
        storefrontSlug,
        id: initial?.id,
        kind: 'code',
        code: code.trim(),
        title: title.trim() || null,
        valueType,
        value: Number(value) || 0,
        appliesTo,
        appliesToIds: [],
        minimumSubtotal: minimumSubtotal === '' ? null : Number(minimumSubtotal),
        usageLimit: usageLimit === '' ? null : Number(usageLimit),
        perCustomerLimit:
          perCustomerLimit === '' ? null : Number(perCustomerLimit),
        status,
        startsAt: fromInputDate(startsAt),
        endsAt: fromInputDate(endsAt),
      });
      setState(result);
      if (result.status === 'success' && mode === 'create') {
        router.push(
          `/account/discounts/${result.id}?store=${storefrontSlug}`,
        );
      }
    });
  }

  function handleDelete() {
    if (!initial?.id) return;
    if (!confirm(`Delete discount "${code}"? This cannot be undone.`)) return;
    startRemove(async () => {
      const result = await removeDiscount({
        storefrontSlug,
        id: initial.id!,
      });
      if (result.status === 'success') {
        router.push(`/account/discounts?store=${storefrontSlug}`);
      } else if ('message' in result) {
        setState({ status: 'error', message: result.message });
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
      className="souqna-discount-form"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <Surface padding={20}>
          <Header eyebrow="Discount" title="Code & value" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
            <Field
              label="Code"
              hint="Customers type this at checkout. Letters, numbers, dashes, underscores."
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                placeholder="WELCOME10"
                required
              />
            </Field>
            <Field label="Internal title (optional)">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={inputStyle}
                placeholder="Founder friends — soft launch"
              />
            </Field>
            <Field label="Type">
              <select
                value={valueType}
                onChange={(e) =>
                  setValueType(
                    e.target.value as 'percentage' | 'fixed_amount' | 'free_shipping',
                  )
                }
                style={inputStyle}
              >
                <option value="percentage">Percentage off</option>
                <option value="fixed_amount">Fixed amount off (QAR)</option>
                <option value="free_shipping">Free shipping</option>
              </select>
            </Field>
            <Field
              label={
                valueType === 'percentage'
                  ? 'Percent off'
                  : valueType === 'fixed_amount'
                    ? 'Amount off (QAR)'
                    : 'Reserved'
              }
            >
              <input
                type="number"
                min={0}
                max={valueType === 'percentage' ? 100 : 99999}
                step={valueType === 'percentage' ? 1 : 0.01}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                style={inputStyle}
                disabled={valueType === 'free_shipping'}
              />
            </Field>
          </div>
        </Surface>

        <Surface padding={20}>
          <Header eyebrow="Eligibility" title="Limits & rules" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 8 }}>
            <Field label="Min subtotal (QAR)" hint="Blank = no minimum.">
              <input
                type="number"
                min={0}
                step="0.01"
                value={minimumSubtotal}
                onChange={(e) =>
                  setMinimumSubtotal(e.target.value === '' ? '' : Number(e.target.value))
                }
                style={inputStyle}
              />
            </Field>
            <Field label="Usage limit" hint="Total uses across all customers.">
              <input
                type="number"
                min={1}
                step={1}
                value={usageLimit}
                onChange={(e) =>
                  setUsageLimit(e.target.value === '' ? '' : Number(e.target.value))
                }
                style={inputStyle}
              />
            </Field>
            <Field label="Per customer" hint="How many times one customer can use it.">
              <input
                type="number"
                min={1}
                step={1}
                value={perCustomerLimit}
                onChange={(e) =>
                  setPerCustomerLimit(e.target.value === '' ? '' : Number(e.target.value))
                }
                style={inputStyle}
              />
            </Field>
          </div>
          <Field label="Applies to">
            <select
              value={appliesTo}
              onChange={(e) =>
                setAppliesTo(e.target.value as 'all' | 'products' | 'categories')
              }
              style={{ ...inputStyle, marginTop: 12 }}
            >
              <option value="all">Entire order</option>
              <option value="products">Specific products (configure later)</option>
              <option value="categories">Specific categories (configure later)</option>
            </select>
          </Field>
        </Surface>

        <Surface padding={20}>
          <Header eyebrow="Schedule" title="Start & end" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
            <Field label="Starts at (optional)">
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Ends at (optional)">
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>
        </Surface>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 76 }}>
        <Surface padding={20}>
          <Header eyebrow="Status" title="Visibility" />
          <Field label="Status">
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as 'active' | 'scheduled' | 'expired' | 'disabled')
              }
              style={inputStyle}
            >
              <option value="active">Active</option>
              <option value="scheduled">Scheduled</option>
              <option value="disabled">Disabled</option>
              <option value="expired">Expired</option>
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
              background:
                'color-mix(in srgb, var(--color-maroon, #8b3a3a) 10%, transparent)',
            }}
          >
            {state.message}
          </div>
        ) : state.status === 'success' && mode === 'edit' ? (
          <div
            role="status"
            style={{ fontSize: 12.5, color: 'var(--admin-accent)' }}
          >
            Saved
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          style={{
            padding: '11px 18px',
            borderRadius: 10,
            background: pending
              ? 'color-mix(in srgb, var(--ink-strong) 50%, transparent)'
              : 'var(--ink-strong)',
            color: 'var(--surface-bg)',
            border: 'none',
            fontSize: 14,
            fontWeight: 500,
            cursor: pending ? 'progress' : 'pointer',
          }}
        >
          {pending ? 'Saving…' : mode === 'create' ? 'Create discount' : 'Save changes'}
        </button>

        {mode === 'edit' && initial?.id ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={removing}
            style={{
              padding: '9px 14px',
              borderRadius: 8,
              background: 'transparent',
              color: 'var(--color-maroon, #8b3a3a)',
              border: '1px solid color-mix(in srgb, var(--color-maroon, #8b3a3a) 30%, transparent)',
              fontSize: 13,
              fontWeight: 500,
              cursor: removing ? 'progress' : 'pointer',
            }}
          >
            {removing ? 'Deleting…' : 'Delete discount'}
          </button>
        ) : null}
      </div>

      <style>{`
        @media (max-width: 980px) {
          .souqna-discount-form { grid-template-columns: 1fr !important; }
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
