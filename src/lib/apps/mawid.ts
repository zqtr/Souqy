import { getAppState, setAppState, updateAppSettings } from './installed';

/**
 * Mawid plugin runtime — scheduled drops + countdowns.
 *
 * Mawid lets the founder pre-stage "events" (a product / collection /
 * page-wide moment) that flip from `teaser` → `live` → `ended` purely
 * by clock. Each event owns a fully customizable countdown style
 * (variant / size / accent / bilingual labels), an optional scheduled
 * launch price, an OOS auto-hide, and a per-event toggle.
 *
 * Settings live in `app_state` at (slug, 'mawid', 'settings') so the
 * storefront can read them in one round-trip without going through the
 * `installed_apps` JSONB blob. We also mirror the latest settings into
 * `installed_apps.settings` so the dashboard's generic "show installed
 * settings" surfaces stay in sync — same dual-write pattern as the
 * Currency Converter for hot reads.
 */

const APP_ID = 'mawid';
const SETTINGS_KEY = 'settings';

export type MawidEventTargetKind = 'product' | 'collection' | 'announcement';
export type MawidPreLaunch = 'hide' | 'placeholder' | 'countdown';
export type MawidPostLaunch = 'live' | 'hide' | 'soldOut';
export type MawidVariant = 'boxed' | 'inline' | 'banner';
export type MawidSize = 'sm' | 'md' | 'lg';

export type MawidScheduledPrice = {
  /** Promo price applied for the live window, in QAR. */
  price: number;
  /** Optional reference price shown as strikethrough next to the promo. */
  compareAt?: number;
};

export type MawidCountdownStyle = {
  variant: MawidVariant;
  size: MawidSize;
  labelEn: string;
  labelAr: string;
  finishedEn: string;
  finishedAr: string;
  /** Free-form CSS colour or palette token (e.g. `--color-gold-deep`). */
  accent: string;
  showDays: boolean;
  showHours: boolean;
  showMinutes: boolean;
  showSeconds: boolean;
};

export type MawidEvent = {
  id: string;
  /** Owner-facing label only — never rendered on the storefront. */
  name: string;
  targetKind: MawidEventTargetKind;
  /** Product id (uuid), category slug, or empty for `announcement`. */
  targetId?: string;
  /** ISO timestamp when the event flips to `live`. */
  startsAt: string;
  /** Optional ISO timestamp when the event ends. */
  endsAt?: string;
  preLaunch: MawidPreLaunch;
  postLaunch: MawidPostLaunch;
  scheduledPrice?: MawidScheduledPrice;
  countdown: MawidCountdownStyle;
  /** When true and the target product hits stock=0, post-launch flips
   *  to `soldOut` regardless of `postLaunch`. */
  hideWhenOos: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MawidSettings = {
  enabled: boolean;
  /** IANA tz name. Defaults to Asia/Qatar. Empty falls back to UTC. */
  defaultTimezone: string;
  /** Optional global top banner pinned to one event id. */
  globalBanner: { enabled: boolean; eventId?: string };
  events: MawidEvent[];
};

export const DEFAULT_MAWID_COUNTDOWN: MawidCountdownStyle = {
  variant: 'boxed',
  size: 'md',
  labelEn: 'Live in',
  labelAr: 'يبدأ خلال',
  finishedEn: 'Live now',
  finishedAr: 'متاح الآن',
  accent: 'var(--sf-accent)',
  showDays: true,
  showHours: true,
  showMinutes: true,
  showSeconds: true,
};

export const DEFAULT_MAWID_SETTINGS: MawidSettings = {
  enabled: true,
  defaultTimezone: 'Asia/Qatar',
  globalBanner: { enabled: false },
  events: [],
};

export type MawidPhase = 'pre' | 'live' | 'ended';

export function mawidPhase(event: MawidEvent, now: Date): MawidPhase {
  const start = Date.parse(event.startsAt);
  if (Number.isNaN(start)) return 'pre';
  const t = now.getTime();
  if (t < start) return 'pre';
  if (event.endsAt) {
    const end = Date.parse(event.endsAt);
    if (!Number.isNaN(end) && t >= end) return 'ended';
  }
  return 'live';
}

function isVariant(v: unknown): v is MawidVariant {
  return v === 'boxed' || v === 'inline' || v === 'banner';
}
function isSize(v: unknown): v is MawidSize {
  return v === 'sm' || v === 'md' || v === 'lg';
}
function isPre(v: unknown): v is MawidPreLaunch {
  return v === 'hide' || v === 'placeholder' || v === 'countdown';
}
function isPost(v: unknown): v is MawidPostLaunch {
  return v === 'live' || v === 'hide' || v === 'soldOut';
}
function isTarget(v: unknown): v is MawidEventTargetKind {
  return v === 'product' || v === 'collection' || v === 'announcement';
}

function resolveCountdown(value: unknown): MawidCountdownStyle {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<MawidCountdownStyle>;
  return {
    variant: isVariant(v.variant) ? v.variant : DEFAULT_MAWID_COUNTDOWN.variant,
    size: isSize(v.size) ? v.size : DEFAULT_MAWID_COUNTDOWN.size,
    labelEn:
      typeof v.labelEn === 'string' ? v.labelEn.slice(0, 60) : DEFAULT_MAWID_COUNTDOWN.labelEn,
    labelAr:
      typeof v.labelAr === 'string' ? v.labelAr.slice(0, 60) : DEFAULT_MAWID_COUNTDOWN.labelAr,
    finishedEn:
      typeof v.finishedEn === 'string'
        ? v.finishedEn.slice(0, 60)
        : DEFAULT_MAWID_COUNTDOWN.finishedEn,
    finishedAr:
      typeof v.finishedAr === 'string'
        ? v.finishedAr.slice(0, 60)
        : DEFAULT_MAWID_COUNTDOWN.finishedAr,
    accent:
      typeof v.accent === 'string' && v.accent.trim()
        ? v.accent.slice(0, 64)
        : DEFAULT_MAWID_COUNTDOWN.accent,
    showDays: typeof v.showDays === 'boolean' ? v.showDays : true,
    showHours: typeof v.showHours === 'boolean' ? v.showHours : true,
    showMinutes: typeof v.showMinutes === 'boolean' ? v.showMinutes : true,
    showSeconds: typeof v.showSeconds === 'boolean' ? v.showSeconds : true,
  };
}

function resolveEvent(value: unknown): MawidEvent | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<MawidEvent>;
  if (typeof v.id !== 'string' || !v.id) return null;
  const startsAt =
    typeof v.startsAt === 'string' && !Number.isNaN(Date.parse(v.startsAt))
      ? v.startsAt
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const endsAt =
    typeof v.endsAt === 'string' && !Number.isNaN(Date.parse(v.endsAt)) ? v.endsAt : undefined;
  const sp = v.scheduledPrice && typeof v.scheduledPrice === 'object'
    ? v.scheduledPrice
    : undefined;
  return {
    id: v.id,
    name: typeof v.name === 'string' ? v.name.slice(0, 120) : '',
    targetKind: isTarget(v.targetKind) ? v.targetKind : 'announcement',
    targetId: typeof v.targetId === 'string' ? v.targetId.slice(0, 120) : undefined,
    startsAt,
    endsAt,
    preLaunch: isPre(v.preLaunch) ? v.preLaunch : 'countdown',
    postLaunch: isPost(v.postLaunch) ? v.postLaunch : 'live',
    scheduledPrice:
      sp && typeof (sp as { price?: unknown }).price === 'number'
        ? {
            price: Math.max(0, Number((sp as { price: number }).price)),
            compareAt:
              typeof (sp as { compareAt?: unknown }).compareAt === 'number'
                ? Math.max(0, Number((sp as { compareAt: number }).compareAt))
                : undefined,
          }
        : undefined,
    countdown: resolveCountdown(v.countdown),
    hideWhenOos: Boolean(v.hideWhenOos),
    enabled: v.enabled !== false,
    createdAt:
      typeof v.createdAt === 'string' ? v.createdAt : new Date().toISOString(),
    updatedAt:
      typeof v.updatedAt === 'string' ? v.updatedAt : new Date().toISOString(),
  };
}

