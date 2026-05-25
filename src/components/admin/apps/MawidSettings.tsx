'use client';

import { useState } from 'react';
import { saveMawidAction } from '@/app/actions/apps';
import {
  DEFAULT_MAWID_COUNTDOWN,
  emptyEvent,
  type MawidEvent,
  type MawidSettings,
  type MawidPreLaunch,
  type MawidPostLaunch,
  type MawidVariant,
  type MawidSize,
  type MawidEventTargetKind,
} from '@/lib/apps/mawid';
import {
  AppSettingsCard,
  AppField,
  AppToggle,
  appInputStyle,
  appCodeInputStyle,
} from './AppSettingsCard';
import { EntityPicker, type PickableEntity } from './pickers/EntityPicker';

type SlimProduct = { id: string; title: string; imageUrl?: string | null };
type SlimCategory = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  productCount?: number;
};

/**
 * Owner-customizable Mawid settings form.
 *
 * Renders the global controls (enable, default timezone, optional
 * banner toggle) plus a CRUD list of events. Each event card exposes
 * the full schema: schedule, target, pre/post-launch behaviour,
 * scheduled launch price, OOS auto-hide, and the countdown style
 * (variant + size + accent + bilingual labels + which units to show).
 *
 * State lives entirely in this client component until Save — there is
 * no per-field debounce action. The whole settings blob is sent in
 * one round-trip to keep the contract simple and the audit log readable.
 */
export function MawidSettingsForm({
  storefrontSlug,
  initial,
  products,
  categories = [],
}: {
  storefrontSlug: string;
  initial: MawidSettings;
  products: SlimProduct[];
  categories?: SlimCategory[];
}) {
  const [settings, setSettings] = useState<MawidSettings>(initial);

  function patch(next: Partial<MawidSettings>) {
    setSettings((s) => ({ ...s, ...next }));
  }
  function patchEvent(id: string, p: Partial<MawidEvent>) {
    setSettings((s) => ({
      ...s,
      events: s.events.map((e) => (e.id === id ? { ...e, ...p } : e)),
    }));
  }
  function patchCountdown(id: string, p: Partial<MawidEvent['countdown']>) {
    setSettings((s) => ({
      ...s,
      events: s.events.map((e) =>
        e.id === id ? { ...e, countdown: { ...e.countdown, ...p } } : e,
      ),
    }));
  }
  function addEvent() {
    setSettings((s) => ({ ...s, events: [...s.events, emptyEvent()] }));
  }
  function removeEvent(id: string) {
    setSettings((s) => ({
      ...s,
      events: s.events.filter((e) => e.id !== id),
      globalBanner:
        s.globalBanner.eventId === id
          ? { enabled: false, eventId: undefined }
          : s.globalBanner,
    }));
  }

  return (
    <AppSettingsCard
      eyebrow="Customise"
      title="Mawid · scheduled drops & countdowns"
      description="Stage launches in advance. Each event flips by clock from a countdown to live (and to ended). Everything below is bilingual and fully editable."
      onSave={async () => saveMawidAction({ storefrontSlug, settings })}
    >
      <AppToggle
        label="Mawid is on"
        hint="When off, every event is hidden across the storefront."
        value={settings.enabled}
        onChange={(v) => patch({ enabled: v })}
      />
      <AppField label="Default timezone" hint="IANA name. Defaults to Asia/Qatar.">
        <input
          type="text"
          value={settings.defaultTimezone}
          onChange={(e) => patch({ defaultTimezone: e.target.value })}
          placeholder="Asia/Qatar"
          style={appCodeInputStyle}
        />
      </AppField>

      <AppField label="Global top banner">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <AppToggle
            label="Pin one event to the top of every storefront page"
            value={settings.globalBanner.enabled}
            onChange={(v) =>
              patch({ globalBanner: { ...settings.globalBanner, enabled: v } })
            }
          />
          {settings.globalBanner.enabled ? (
            <EntityPicker
              mode="single"
              value={settings.globalBanner.eventId ?? null}
              onChange={(v) =>
                patch({
                  globalBanner: {
                    ...settings.globalBanner,
                    eventId: v ?? undefined,
                  },
                })
              }
              options={settings.events.map<PickableEntity>((e) => ({
                id: e.id,
                label: e.name || e.id,
                sublabel: e.enabled ? 'on' : 'off',
                glyph: '◷',
              }))}
              placeholder="Pick an event…"
              emptyHint="Add an event below to pin one to the banner."
            />
          ) : null}
        </div>
      </AppField>

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
          Events ({settings.events.length})
        </span>
        <button
          type="button"
          onClick={addEvent}
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
          + Add event
        </button>
      </div>

      {settings.events.length === 0 ? (
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
          No events yet. Add one to schedule a drop.
        </p>
      ) : null}

      {settings.events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          products={products}
          categories={categories}
          onPatch={(p) => patchEvent(event.id, p)}
          onPatchCountdown={(p) => patchCountdown(event.id, p)}
          onRemove={() => removeEvent(event.id)}
        />
      ))}
    </AppSettingsCard>
  );
}

