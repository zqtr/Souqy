'use client';

import { useState } from 'react';
import { SettingsForm } from '@/components/admin/SettingsForm';

type Mode = 'off' | 'optional' | 'required';

type Props = {
  slug: string;
  initial: { mode: Mode };
};

const OPTIONS: Array<{ id: Mode; title: string; body: string }> = [
  {
    id: 'off',
    title: 'Off',
    body: 'Customers cannot create accounts. Inquiries still capture their contact details.',
  },
  {
    id: 'optional',
    title: 'Optional (recommended)',
    body: 'Show a "Save details for next time" checkbox at inquiry time. Returning customers see their order history.',
  },
  {
    id: 'required',
    title: 'Required',
    body: 'Visitors must create an account before they can submit an inquiry or place an order. Highest friction; reserve for B2B.',
  },
];

export function CustomerAccountsSettings({ slug, initial }: Props) {
  const [mode, setMode] = useState<Mode>(initial.mode);
  return (
    <SettingsForm
      slug={slug}
      section="customer-accounts"
      patch={{ customerAccounts: { mode } }}
      description="Whether visitors can — or must — sign up for a customer account on your storefront."
    >
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {OPTIONS.map((o) => {
          const active = o.id === mode;
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => setMode(o.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: active
                    ? 'color-mix(in srgb, var(--admin-accent) 8%, transparent)'
                    : 'var(--surface-bg)',
                  border: active
                    ? '1px solid var(--admin-accent)'
                    : '1px solid color-mix(in srgb, var(--ink-strong) 12%, transparent)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Radio active={active} />
                  <strong
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'var(--ink-strong)',
                    }}
                  >
                    {o.title}
                  </strong>
                </div>
                <p
                  style={{
                    margin: '6px 0 0 26px',
                    fontSize: 13,
                    color: 'var(--ink-muted)',
                    lineHeight: 1.5,
                  }}
                >
                  {o.body}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </SettingsForm>
  );
}

function Radio({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 16,
        height: 16,
        borderRadius: '50%',
        border: '1.6px solid color-mix(in srgb, var(--ink-strong) 35%, transparent)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? 'var(--admin-accent)' : 'transparent',
        borderColor: active ? 'var(--admin-accent)' : undefined,
      }}
    >
      {active ? (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#fff',
          }}
        />
      ) : null}
    </span>
  );
}