export function normaliseSettings(value: unknown): MawidSettings {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<MawidSettings>;
  const events = Array.isArray(v.events)
    ? (v.events.map(resolveEvent).filter((e): e is MawidEvent => e !== null) as MawidEvent[])
    : [];
  const banner = v.globalBanner && typeof v.globalBanner === 'object'
    ? (v.globalBanner as MawidSettings['globalBanner'])
    : DEFAULT_MAWID_SETTINGS.globalBanner;
  const bannerEventId =
    typeof banner.eventId === 'string' && events.some((e) => e.id === banner.eventId)
      ? banner.eventId
      : undefined;
  return {
    enabled: v.enabled !== false,
    defaultTimezone:
      typeof v.defaultTimezone === 'string' && v.defaultTimezone.trim()
        ? v.defaultTimezone.slice(0, 64)
        : DEFAULT_MAWID_SETTINGS.defaultTimezone,
    globalBanner: { enabled: Boolean(banner.enabled), eventId: bannerEventId },
    events,
  };
}

export async function getMawidSettings(storefrontSlug: string): Promise<MawidSettings> {
  try {
    const row = await getAppState(storefrontSlug, APP_ID, SETTINGS_KEY);
    return normaliseSettings(row?.value);
  } catch (err) {
    console.warn('[mawid] settings read failed', err);
    return DEFAULT_MAWID_SETTINGS;
  }
}

export async function saveMawidSettings(
  storefrontSlug: string,
  patch: MawidSettings,
): Promise<MawidSettings> {
  const next = normaliseSettings(patch);
  await setAppState(
    storefrontSlug,
    APP_ID,
    SETTINGS_KEY,
    next as unknown as Record<string, unknown>,
  );
  // Mirror to installed_apps.settings so the dashboard's generic chrome
  // ("Last edited" etc.) reads from a single source if it ever wants to.
  try {
    await updateAppSettings(
      storefrontSlug,
      APP_ID,
      next as unknown as Record<string, unknown>,
    );
  } catch (err) {
    console.warn('[mawid] mirror to installed_apps failed', err);
  }
  return next;
}

export function emptyEvent(now = new Date()): MawidEvent {
  const startsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  return {
    id: generateEventId(),
    name: '',
    targetKind: 'announcement',
    targetId: undefined,
    startsAt,
    endsAt: undefined,
    preLaunch: 'countdown',
    postLaunch: 'live',
    scheduledPrice: undefined,
    countdown: { ...DEFAULT_MAWID_COUNTDOWN },
    hideWhenOos: false,
    enabled: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function getEventById(settings: MawidSettings, id: string): MawidEvent | null {
  return settings.events.find((e) => e.id === id) ?? null;
}

function generateEventId(): string {
  const bytes = new Uint8Array(8);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
