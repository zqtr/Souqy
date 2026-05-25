'use client';

import { useState } from 'react';
import { saveLookbookKitAction, removeLookbookKitAction } from '@/app/actions/apps';
import type { LookbookKit } from '@/lib/apps/lookbook';

// Inlined client-side helpers (mirror `@/lib/apps/lookbook`).
function emptyKit(now = new Date()): LookbookKit {
  return {
    id: '',
    fileSlug: 'press-kit',
    title: { en: '', ar: '' },
    intro: { en: '', ar: '' },
    productIds: [],
    coverImageUrl: null,
    accentVar: null,
    pressContact: { name: '', email: '', phone: '' },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}
function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'press-kit'
  );
}
import {
  AppSettingsCard,
  AppField,
  appInputStyle,
} from './AppSettingsCard';
import type { Product } from '@/lib/products';

type Props = {
  storefrontSlug: string;
  kits: LookbookKit[];
  products: Pick<Product, 'id' | 'title' | 'imageUrl'>[];
};

export function LookbookSettingsForm({ storefrontSlug, kits, products }: Props) {
  const [editing, setEditing] = useState<LookbookKit | null>(null);

  if (editing) {
    return (
      <KitEditor
        storefrontSlug={storefrontSlug}
        kit={editing}
        products={products}
        onClose={() => setEditing(null)}
      />
    );
  }

  return (
    <AppSettingsCard
      eyebrow="Customise"
      title="Press kits"
      description="Each kit is a curated selection of products rendered as a print-ready lookbook page. Open a kit and use your browser’s Save as PDF to export."
      saveLabel="New kit"
      onSave={async () => {
        setEditing(emptyKit());
        return { status: 'success' };
      }}
    >
      {kits.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: 0 }}>
          No kits yet. Create one to start curating press-ready lookbooks for
          press, stockists, and partners.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {kits.map((k) => (
            <div
              key={k.id}
              style={{
                padding: 14,
                borderRadius: 12,
                background: 'color-mix(in srgb, var(--ink-strong) 3%, transparent)',
                border: '1px solid var(--surface-rule)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-strong)' }}>
                  {k.title.en || k.title.ar || '(untitled)'}
                </div>
                <div
                  style={{ fontSize: 12, color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  {k.productIds.length} product{k.productIds.length === 1 ? '' : 's'} · {k.fileSlug}.pdf
                </div>
              </div>
              <a
                href={`/account/apps/lookbook/render?store=${storefrontSlug}&kit=${k.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: 'var(--ink-strong)',
                  color: 'var(--surface-bg)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  textDecoration: 'none',
                }}
              >
                Open lookbook
              </a>
              <button
                type="button"
                onClick={() => setEditing(k)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: 'transparent',
                  border: '1px solid var(--surface-rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!confirm('Remove this kit?')) return;
                  await removeLookbookKitAction({ storefrontSlug, kitId: k.id });
                  window.location.reload();
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: 'transparent',
                  border: '1px solid color-mix(in srgb, var(--color-maroon, #8b3a3a) 50%, transparent)',
                  color: 'var(--color-maroon, #8b3a3a)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </AppSettingsCard>
  );
}

function KitEditor({
  storefrontSlug,
  kit,
  products,
  onClose,
}: {
  storefrontSlug: string;
  kit: LookbookKit;
  products: Pick<Product, 'id' | 'title' | 'imageUrl'>[];
  onClose: () => void;
}) {
  const [titleEn, setTitleEn] = useState(kit.title.en);
  const [titleAr, setTitleAr] = useState(kit.title.ar);
  const [introEn, setIntroEn] = useState(kit.intro.en);
  const [introAr, setIntroAr] = useState(kit.intro.ar);
  const [coverImageUrl, setCoverImageUrl] = useState(kit.coverImageUrl ?? '');
  const [pressName, setPressName] = useState(kit.pressContact.name);
  const [pressEmail, setPressEmail] = useState(kit.pressContact.email);
  const [pressPhone, setPressPhone] = useState(kit.pressContact.phone);
  const [productIds, setProductIds] = useState<string[]>(kit.productIds);

  function toggleProduct(id: string) {
    setProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  return (
    <AppSettingsCard
      eyebrow={kit.id ? 'Edit kit' : 'New kit'}
      title={titleEn || titleAr || 'Untitled kit'}
      onSave={async () => {
        if (productIds.length === 0) {
          return { status: 'error', message: 'Pick at least one product.' };
        }
        const res = await saveLookbookKitAction({
          storefrontSlug,
          kit: {
            ...kit,
            fileSlug: slugify(titleEn || titleAr || 'press-kit'),
            title: { en: titleEn.trim(), ar: titleAr.trim() },
            intro: { en: introEn.trim(), ar: introAr.trim() },
            coverImageUrl: coverImageUrl.trim() || null,
            pressContact: {
              name: pressName.trim(),
              email: pressEmail.trim(),
              phone: pressPhone.trim(),
            },
            productIds,
          },
        });
        if (res.status === 'success') {
          window.location.reload();
        }
        return res;
      }}
      footer={
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid var(--surface-rule-strong)',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            color: 'var(--ink-strong)',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <AppField label="Title (English)">
          <input
            type="text"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value.slice(0, 120))}
            placeholder="SS26 press kit"
            style={appInputStyle}
          />
        </AppField>
        <AppField label="Title (Arabic)">
          <input
            type="text"
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value.slice(0, 120))}
            placeholder="ملف صحفي ربيع–صيف 26"
            style={{ ...appInputStyle, direction: 'rtl' }}
          />
        </AppField>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <AppField label="Intro (English)">
          <textarea
            value={introEn}
            onChange={(e) => setIntroEn(e.target.value.slice(0, 1200))}
            rows={4}
            style={{ ...appInputStyle, resize: 'vertical', fontFamily: 'var(--font-sans)' }}
          />
        </AppField>
        <AppField label="Intro (Arabic)">
          <textarea
            value={introAr}
            onChange={(e) => setIntroAr(e.target.value.slice(0, 1200))}
            rows={4}
            style={{ ...appInputStyle, resize: 'vertical', direction: 'rtl', fontFamily: 'var(--font-sans)' }}
          />
        </AppField>
      </div>
      <AppField label="Cover image URL (optional)">
        <input
          type="url"
          value={coverImageUrl}
          onChange={(e) => setCoverImageUrl(e.target.value)}
          placeholder="https://… (use any product image url, or your logo)"
          style={appInputStyle}
        />
      </AppField>
      <AppField label="Press contact (optional)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <input
            type="text"
            value={pressName}
            onChange={(e) => setPressName(e.target.value)}
            placeholder="Name"
            style={appInputStyle}
          />
          <input
            type="email"
            value={pressEmail}
            onChange={(e) => setPressEmail(e.target.value)}
            placeholder="press@…"
            style={appInputStyle}
          />
          <input
            type="tel"
            value={pressPhone}
            onChange={(e) => setPressPhone(e.target.value)}
            placeholder="+974…"
            style={appInputStyle}
          />
        </div>
      </AppField>
      <AppField label={`Products in kit (${productIds.length}/${products.length})`}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8,
            maxHeight: 360,
            overflow: 'auto',
            padding: 4,
          }}
        >
          {products.map((p) => {
            const on = productIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleProduct(p.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: 6,
                  borderRadius: 10,
                  background: on
                    ? 'color-mix(in srgb, var(--admin-accent) 12%, transparent)'
                    : 'transparent',
                  border: `1px solid ${on ? 'var(--admin-accent)' : 'var(--surface-rule-strong)'}`,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt=""
                    style={{
                      width: '100%',
                      aspectRatio: '4 / 5',
                      objectFit: 'cover',
                      borderRadius: 6,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '4 / 5',
                      borderRadius: 6,
                      background: 'color-mix(in srgb, var(--ink-strong) 8%, transparent)',
                    }}
                  />
                )}
                <span style={{ fontSize: 12, color: 'var(--ink-strong)', lineHeight: 1.3 }}>
                  {p.title}
                </span>
              </button>
            );
          })}
        </div>
      </AppField>
    </AppSettingsCard>
  );
}
