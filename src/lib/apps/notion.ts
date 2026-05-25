import { decryptToken } from './crypto';
import { getInstalledApp } from './installed';
import type { AppEvent } from './dispatch';
import type { Inquiry } from '@/lib/inquiries';
import type { Order } from '@/lib/orders';
import type { Product } from '@/lib/products';

/**
 * Notion plugin — one-way mirror Souqna → Notion.
 *
 * Auth model: founder creates an internal Notion integration in their
 * own workspace, copies the integration secret, and shares each
 * destination database with that integration. Souqna stores the
 * secret encrypted at rest and uses it ONLY to insert pages into the
 * databases the founder explicitly listed.
 *
 * No Notion OAuth client on Souqna's side. The integration is owned
 * by the founder; Souqna can be disconnected at any time by either
 * uninstalling the app or revoking the integration in Notion.
 */

export type NotionEntity = 'inquiries' | 'orders' | 'products';

export type NotionSettings = {
  /** Database id (32-char dashless or dashed UUID) the founder pasted
   *  for each entity. Empty string = don't mirror that entity. */
  databaseIds: Partial<Record<NotionEntity, string>>;
};

export const DEFAULT_NOTION_SETTINGS: NotionSettings = {
  databaseIds: {},
};

export function normaliseSettings(
  raw: Partial<NotionSettings> | null | undefined,
): NotionSettings {
  if (!raw || !raw.databaseIds) return DEFAULT_NOTION_SETTINGS;
  const out: NotionSettings['databaseIds'] = {};
  for (const k of ['inquiries', 'orders', 'products'] as NotionEntity[]) {
    const v = raw.databaseIds[k];
    if (typeof v === 'string' && v.trim().length > 0) {
      out[k] = normaliseDatabaseId(v.trim());
    }
  }
  return { databaseIds: out };
}

const ID_RE = /^[0-9a-f]{32}$/i;

export function normaliseDatabaseId(input: string): string {
  // Notion accepts either dashed (8-4-4-4-12) or dashless 32-hex IDs.
  // Founders frequently paste the full URL; strip everything to the
  // last hex run.
  const trimmed = input.trim();
  const hexOnly = trimmed.replace(/[^0-9a-f]/gi, '');
  if (hexOnly.length >= 32) {
    const tail = hexOnly.slice(hexOnly.length - 32);
    if (ID_RE.test(tail)) return tail;
  }
  return trimmed;
}

const NOTION_API_VERSION = '2022-06-28';
const PAGES_URL = 'https://api.notion.com/v1/pages';

export async function onEvent(event: AppEvent): Promise<void> {
  const installed = await getInstalledApp(event.storefrontSlug, 'notion');
  if (!installed || !installed.enabled) return;
  const token = decryptToken(installed.oauthAccessTokenCt);
  if (!token) return;
  const settings = normaliseSettings(installed.settings as Partial<NotionSettings>);

  const entity: NotionEntity | null =
    event.kind === 'inquiry.created'
      ? 'inquiries'
      : event.kind === 'order.created'
        ? 'orders'
        : event.kind === 'product.created'
          ? 'products'
          : null;
  if (!entity) return;
  const dbId = settings.databaseIds[entity];
  if (!dbId) return;

  const properties =
    entity === 'inquiries'
      ? inquiryProperties(
          (event as Extract<AppEvent, { kind: 'inquiry.created' }>).inquiry,
        )
      : entity === 'orders'
        ? orderProperties(
            (event as Extract<AppEvent, { kind: 'order.created' }>).order,
          )
        : productProperties(
            (event as Extract<AppEvent, { kind: 'product.created' }>).product,
          );

  await postPage(token, dbId, properties);
}

/**
 * Backfill an entire entity table to the founder's Notion DB. Called
 * from the "Sync existing" button in settings. Caller passes already-
 * loaded rows so this module stays free of cross-entity DB imports.
 */
export async function syncBatch(
  token: string,
  databaseId: string,
  rows: Array<{ entity: NotionEntity; payload: Inquiry | Order | Product }>,
  onProgress?: (done: number, total: number) => void,
): Promise<{ ok: number; failed: number; lastError?: string }> {
  let ok = 0;
  let failed = 0;
  let lastError: string | undefined;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const props =
      row.entity === 'inquiries'
        ? inquiryProperties(row.payload as Inquiry)
        : row.entity === 'orders'
          ? orderProperties(row.payload as Order)
          : productProperties(row.payload as Product);
    try {
      await postPage(token, databaseId, props);
      ok += 1;
    } catch (err) {
      failed += 1;
      lastError = err instanceof Error ? err.message : 'unknown error';
    }
    onProgress?.(i + 1, rows.length);
  }
  return { ok, failed, ...(lastError ? { lastError } : {}) };
}

async function postPage(
  token: string,
  databaseId: string,
  properties: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(PAGES_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_API_VERSION,
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
    };
    throw new Error(
      `Notion ${res.status} ${body.code ?? ''}: ${body.message ?? 'request failed'}`.trim(),
    );
  }
}

// ---------------------------------------------------------------
// Property builders. Tolerant of mismatched DB schemas: every row
// uses the most permissive property type so a founder doesn't need
// to mirror Souqna's exact schema in their database.
// ---------------------------------------------------------------

function title(value: string) {
  return { title: [{ type: 'text', text: { content: truncate(value, 1900) } }] };
}
function richText(value: string | null | undefined) {
  if (!value) return { rich_text: [] };
  return { rich_text: [{ type: 'text', text: { content: truncate(value, 1900) } }] };
}
function number(v: number | null | undefined) {
  return { number: typeof v === 'number' ? v : null };
}
function date(d: Date | null | undefined) {
  return { date: d ? { start: d.toISOString() } : null };
}
function selectVal(name: string | null | undefined) {
  if (!name) return { select: null };
  return { select: { name: truncate(name, 90) } };
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function inquiryProperties(i: Inquiry): Record<string, unknown> {
  const headline = i.productTitle
    ? `${i.productTitle} · inquiry`
    : `Inquiry from ${i.visitorName ?? i.visitorEmail ?? 'visitor'}`;
  return {
    Name: title(headline),
    Email: richText(i.visitorEmail),
    Phone: richText(i.visitorPhone),
    Message: richText(i.message),
    Channel: selectVal(i.preferredChannel),
    Status: selectVal(i.status),
    Source: richText(i.sourceUrl),
    Created: date(i.createdAt),
  };
}

function orderProperties(o: Order): Record<string, unknown> {
  return {
    Name: title(`Order #${o.orderNumber}`),
    Status: selectVal(o.status),
    'Payment status': selectVal(o.paymentStatus),
    'Fulfilment status': selectVal(o.fulfilmentStatus),
    Total: number(o.total),
    Currency: selectVal(o.currencyCode),
    Channel: selectVal(o.channel),
    Notes: richText(o.notes),
    Placed: date(o.placedAt),
    Created: date(o.createdAt),
  };
}

function productProperties(p: Product): Record<string, unknown> {
  return {
    Name: title(p.title),
    Description: richText(p.description),
    Price: number(p.priceQar),
    Category: selectVal(p.category),
    Status: selectVal(p.status),
    Image: richText(p.imageUrl),
    Created: date(p.createdAt),
  };
}