function EventCard({
  event,
  products,
  categories,
  onPatch,
  onPatchCountdown,
  onRemove,
}: {
  event: MawidEvent;
  products: SlimProduct[];
  categories: SlimCategory[];
  onPatch: (p: Partial<MawidEvent>) => void;
  onPatchCountdown: (p: Partial<MawidEvent['countdown']>) => void;
  onRemove: () => void;
}) {
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
          {event.id}
        </code>
        <input
          type="text"
          value={event.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Owner-only label, e.g. Eid Capsule"
          style={{ ...appInputStyle, flex: 1 }}
        />
        <AppToggle
          label="On"
          value={event.enabled}
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
        <AppField label="Target">
          <select
            value={event.targetKind}
            onChange={(e) =>
              onPatch({
                targetKind: e.target.value as MawidEventTargetKind,
                targetId: undefined,
              })
            }
            style={appInputStyle}
          >
            <option value="announcement">Page-wide announcement</option>
            <option value="product">Specific product</option>
            <option value="collection">Collection slug</option>
          </select>
        </AppField>
        {event.targetKind === 'product' ? (
          <AppField label="Product">
            <EntityPicker
              mode="single"
              value={event.targetId ?? null}
              onChange={(id) => onPatch({ targetId: id ?? undefined })}
              options={products.map<PickableEntity>((p) => ({
                id: p.id,
                label: p.title,
                imageUrl: p.imageUrl ?? null,
              }))}
              placeholder="Search products…"
              emptyHint="No products match. Add products to this storefront first."
            />
          </AppField>
        ) : event.targetKind === 'collection' ? (
          <AppField label="Category">
            <EntityPicker
              mode="single"
              value={event.targetId ?? null}
              onChange={(slug) => onPatch({ targetId: slug ?? undefined })}
              options={categories.map<PickableEntity>((c) => ({
                id: c.slug,
                label: c.name,
                sublabel:
                  typeof c.productCount === 'number'
                    ? `${c.productCount} product${c.productCount === 1 ? '' : 's'} · /${c.slug}`
                    : `/${c.slug}`,
                imageUrl: c.imageUrl ?? null,
              }))}
              placeholder="Search categories…"
              emptyHint="No categories yet. Create one in Products → Categories."
            />
          </AppField>
        ) : (
          <div />
        )}

        <AppField label="Starts at" hint="Local datetime in your default timezone.">
          <input
            type="datetime-local"
            value={toLocalInput(event.startsAt)}
            onChange={(e) => onPatch({ startsAt: fromLocalInput(e.target.value) })}
            style={appInputStyle}
          />
        </AppField>
        <AppField label="Ends at (optional)">
          <input
            type="datetime-local"
            value={event.endsAt ? toLocalInput(event.endsAt) : ''}
            onChange={(e) =>
              onPatch({ endsAt: e.target.value ? fromLocalInput(e.target.value) : undefined })
            }
            style={appInputStyle}
          />
        </AppField>

        <AppField label="Before launch">
          <select
            value={event.preLaunch}
            onChange={(e) => onPatch({ preLaunch: e.target.value as MawidPreLaunch })}
            style={appInputStyle}
          >
            <option value="countdown">Show countdown</option>
            <option value="placeholder">Show "Coming soon" only</option>
            <option value="hide">Hide entirely</option>
          </select>
        </AppField>
        <AppField label="After launch">
          <select
            value={event.postLaunch}
            onChange={(e) => onPatch({ postLaunch: e.target.value as MawidPostLaunch })}
            style={appInputStyle}
          >
            <option value="live">Stay live</option>
            <option value="hide">Auto-hide at end</option>
            <option value="soldOut">Mark sold out</option>
          </select>
        </AppField>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <AppField label="Launch price (QAR)" hint="Optional. Applied while the event is live.">
          <input
            type="number"
            min={0}
            step="0.01"
            value={event.scheduledPrice?.price ?? ''}
            onChange={(e) =>
              onPatch({
                scheduledPrice: e.target.value
                  ? {
                      price: Number(e.target.value),
                      compareAt: event.scheduledPrice?.compareAt,
                    }
                  : undefined,
              })
            }
            style={appInputStyle}
          />
        </AppField>
        <AppField label="Compare-at price (optional)">
          <input
            type="number"
            min={0}
            step="0.01"
            value={event.scheduledPrice?.compareAt ?? ''}
            onChange={(e) =>
              onPatch({
                scheduledPrice: event.scheduledPrice
                  ? {
                      price: event.scheduledPrice.price,
                      compareAt: e.target.value ? Number(e.target.value) : undefined,
                    }
                  : undefined,
              })
            }
            disabled={!event.scheduledPrice}
            style={appInputStyle}
          />
        </AppField>
      </div>

      <AppToggle
        label="Auto-hide when stock = 0"
        hint="Once the target product sells out, the event flips to sold-out regardless of After-launch."
        value={event.hideWhenOos}
        onChange={(v) => onPatch({ hideWhenOos: v })}
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
          Countdown style
        </legend>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <AppField label="Variant">
            <select
              value={event.countdown.variant}
              onChange={(e) => onPatchCountdown({ variant: e.target.value as MawidVariant })}
              style={appInputStyle}
            >
              <option value="boxed">Boxed</option>
              <option value="inline">Inline</option>
              <option value="banner">Banner</option>
            </select>
          </AppField>
          <AppField label="Size">
            <select
              value={event.countdown.size}
              onChange={(e) => onPatchCountdown({ size: e.target.value as MawidSize })}
              style={appInputStyle}
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </AppField>
          <AppField label="Accent" hint="CSS colour or token (e.g. --admin-accent).">
            <input
              type="text"
              value={event.countdown.accent}
              onChange={(e) => onPatchCountdown({ accent: e.target.value })}
              placeholder={DEFAULT_MAWID_COUNTDOWN.accent}
              style={appCodeInputStyle}
            />
          </AppField>
        </div>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <AppField label="Pre-launch label · EN">
            <input
              type="text"
              value={event.countdown.labelEn}
              onChange={(e) => onPatchCountdown({ labelEn: e.target.value })}
              style={appInputStyle}
            />
          </AppField>
          <AppField label="Pre-launch label · AR">
            <input
              type="text"
              dir="rtl"
              value={event.countdown.labelAr}
              onChange={(e) => onPatchCountdown({ labelAr: e.target.value })}
              style={appInputStyle}
            />
          </AppField>
          <AppField label="Live label · EN">
            <input
              type="text"
              value={event.countdown.finishedEn}
              onChange={(e) => onPatchCountdown({ finishedEn: e.target.value })}
              style={appInputStyle}
            />
          </AppField>
          <AppField label="Live label · AR">
            <input
              type="text"
              dir="rtl"
              value={event.countdown.finishedAr}
              onChange={(e) => onPatchCountdown({ finishedAr: e.target.value })}
              style={appInputStyle}
            />
          </AppField>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <AppToggle
            label="Days"
            value={event.countdown.showDays}
            onChange={(v) => onPatchCountdown({ showDays: v })}
          />
          <AppToggle
            label="Hours"
            value={event.countdown.showHours}
            onChange={(v) => onPatchCountdown({ showHours: v })}
          />
          <AppToggle
            label="Minutes"
            value={event.countdown.showMinutes}
            onChange={(v) => onPatchCountdown({ showMinutes: v })}
          />
          <AppToggle
            label="Seconds"
            value={event.countdown.showSeconds}
            onChange={(v) => onPatchCountdown({ showSeconds: v })}
          />
        </div>
      </fieldset>
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string {
  if (!local) return new Date().toISOString();
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
