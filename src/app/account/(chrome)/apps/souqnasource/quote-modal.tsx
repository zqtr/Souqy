'use client';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { requestQuote } from '@/app/actions/souqnasource';
import type { Listing } from '@/lib/apps/souqnasource/types';

export function QuoteModal({
  listing,
  slug,
  onClose,
}: {
  listing: Listing;
  slug: string;
  locale: 'en' | 'ar';
  onClose: () => void;
}) {
  const t = useTranslations('apps.souqnasource.quote');
  const [pending, startTransition] = useTransition();

  function onOpen() {
    startTransition(async () => {
      const { url } = await requestQuote({ slug, listingId: listing.id });
      window.open(url, '_blank', 'noopener,noreferrer');
      onClose();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'color-mix(in srgb, var(--ink-strong) 50%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'var(--surface-elevated, var(--surface-bg))',
          border: '1px solid var(--surface-rule)',
          borderRadius: 14,
          padding: 24,
          width: 'min(480px, 100%)',
          boxShadow:
            '0 24px 60px -20px color-mix(in srgb, var(--ink-strong) 30%, transparent)',
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: 12,
            fontFamily: 'var(--font-serif, var(--font-sans))',
            fontWeight: 400,
            fontSize: 22,
            color: 'var(--ink-strong)',
            letterSpacing: '-0.01em',
          }}
        >
          {t('headline')}
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 13.5,
            color: 'var(--ink-muted)',
            lineHeight: 1.55,
          }}
        >
          {t('preview')}
        </p>
        <div
          style={{
            background: 'color-mix(in srgb, var(--ink-strong) 4%, transparent)',
            border: '1px solid var(--surface-rule)',
            borderRadius: 10,
            padding: 14,
            margin: '14px 0',
            fontSize: 13,
            color: 'var(--ink-strong)',
            lineHeight: 1.6,
            whiteSpace: 'pre-line',
          }}
        >
          {t('afterNote')}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={ghostBtn}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onOpen}
            disabled={pending}
            style={{ ...primaryBtn, opacity: pending ? 0.6 : 1 }}
          >
            {pending ? '…' : t('open')}
          </button>
        </div>
      </div>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--ink-muted)',
  fontSize: 13.5,
  fontWeight: 500,
  border: '1px solid transparent',
  cursor: 'pointer',
};

const primaryBtn: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: 8,
  background: 'var(--ink-strong)',
  color: 'var(--surface-bg)',
  fontSize: 13.5,
  fontWeight: 500,
  border: 'none',
  cursor: 'pointer',
};
