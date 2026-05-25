'use client';

import { useState } from 'react';
import { saveTaqimAction } from '@/app/actions/apps';
import {
  emptyBundle,
  type TaqimBundle,
  type TaqimSettings,
  type TaqimKind,
  type TaqimLayout,
  type TaqimRadius,
  type TaqimStockPolicy,
  type TaqimPricing,
} from '@/lib/apps/taqim';
import {
  AppSettingsCard,
  AppField,
  AppToggle,
  appInputStyle,
  appCodeInputStyle,
} from './AppSettingsCard';
import { EntityPicker, type PickableEntity } from './pickers/EntityPicker';

type SlimProduct = { id: string; title: string; imageUrl?: string | null };

/**
 * Owner-customizable Taqim settings form.
 *
 * Two surfaces: a global appearance card (layout, radius, accent,
 * bilingual savings template) and a CRUD list of bundles. Each bundle
 * exposes everything the founder cares about: kind, items, anchor
 * products for placement, pricing mode + value, bilingual title /
 * subtitle / CTA, stock policy, and per-bundle enable.
 */
export function TaqimSettingsForm({
  storefrontSlug,
  initial,
  products,
}: {
  storefrontSlug: string;
  initial: TaqimSettings;
  products: SlimProduct[];
}) {
  const [settings, setSettings] = useState<TaqimSettings>(initial);

  function patchAppearance(p: Partial<TaqimSettings['appearance']>) {
    setSettings((s) => ({ ...s, appearance: { ...s.appearance, ...p } }));
  }
  function patchBundle(id: string, p: Partial<TaqimBundle>) {
    setSettings((s) => ({
      ...s,
      bundles: s.bundles.map((b) => (b.id === id ? { ...b, ...p } : b)),
    }));
  }
  function addBundle() {
    setSettings((s) => ({ ...s, bundles: [...s.bundles, emptyBundle()] }));
  }
  function removeBundle(id: string) {
    setSettings((s) => ({ ...s, bundles: s.bundles.filter((b) => b.id !== id) }));
  }

  return (
    <AppSettingsCard
      eyebrow="Customise"
      title="Taqim · bundles & complete-the-look"
      description="Combine products into matching sets and price each bundle exactly how you want. Bundles render via the Taqim block in the builder, fully bilingual, with a stock-aware hide."
      onSave={async () => saveTaqimAction({ storefrontSlug, settings })}
    >
      <AppToggle
        label="Taqim is on"
        hint="When off, every bundle is hidden across the storefront."
        value={settings.enabled}
        onChange={(v) => setSettings((s) => ({ ...s, enabled: v }))}
      />

      <fieldset
        style={{
          border: '1px solid var(--surface-rule)',
          borderRadius: 8,
          padding: 14,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <legend
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-muted)',
            padding: '0 6px',
          }}
        >
          Appearance
        </legend>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <AppField label="Layout">
            <select
              value={settings.appearance.layout}
              onChange={(e) => patchAppearance({ layout: e.target.value as TaqimLayout })}
              style={appInputStyle}
            >
              <option value="cards">Cards</option>
              <option value="stack">Stacked rows</option>
              <option value="carousel">Carousel</option>
            </select>
          </AppField>
          <AppField label="Card radius">
            <select
              value={settings.appearance.radius}
              onChange={(e) => patchAppearance({ radius: e.target.value as TaqimRadius })}
              style={appInputStyle}
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </AppField>
          <AppField label="Accent" hint="CSS colour or token (e.g. --color-maroon).">
            <input
              type="text"
              value={settings.appearance.accent}
              onChange={(e) => patchAppearance({ accent: e.target.value })}
              style={appCodeInputStyle}
            />
          </AppField>
        </div>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <AppField label="Savings badge · EN" hint="Use {amount} as a placeholder.">
            <input
              type="text"
              value={settings.appearance.savingsTemplateEn}
              onChange={(e) => patchAppearance({ savingsTemplateEn: e.target.value })}
              style={appInputStyle}
            />
          </AppField>
          <AppField label="Savings badge · AR">
            <input
              type="text"
              dir="rtl"
              value={settings.appearance.savingsTemplateAr}
              onChange={(e) => patchAppearance({ savingsTemplateAr: e.target.value })}
              style={appInputStyle}
            />
          </AppField>
        </div>
      </fieldset>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 6,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-muted)',
          }}
        >
          Bundles ({settings.bundles.length})
        </span>
        <button
          type="button"
          onClick={addBundle}
          style={{
            padding: '6px 14px',
            borderRadius: 999,
            background: 'transparent',
            border: '1px solid var(--surface-rule-strong)',
            color: 'var(--ink-strong)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.06em',
            cursor: 'pointer',
          }}
        >
          + Add bundle
        </button>
      </div>

      {settings.bundles.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: 'var(--ink-muted)',
            padding: '14px 18px',
            border: '1px dashed var(--surface-rule)',
            borderRadius: 8,
          }}
        >
          No bundles yet. Add one to start selling sets.
        </p>
      ) : null}

      {settings.bundles.map((bundle) => (
        <BundleCard
          key={bundle.id}
          bundle={bundle}
          products={products}
          onPatch={(p) => patchBundle(bundle.id, p)}
          onRemove={() => removeBundle(bundle.id)}
        />
      ))}
    </AppSettingsCard>
  );
}

