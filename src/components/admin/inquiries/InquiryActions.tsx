'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  setInquiryStatus,
  type InquiryActionState,
} from '@/app/actions/inquiries';

const choices = [
  { value: 'new', label: 'Mark new' },
  { value: 'responded', label: 'Mark responded' },
  { value: 'closed', label: 'Close' },
  { value: 'spam', label: 'Mark spam' },
] as const;

export function InquiryActions({
  storefrontSlug,
  inquiryId,
  currentStatus,
}: {
  storefrontSlug: string;
  inquiryId: number;
  currentStatus: 'new' | 'responded' | 'closed' | 'spam';
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<InquiryActionState>({ status: 'idle' });

  function handleSet(value: 'new' | 'responded' | 'closed' | 'spam') {
    if (value === currentStatus) return;
    setState({ status: 'idle' });
    start(async () => {
      const result = await setInquiryStatus({
        storefrontSlug,
        id: inquiryId,
        status: value,
      });
      setState(result);
      if (result.status === 'success') router.refresh();
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        Move status
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {choices.map((c) => {
          const active = c.value === currentStatus;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => handleSet(c.value)}
              disabled={active || pending}
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                border: `1px solid ${active ? 'var(--admin-accent)' : 'color-mix(in srgb, var(--ink-strong) 14%, transparent)'}`,
                background: active
                  ? 'color-mix(in srgb, var(--admin-accent) 12%, transparent)'
                  : 'transparent',
                color: active ? 'var(--admin-accent)' : 'var(--ink-strong)',
                fontSize: 13,
                cursor: active || pending ? 'default' : 'pointer',
                textAlign: 'left',
              }}
            >
              {active ? `· ${c.label.replace(/^Mark |^Close$/, '')} (current)` : c.label}
            </button>
          );
        })}
      </div>
      {state.status === 'error' ? (
        <span role="alert" style={{ fontSize: 12, color: 'var(--color-maroon, #8b3a3a)' }}>
          {state.message}
        </span>
      ) : null}
    </div>
  );
}
