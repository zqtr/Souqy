'use client';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { addToCatalog } from '@/app/actions/souqnasource';
import type { Listing } from '@/lib/apps/souqnasource/types';

export function ImportModal({
  listing,
  slug,
  onClose,
}: {
  listing: Listing;
  slug: string;
  locale: 'en' | 'ar';
  onClose: () => void;
}) {
  const t = useTranslations('apps.souqnasource.import');
  const [titleEn, setTitleEn] = useState(listing.title);
  const [titleAr, setTitleAr] = useState(listing.title);
  const [descEn, setDescEn] = useState(listing.description ?? '');
  const [descAr, setDescAr] = useState(listing.description ?? '');
  const [retail, setRetail] = useState(String(listing.price ?? 0));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSave() {
    startTransition(async () => {
      const out = await addToCatalog({
        slug,
        listingId: listing.id,
        overrides: {
          title: { en: titleEn, ar: titleAr },
          description: { en: descEn, ar: descAr },
          retail: Number(retail),
        },
      });
      onClose();
      router.push(`/account/products/${out.productId}`);
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
          width: 'min(600px, 100%)',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 24px 60px -20px color-mix(in srgb, var(--ink-strong) 30%, transparent)',
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: 16,
            fontFamily: 'var(--font-serif, var(--font-sans))',
            fontWeight: 400,
            fontSize: 22,
            color: 'var(--ink-strong)',
            letterSpacing: '-0.01em',
          }}
        >
          {t('headline')}
        </h2>

        <FormField label={`${t('fields.title')} (EN)`}>
          <input
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            style={inputStyle}
          />
        </FormField>
        <FormField label={`${t('fields.title')} (AR)`}>
          <input
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value)}
            dir="rtl"
            style={inputStyle}
          />
        </FormField>
        <FormField label={`${t('fields.description')} (EN)`}>
          <textarea
            value={descEn}
            onChange={(e) => setDescEn(e.target.value)}
            rows={3}
            style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
          />
        </FormField>
        <FormField label={`${t('fields.description')} (AR)`}>
          <textarea
            value={descAr}
            onChange={(e) => setDescAr(e.target.value)}
            dir="rtl"
            rows={3}
            style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
          />
        </FormField>
        <FormField label={t('fields.retail')}>
          <input
            value={retail}
            onChange={(e) => setRetail(e.target.value)}
            style={inputStyle}
          />
        </FormField>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={ghostBtn}>
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            style={{ ...primaryBtn, opacity: pending ? 0.6 : 1 }}
          >
            {pending ? '…' : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'block', marginTop: 14 }}>
      <span
        style={{
          display: 'block',
          marginBottom: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--surface-rule)',
  background: 'var(--surface-bg)',
  color: 'var(--ink-strong)',
  fontSize: 14,
  outline: 'none',
};

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