function BundleCard({
  bundle,
  products,
  onPatch,
  onRemove,
}: {
  bundle: TaqimBundle;
  products: SlimProduct[];
  onPatch: (p: Partial<TaqimBundle>) => void;
  onRemove: () => void;
}) {
  function setPricing(p: TaqimPricing) {
    onPatch({ pricing: p });
  }
  const productOptions = products.map<PickableEntity>((p) => ({
    id: p.id,
    label: p.title,
    imageUrl: p.imageUrl ?? null,
  }));

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 10,
        border: '1px solid var(--surface-rule)',
        background: 'color-mix(in srgb, var(--surface-bg) 60%, transparent)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <code
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-muted)',
            background: 'color-mix(in srgb, var(--ink-strong) 6%, transparent)',
            padding: '2px 8px',
            borderRadius: 999,
          }}
        >
          {bundle.id}
        </code>
        <input
          type="text"
          value={bundle.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Owner-only label, e.g. Linen capsule"
          style={{ ...appInputStyle, flex: 1 }}
        />
        <AppToggle
          label="On"
          value={bundle.enabled}
          onChange={(v) => onPatch({ enabled: v })}
        />
        <button
          type="button"
          onClick={onRemove}
          style={{
            background: 'transparent',
            border: '1px solid color-mix(in srgb, var(--color-maroon, #8b3a3a) 35%, transparent)',
            color: 'var(--color-maroon, #8b3a3a)',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Remove
        </button>
      </header>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <AppField label="Kind">
          <select
            value={bundle.kind}
            onChange={(e) => onPatch({ kind: e.target.value as TaqimKind })}
            style={appInputStyle}
          >
            <option value="fixed">Fixed set</option>
            <option value="fbt">Frequently bought together</option>
            <option value="pickN">Pick N from list</option>
          </select>
        </AppField>
        <AppField label="Stock policy">
          <select
            value={bundle.stockPolicy}
            onChange={(e) => onPatch({ stockPolicy: e.target.value as TaqimStockPolicy })}
            style={appInputStyle}
          >
            <option value="hideIfAnyOOS">Hide if any item is out of stock</option>
            <option value="showDisabled">Show with item disabled</option>
          </select>
        </AppField>
      </div>

      <AppField label="Items" hint="Search and add products that ship together in this bundle.">
        <EntityPicker
          mode="multi"
          value={bundle.items.map((it) => it.productId).filter(Boolean)}
          onChange={(next) =>
            onPatch({
              items: next.map((id) => {
                const existing = bundle.items.find((it) => it.productId === id);
                return existing ?? { productId: id };
              }),
            })
          }
          options={productOptions}
          placeholder="Search products to add…"
          emptyHint="All matching products are already in this bundle."
        />
      </AppField>

      <AppField
        label="Anchor products (optional)"
        hint="When a Taqim block is dropped on a page that picks one of these products, the bundle auto-shows."
      >
        <EntityPicker
          mode="multi"
          value={bundle.anchorProductIds.filter(Boolean)}
          onChange={(next) => onPatch({ anchorProductIds: next })}
          options={productOptions}
          placeholder="Search products to anchor…"
          emptyHint="All products are already anchors."
        />
      </AppField>

      <fieldset
        style={{
          border: '1px solid var(--surface-rule)',
          borderRadius: 8,
          padding: 14,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <legend
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-muted)',
            padding: '0 6px',
          }}
        >
          Pricing
        </legend>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <AppField label="Mode">
            <select
              value={bundle.pricing.mode}
              onChange={(e) => {
                const mode = e.target.value as TaqimPricing['mode'];
                if (mode === 'fixed') setPricing({ mode, price: 0 });
                else if (mode === 'percentOff') setPricing({ mode, percent: 10 });
                else setPricing({ mode, amount: 0 });
              }}
              style={appInputStyle}
            >
              <option value="percentOff">Percent off the sum</option>
              <option value="amountOff">Amount off the sum (QAR)</option>
              <option value="fixed">Fixed bundle price (QAR)</option>
            </select>
          </AppField>
          <AppField label="Value">
            <input
              type="number"
              min={0}
              step="0.01"
              value={
                bundle.pricing.mode === 'fixed'
                  ? bundle.pricing.price
                  : bundle.pricing.mode === 'percentOff'
                    ? bundle.pricing.percent
                    : bundle.pricing.amount
              }
              onChange={(e) => {
                const n = Number(e.target.value);
                if (bundle.pricing.mode === 'fixed') setPricing({ mode: 'fixed', price: n });
                else if (bundle.pricing.mode === 'percentOff')
                  setPricing({ mode: 'percentOff', percent: n });
                else setPricing({ mode: 'amountOff', amount: n });
              }}
              style={appInputStyle}
            />
          </AppField>
        </div>
      </fieldset>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <AppField label="Title · EN">
          <input
            type="text"
            value={bundle.titleEn}
            onChange={(e) => onPatch({ titleEn: e.target.value })}
            style={appInputStyle}
          />
        </AppField>
        <AppField label="Title · AR">
          <input
            type="text"
            dir="rtl"
            value={bundle.titleAr}
            onChange={(e) => onPatch({ titleAr: e.target.value })}
            style={appInputStyle}
          />
        </AppField>
        <AppField label="Subtitle · EN">
          <input
            type="text"
            value={bundle.subtitleEn}
            onChange={(e) => onPatch({ subtitleEn: e.target.value })}
            style={appInputStyle}
          />
        </AppField>
        <AppField label="Subtitle · AR">
          <input
            type="text"
            dir="rtl"
            value={bundle.subtitleAr}
            onChange={(e) => onPatch({ subtitleAr: e.target.value })}
            style={appInputStyle}
          />
        </AppField>
        <AppField label="CTA · EN">
          <input
            type="text"
            value={bundle.ctaEn}
            onChange={(e) => onPatch({ ctaEn: e.target.value })}
            style={appInputStyle}
          />
        </AppField>
        <AppField label="CTA · AR">
          <input
            type="text"
            dir="rtl"
            value={bundle.ctaAr}
            onChange={(e) => onPatch({ ctaAr: e.target.value })}
            style={appInputStyle}
          />
        </AppField>
      </div>
    </div>
  );
}
