'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  saveCustomer,
  type CustomerActionState,
} from '@/app/actions/customers';
import { Field, inputStyle } from '@/components/admin/SettingsForm';
import { Surface } from '@/components/admin/primitives';

type Initial = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  tags?: string[];
  marketingConsent?: boolean;
};

export function CustomerForm({
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
  const [state, setState] = useState<CustomerActionState>({ status: 'idle' });

  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '));
  const [marketing, setMarketing] = useState(initial?.marketingConsent ?? false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: 'idle' });
    start(async () => {
      const result = await saveCustomer({
        storefrontSlug,
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        marketingConsent: marketing,
      });
      setState(result);
      if (result.status === 'success' && mode === 'create') {
        router.push(
          `/account/customers/${result.id}?store=${storefrontSlug}`,
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <Surface padding={20}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="First name">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={inputStyle}
              autoComplete="given-name"
            />
          </Field>
          <Field label="Last name">
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={inputStyle}
              autoComplete="family-name"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              autoComplete="email"
            />
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
              autoComplete="tel"
            />
          </Field>
        </div>
      </Surface>

      <Surface padding={20}>
        <Field
          label="Tags"
          hint="Comma-separated. Used to segment marketing audiences and filter the list."
        >
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            style={inputStyle}
            placeholder="vip, repeat, doha"
          />
        </Field>
        <label
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 12,
            alignItems: 'flex-start',
            fontSize: 13.5,
            color: 'var(--ink-strong)',
          }}
        >
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            <strong style={{ fontWeight: 500 }}>Email marketing consent.</strong>{' '}
            <span style={{ color: 'var(--ink-muted)' }}>
              Required for the Consented audience filter on broadcasts.
            </span>
          </span>
        </label>
      </Surface>

      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
        }}
      >
        {state.status === 'error' ? (
          <span
            role="alert"
            style={{
              fontSize: 12.5,
              color: 'var(--color-maroon, #8b3a3a)',
            }}
          >
            {state.message}
          </span>
        ) : state.status === 'success' && mode === 'edit' ? (
          <span
            role="status"
            style={{ fontSize: 12.5, color: 'var(--admin-accent)' }}
          >
            Saved
          </span>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            background: pending
              ? 'color-mix(in srgb, var(--ink-strong) 50%, transparent)'
              : 'var(--ink-strong)',
            color: 'var(--surface-bg)',
            border: 'none',
            fontSize: 13.5,
            fontWeight: 500,
            cursor: pending ? 'progress' : 'pointer',
          }}
        >
          {pending ? 'Saving…' : mode === 'create' ? 'Create customer' : 'Save changes'}
        </button>
      </footer>
    </form>
  );
}
