import { getAppState, setAppState } from './installed';

/**
 * Press kit / Lookbook generator.
 *
 * Pure dashboard tool — no third-party calls. Each "kit" is stored as
 * an `app_state` row under (slug, 'lookbook', 'kit:<id>') with an
 * index row under key 'kits'. The render route
 * `/account/apps/lookbook/render` reads the kit + the founder's
 * products and emits a print-ready HTML page; the founder uses their
 * browser's "Save as PDF" to export.
 */

export type LookbookKit = {
  id: string;
  /** Slug-safe filename used for the printed PDF default (e.g.
   *  "ss26-press-kit"). */
  fileSlug: string;
  title: { en: string; ar: string };
  intro: { en: string; ar: string };
  /** Ordered product ids included in the lookbook. */
  productIds: string[];
  /** Optional cover image URL (founder uploads through the existing
   *  product image flow OR pastes a URL). */
  coverImageUrl: string | null;
  /** Souqna palette accent token (e.g. `--color-maroon`). Optional. */
  accentVar: string | null;
  /** Optional press contact rendered on the back page. */
  pressContact: {
    name: string;
    email: string;
    phone: string;
  };
  createdAt: string;
  updatedAt: string;
};

const APP_ID = 'lookbook';
const INDEX_KEY = 'kits';

export type KitIndex = { ids: string[]; updatedAt: string };

export function emptyKit(now = new Date()): LookbookKit {
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

export function resolveKit(value: unknown): LookbookKit | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<LookbookKit>;
  if (typeof v.id !== 'string' || !v.id) return null;
  const fallback = emptyKit();
  return {
    id: v.id,
    fileSlug: typeof v.fileSlug === 'string' && v.fileSlug.trim() ? slugify(v.fileSlug) : 'press-kit',
    title: {
      en: typeof v.title?.en === 'string' ? v.title.en : '',
      ar: typeof v.title?.ar === 'string' ? v.title.ar : '',
    },
    intro: {
      en: typeof v.intro?.en === 'string' ? v.intro.en : '',
      ar: typeof v.intro?.ar === 'string' ? v.intro.ar : '',
    },
    productIds: Array.isArray(v.productIds)
      ? v.productIds.filter((p): p is string => typeof p === 'string')
      : [],
    coverImageUrl: typeof v.coverImageUrl === 'string' ? v.coverImageUrl : null,
    accentVar:
      typeof v.accentVar === 'string' && v.accentVar.startsWith('--')
        ? v.accentVar
        : null,
    pressContact: {
      name: typeof v.pressContact?.name === 'string' ? v.pressContact.name : '',
      email: typeof v.pressContact?.email === 'string' ? v.pressContact.email : '',
      phone: typeof v.pressContact?.phone === 'string' ? v.pressContact.phone : '',
    },
    createdAt: typeof v.createdAt === 'string' ? v.createdAt : fallback.createdAt,
    updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : fallback.updatedAt,
  };
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'press-kit';
}

export async function listKits(slug: string): Promise<LookbookKit[]> {
  const idx = await getAppState(slug, APP_ID, INDEX_KEY).catch(() => null);
  const ids =
    idx && Array.isArray((idx.value as KitIndex).ids)
      ? ((idx.value as KitIndex).ids as string[])
      : [];
  if (ids.length === 0) return [];
  const rows = await Promise.all(
    ids.map((id) => getAppState(slug, APP_ID, `kit:${id}`).catch(() => null)),
  );
  const out: LookbookKit[] = [];
  for (const r of rows) {
    if (!r) continue;
    const k = resolveKit(r.value);
    if (k) out.push(k);
  }
  out.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return out;
}

export async function getKit(slug: string, kitId: string): Promise<LookbookKit | null> {
  const row = await getAppState(slug, APP_ID, `kit:${kitId}`).catch(() => null);
  if (!row) return null;
  return resolveKit(row.value);
}

export async function saveKit(slug: string, kit: LookbookKit): Promise<LookbookKit> {
  const id = kit.id || generateKitId();
  const now = new Date().toISOString();
  const next: LookbookKit = {
    ...kit,
    id,
    fileSlug: slugify(kit.fileSlug || kit.title.en || 'press-kit'),
    createdAt: kit.createdAt || now,
    updatedAt: now,
  };
  await setAppState(slug, APP_ID, `kit:${id}`, next as unknown as Record<string, unknown>);

  const idxRow = await getAppState(slug, APP_ID, INDEX_KEY).catch(() => null);
  const ids = new Set(
    idxRow && Array.isArray((idxRow.value as KitIndex).ids)
      ? ((idxRow.value as KitIndex).ids as string[])
      : [],
  );
  ids.add(id);
  await setAppState(slug, APP_ID, INDEX_KEY, {
    ids: Array.from(ids),
    updatedAt: now,
  });
  return next;
}

export async function removeKit(slug: string, kitId: string): Promise<void> {
  // We keep the per-kit row (for "undo" later) but drop it from the index.
  const idxRow = await getAppState(slug, APP_ID, INDEX_KEY).catch(() => null);
  const ids =
    idxRow && Array.isArray((idxRow.value as KitIndex).ids)
      ? ((idxRow.value as KitIndex).ids as string[])
      : [];
  await setAppState(slug, APP_ID, INDEX_KEY, {
    ids: ids.filter((i) => i !== kitId),
    updatedAt: new Date().toISOString(),
  });
}

function generateKitId(): string {
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
