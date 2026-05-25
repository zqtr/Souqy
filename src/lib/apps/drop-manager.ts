import { getAppState, setAppState } from './installed';
import { db } from '@/lib/db';

/**
 * Edition / Drop manager plugin.
 *
 * A "drop" is a small set of products gated by a start date with an
 * optional sold-out cap and a customer-side waitlist. Drops are not
 * an extension of the products table — they're a metadata layer that
 * lives in `app_state` rows under (slug, 'drop-manager', 'drop:<id>')
 * plus an index row under key 'drops'.
 *
 * Pure local plugin — no third-party API. Founders own everything;
 * the storefront block does the rendering and the existing Inquiries
 * table handles waitlist submissions.
 */

export type Drop = {
  id: string;
  name: string;
  productIds: string[];
  /** ISO timestamp the drop becomes live to visitors. */
  startsAt: string;
  /** ISO timestamp after which the block hides itself ('archived'). */
  endsAt: string;
  /** Optional total-quantity cap across the drop (sold via inquiries
   *  reused as orders). When `soldCount >= maxQty`, phase flips to
   *  `sold_out`. */
  maxQty: number | null;
  /** Number of waitlist or fulfilled "purchases" counted against
   *  `maxQty`. Stored on the row so the storefront doesn't need to
   *  count inquiries on every render. */
  soldCount: number;
  waitlistEnabled: boolean;
  /** Bilingual hero copy. Each can be empty; renderer falls back to
   *  the drop name. */
  heroCopy: { en: string; ar: string };
  /** Souqna palette token name (e.g. `--color-gold-deep`). Optional. */
  accentVar: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DropPhase = 'teaser' | 'live' | 'sold_out' | 'archived';

const APP_ID = 'drop-manager';
const INDEX_KEY = 'drops';

export type DropIndex = { ids: string[]; updatedAt: string };

export function emptyDrop(now = new Date()): Drop {
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

export function resolveDrop(value: unknown): Drop | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<Drop>;
  if (typeof v.id !== 'string' || !v.id) return null;
  return {
    id: v.id,
    name: typeof v.name === 'string' ? v.name : '',
    productIds: Array.isArray(v.productIds)
      ? v.productIds.filter((p): p is string => typeof p === 'string')
      : [],
    startsAt: typeof v.startsAt === 'string' ? v.startsAt : new Date().toISOString(),
    endsAt:
      typeof v.endsAt === 'string'
        ? v.endsAt
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    maxQty: typeof v.maxQty === 'number' && v.maxQty > 0 ? Math.floor(v.maxQty) : null,
    soldCount: typeof v.soldCount === 'number' && v.soldCount >= 0 ? Math.floor(v.soldCount) : 0,
    waitlistEnabled: typeof v.waitlistEnabled === 'boolean' ? v.waitlistEnabled : true,
    heroCopy: {
      en: typeof v.heroCopy?.en === 'string' ? v.heroCopy.en : '',
      ar: typeof v.heroCopy?.ar === 'string' ? v.heroCopy.ar : '',
    },
    accentVar:
      typeof v.accentVar === 'string' && v.accentVar.startsWith('--')
        ? v.accentVar
        : null,
    archived: Boolean(v.archived),
    createdAt: typeof v.createdAt === 'string' ? v.createdAt : new Date().toISOString(),
    updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : new Date().toISOString(),
  };
}

export function dropPhase(drop: Drop, now: Date): DropPhase {
  if (drop.archived) return 'archived';
  const start = new Date(drop.startsAt).getTime();
  const end = new Date(drop.endsAt).getTime();
  const t = now.getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 'teaser';
  if (t < start) return 'teaser';
  if (t >= end) return 'archived';
  if (drop.maxQty !== null && drop.soldCount >= drop.maxQty) return 'sold_out';
  return 'live';
}

export async function listDrops(slug: string): Promise<Drop[]> {
  const idx = await getAppState(slug, APP_ID, INDEX_KEY).catch(() => null);
  const ids =
    idx && Array.isArray((idx.value as DropIndex).ids)
      ? ((idx.value as DropIndex).ids as string[])
      : [];
  if (ids.length === 0) return [];
  const rows = await Promise.all(
    ids.map((id) => getAppState(slug, APP_ID, `drop:${id}`).catch(() => null)),
  );
  const out: Drop[] = [];
  for (const r of rows) {
    if (!r) continue;
    const d = resolveDrop(r.value);
    if (d) out.push(d);
  }
  out.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  return out;
}

export async function getDrop(slug: string, dropId: string): Promise<Drop | null> {
  const row = await getAppState(slug, APP_ID, `drop:${dropId}`).catch(() => null);
  if (!row) return null;
  return resolveDrop(row.value);
}

export async function saveDrop(slug: string, drop: Drop): Promise<Drop> {
  const id = drop.id || generateDropId();
  const now = new Date().toISOString();
  const next: Drop = {
    ...drop,
    id,
    createdAt: drop.createdAt || now,
    updatedAt: now,
  };
  await setAppState(slug, APP_ID, `drop:${id}`, next as unknown as Record<string, unknown>);

  const idxRow = await getAppState(slug, APP_ID, INDEX_KEY).catch(() => null);
  const ids = new Set(
    idxRow && Array.isArray((idxRow.value as DropIndex).ids)
      ? ((idxRow.value as DropIndex).ids as string[])
      : [],
  );
  ids.add(id);
  await setAppState(slug, APP_ID, INDEX_KEY, {
    ids: Array.from(ids),
    updatedAt: now,
  });
  return next;
}

export async function archiveDrop(slug: string, dropId: string): Promise<void> {
  const drop = await getDrop(slug, dropId);
  if (!drop) return;
  drop.archived = true;
  drop.updatedAt = new Date().toISOString();
  await setAppState(slug, APP_ID, `drop:${dropId}`, drop as unknown as Record<string, unknown>);
}

export async function bumpSoldCount(slug: string, dropId: string, by = 1): Promise<void> {
  const drop = await getDrop(slug, dropId);
  if (!drop) return;
  drop.soldCount = Math.max(0, drop.soldCount + by);
  drop.updatedAt = new Date().toISOString();
  await setAppState(slug, APP_ID, `drop:${dropId}`, drop as unknown as Record<string, unknown>);
}

export async function countWaitlistFor(
  slug: string,
  dropId: string,
): Promise<number> {
  // Waitlist sign-ups land in the standard inquiries table (with
  // meta.kind = 'waitlist:<dropId>') so the founder sees them in the
  // existing Inquiries inbox. This counts them for the dashboard.
  try {
    const rows = (await db()`
      select count(*)::int as n from inquiries
      where storefront_slug = ${slug}
        and meta->>'kind' = ${'waitlist:' + dropId}
    `) as unknown as { n: number }[];
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

function generateDropId(): string {
  // Short, URL-safe id; collisions effectively impossible for the
  // small per-store cardinality we expect.
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
