'use client';

import { useState, useTransition } from 'react';
import {
  saveDropAction,
  archiveDropAction,
} from '@/app/actions/apps';
import type { Drop } from '@/lib/apps/drop-manager';

// Inlined client mirror of `emptyDrop` from the server module to keep
// the plugin's runtime out of the client bundle.
function emptyDrop(now = new Date()): Drop {
  return {
    id: '',
    name: '',
    productIds: [],
    startsAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    maxQty: null,
    soldCount: 0,
    waitlistEnabled: true,
    heroCopy: { en: '', ar: '' },
    accentVar: null,
    archived: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}
import {
  AppSettingsCard,
  AppField,
  AppToggle,
  appInputStyle,
} from './AppSettingsCard';
import type { Product } from '@/lib/products';

type Props = {
  storefrontSlug: string;
  drops: Drop[];
  products: Pick<Product, 'id' | 'title' | 'imageUrl'>[];
};

export function DropManagerSettingsForm({ storefrontSlug, drops, products }: Props) {
  const [editing, setEditing] = useState<Drop | null>(null);
  const [archiving, startArchive] = useTransition();

  function newDrop() {
    setEditing(emptyDrop());
  }

  function archive(id: string) {
    if (!confirm('Archive this drop? It will hide on the storefront immediately.')) return;
    startArchive(async () => {
      await archiveDropAction({ storefrontSlug, dropId: id });
      window.location.reload();
    });
  }

  if (editing) {
    return (
      <DropEditor
        storefrontSlug={storefrontSlug}
        drop={editing}
        products={products}
        onClose={() => setEditing(null)}
      />
    );
  }

  return (
    <AppSettingsCard
      eyebrow="Customise"
      title="Drops"
      description="Each drop is a small product set with a start date, optional sold-out cap, and a customer waitlist. Insert one on a storefront page using the Drop block in the builder."
      saveLabel="New drop"
      onSave={async () => {
        newDrop();
        return { status: 'success' };
      }}
    >
      {drops.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: 0 }}>
          No drops yet. Create one to start gating products behind a date or a
          quantity cap.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {drops.map((d) => {
            const live =
              new Date(d.startsAt).getTime() <= Date.now() &&
              new Date(d.endsAt).getTime() > Date.now() &&
              !d.archived;
            return (
              <div
                key={d.id}
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
                    {d.name || '(unnamed drop)'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                    {fmt(d.startsAt)} → {fmt(d.endsAt)} · {d.productIds.length} product{d.productIds.length === 1 ? '' : 's'}
                    {d.maxQty !== null ? ` · cap ${d.soldCount}/${d.maxQty}` : ''}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: live
                      ? 'color-mix(in srgb, var(--admin-accent) 18%, transparent)'
                      : 'color-mix(in srgb, var(--ink-strong) 8%, transparent)',
                    color: live ? 'var(--admin-accent)' : 'var(--ink-muted)',
                  }}
                >
                  {d.archived ? 'archived' : live ? 'live' : 'scheduled'}
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(d)}
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
                {!d.archived ? (
                  <button
                    type="button"
                    onClick={() => archive(d.id)}
                    disabled={archiving}
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
                    Archive
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </AppSettingsCard>
  );
}

function DropEditor({
  storefrontSlug,
  drop,
  products,
  onClose,
}: {
  storefrontSlug: string;
  drop: Drop;
  products: Pick<Product, 'id' | 'title' | 'imageUrl'>[];
  onClose: () => void;
}) {
  const [name, setName] = useState(drop.name);
  const [startsAt, setStartsAt] = useState(toLocalIso(drop.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalIso(drop.endsAt));
  const [maxQty, setMaxQty] = useState<string>(drop.maxQty?.toString() ?? '');
  const [waitlistEnabled, setWaitlistEnabled] = useState(drop.waitlistEnabled);
  const [productIds, setProductIds] = useState<Set<string>>(new Set(drop.productIds));
  const [headingEn, setHeadingEn] = useState(drop.heroCopy.en);
  const [headingAr, setHeadingAr] = useState(drop.heroCopy.ar);

  function toggleProduct(id: string) {
    setProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <AppSettingsCard
      eyebrow={drop.id ? 'Edit drop' : 'New drop'}
      title={name || 'Untitled drop'}
      onSave={async () => {
        const cap = maxQty.trim() ? Number(maxQty) : null;
        if (cap !== null && (!Number.isFinite(cap) || cap <= 0)) {
          return { status: 'error', message: 'Cap should be a positive number, or empty.' };
        }
        if (productIds.size === 0) {
          return { status: 'error', message: 'Pick at least one product.' };
        }
        const res = await saveDropAction({
          storefrontSlug,
          drop: {
            ...drop,
            name: name.trim(),
            startsAt: new Date(startsAt).toISOString(),
            endsAt: new Date(endsAt).toISOString(),
            maxQty: cap,
            waitlistEnabled,
            productIds: Array.from(productIds),
            heroCopy: { en: headingEn.trim(), ar: headingAr.trim() },
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
      <AppField label="Internal name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 80))}
          placeholder="SS26 capsule"
          style={appInputStyle}
        />
      </AppField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <AppField label="Goes live">
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            style={appInputStyle}
          />
        </AppField>
        <AppField label="Closes">
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            style={appInputStyle}
          />
        </AppField>
      </div>
      <AppField label="Cap (optional)" hint="Total quantity across the drop. Leave blank for unlimited.">
        <input
          type="number"
          value={maxQty}
          onChange={(e) => setMaxQty(e.target.value)}
          placeholder="e.g. 50"
          style={appInputStyle}
          min={1}
        />
      </AppField>
      <AppToggle
        label="Show a Notify-me waitlist when sold out"
        hint="Sign-ups land in your existing Inquiries inbox tagged waitlist:<id>."
        value={waitlistEnabled}
        onChange={setWaitlistEnabled}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <AppField label="Heading (English)">
          <input
            type="text"
            value={headingEn}
            onChange={(e) => setHeadingEn(e.target.value.slice(0, 120))}
            placeholder="Spring capsule"
            style={appInputStyle}
          />
        </AppField>
        <AppField label="Heading (Arabic)">
          <input
            type="text"
            value={headingAr}
            onChange={(e) => setHeadingAr(e.target.value.slice(0, 120))}
            placeholder="مجموعة الربيع"
            style={{ ...appInputStyle, direction: 'rtl' }}
          />
        </AppField>
      </div>
      <AppField label={`Products (${productIds.size}/${products.length})`}>
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
            const on = productIds.has(p.id);
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
                      aspectRatio: '1 / 1',
                      objectFit: 'cover',
                      borderRadius: 6,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
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

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function toLocalIso(iso: string): string {
  // <input type=datetime-local> wants `YYYY-MM-DDTHH:mm` in the user's TZ.
  try {
    const d = new Date(iso);
    const offsetMs = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
  } catch {
    return '';
  }
}
