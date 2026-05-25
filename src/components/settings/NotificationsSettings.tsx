'use client';

import { useState } from 'react';
import { SettingsForm } from '@/components/admin/SettingsForm';

type Props = {
  slug: string;
  initial: Record<string, boolean>;
};

const TOGGLES: Array<{ id: string; title: string; hint: string }> = [
  {
    id: 'newOrder',
    title: 'New order placed',
    hint: 'Email you when a new order is logged through the dashboard or storefront.',
  },
  {
    id: 'newInquiry',
    title: 'New inquiry submitted',
    hint: 'Email you whenever the Inquire button on a product page is submitted.',
  },
  {
    id: 'orderRefunded',
    title: 'Order refunded',
    hint: 'Confirm a refund went through.',
  },
  {
    id: 'lowStock',
    title: 'Low stock warning',
    hint: 'Coming soon — flag products with fewer than 3 units.',
  },
  {
    id: 'weeklyDigest',
    title: 'Weekly digest',
    hint: 'Friday morning roll-up of orders, inquiries, and traffic.',
  },
];

export function NotificationsSettings({ slug, initial }: Props) {
  const [config, setConfig] = useState<Record<string, boolean>>({
    newOrder: true,
    newInquiry: true,
    orderRefunded: true,
    lowStock: false,
    weeklyDigest: true,
    ...initial,
  });

  return (
    <SettingsForm
      slug={slug}
      section="notifications"
      patch={{ notificationsConfig: config }}
      description="Souqna pings for orders, store health, and weekly reminders. Phone delivery uses the number on your Clerk profile when available."
    >
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {TOGGLES.map((t) => (
          <li
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 14,
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid color-mix(in srgb, var(--ink-strong) 8%, transparent)',
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: 'var(--ink-strong)',
                }}
              >
                {t.title}
              </div>
              <div
                style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 2 }}
              >
                {t.hint}
              </div>
            </div>
            <ToggleSwitch
              checked={Boolean(config[t.id])}
              onChange={(v) =>
                setConfig((prev) => ({ ...prev, [t.id]: v }))
              }
              ariaLabel={t.title}
            />
          </li>
        ))}
      </ul>
    </SettingsForm>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      style={{
        width: 38,
        height: 22,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        padding: 2,
        background: checked
          ? 'var(--admin-accent)'
          : 'color-mix(in srgb, var(--ink-strong) 16%, transparent)',
        transition: 'background 160ms ease',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'block',
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          transform: checked ? 'translateX(16px)' : 'translateX(0)',
          transition: 'transform 160ms ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}
