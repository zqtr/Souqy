'use client';

import { useEffect, useRef, useState } from 'react';
import { resendOrderWhatsAppConfirmation, type ResendWhatsAppState } from '@/app/actions/orders';

export function ResendWhatsAppButton({
  storefrontSlug,
  orderId,
  disabled,
}: {
  storefrontSlug: string;
  orderId: number;
  disabled?: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<ResendWhatsAppState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!toast) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 5200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast]);

  return (
    <>
      <button
        type="button"
        disabled={disabled || sending}
        onClick={async () => {
          setSending(true);
          try {
            const result = await resendOrderWhatsAppConfirmation(storefrontSlug, orderId);
            setToast(result);
          } finally {
            setSending(false);
          }
        }}
        style={{
          marginTop: 14,
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          border: '1px solid color-mix(in srgb, var(--admin-accent, #7a3d2d) 38%, transparent)',
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--admin-accent, #7a3d2d) 14%, transparent), color-mix(in srgb, #d7b56d 18%, transparent))',
          color: 'var(--ink-strong)',
          borderRadius: 8,
          padding: '10px 12px',
          fontSize: 13,
          fontWeight: 650,
          cursor: disabled || sending ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.52 : 1,
        }}
      >
        <span>{sending ? 'Sending...' : 'Resend WhatsApp'}</span>
        <span aria-hidden style={{ opacity: 0.42 }}>
          ·
        </span>
        <span lang="ar" dir="rtl" style={{ fontFamily: 'var(--font-arabic, var(--font-sans))' }}>
          {sending ? 'جار الإرسال...' : 'إعادة إرسال واتساب'}
        </span>
      </button>

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            insetInlineEnd: 24,
            bottom: 24,
            zIndex: 80,
            width: 'min(380px, calc(100vw - 32px))',
            border:
              toast.status === 'success'
                ? '1px solid color-mix(in srgb, #2f7d5b 42%, transparent)'
                : '1px solid color-mix(in srgb, var(--color-maroon, #8b3a3a) 42%, transparent)',
            borderRadius: 14,
            background:
              'color-mix(in srgb, var(--surface-elevated, #fff) 92%, transparent)',
            boxShadow: '0 22px 70px color-mix(in srgb, #140b08 18%, transparent)',
            backdropFilter: 'blur(18px)',
            padding: 16,
            color: 'var(--ink-strong)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>
                {toast.status === 'success' ? 'Owner notice' : 'Owner notice'}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 13.5, lineHeight: 1.45 }}>
                {toast.message}
              </p>
              <p
                lang="ar"
                dir="rtl"
                style={{
                  margin: '4px 0 0',
                  fontFamily: 'var(--font-arabic, var(--font-sans))',
                  fontSize: 13.5,
                  lineHeight: 1.55,
                }}
              >
                {toast.arMessage}
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setToast(null)}
              style={{
                border: 0,
                background: 'transparent',
                color: 'var(--ink-muted)',
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
