import { createSign } from 'node:crypto';
import { decryptToken } from './crypto';
import { getInstalledApp } from './installed';
import type { AppEvent } from './dispatch';
import type { Inquiry } from '@/lib/inquiries';
import type { Order, OrderItem } from '@/lib/orders';
import type { Product } from '@/lib/products';

/**
 * Google Sheets plugin (service-account auth, no Souqna OAuth client).
 *
 * Auth model:
 *   1. Founder creates a service account in their own Google Cloud
 *      project (free; takes ~2 minutes).
 *   2. Founder downloads the JSON key and shares the destination
 *      spreadsheet with the service account's email.
 *   3. Founder pastes the entire JSON into Souqna's settings panel.
 *      We store it AES-GCM-encrypted in `installed_apps.oauth_access_token`
 *      and decrypt at the moment of use.
 *
 * Souqna never registers a Google OAuth app. The service account
 * belongs to the founder; the spreadsheet belongs to the founder; the
 * data flow is founder → founder.
 */

export type SheetsEntity = 'inquiries' | 'orders' | 'products';

export type SheetsSettings = {
  spreadsheetId: string;
  /** Per-entity tab name (Sheet1, Inquiries, etc) + enable flag.
   *  Empty/disabled rows skip writes for that entity. */
  tabs: Partial<Record<SheetsEntity, { tabName: string; enabled: boolean }>>;
  /** When true, every event appends a row in real-time. When false,
   *  only manual "Export now" runs write data. */
  appendOnEvent: boolean;
};

export const DEFAULT_SHEETS_SETTINGS: SheetsSettings = {
  spreadsheetId: '',
  tabs: {
    inquiries: { tabName: 'Inquiries', enabled: true },
    orders: { tabName: 'Orders', enabled: true },
    products: { tabName: 'Products', enabled: false },
  },
  appendOnEvent: true,
};

export function normaliseSettings(
  raw: Partial<SheetsSettings> | null | undefined,
): SheetsSettings {
  if (!raw) return DEFAULT_SHEETS_SETTINGS;
  const tabs = (raw.tabs ?? {}) as SheetsSettings['tabs'];
  const out: SheetsSettings['tabs'] = {};
  for (const k of ['inquiries', 'orders', 'products'] as SheetsEntity[]) {
    const v = tabs[k];
    out[k] = {
      tabName:
        v && typeof v.tabName === 'string' && v.tabName.trim()
          ? v.tabName.trim().slice(0, 80)
          : DEFAULT_SHEETS_SETTINGS.tabs[k]!.tabName,
      enabled:
        v && typeof v.enabled === 'boolean'
          ? v.enabled
          : DEFAULT_SHEETS_SETTINGS.tabs[k]!.enabled,
    };
  }
  return {
    spreadsheetId: typeof raw.spreadsheetId === 'string' ? extractSpreadsheetId(raw.spreadsheetId) : '',
    tabs: out,
    appendOnEvent: typeof raw.appendOnEvent === 'boolean' ? raw.appendOnEvent : true,
  };
}

export function extractSpreadsheetId(input: string): string {
  // Founders frequently paste the full sheet URL — pull the id out.
  const trimmed = input.trim();
  const m = trimmed.match(/\/d\/([a-zA-Z0-9-_]{20,})/);
  if (m && m[1]) return m[1];
  return trimmed.slice(0, 80);
}

export type ServiceAccountKey = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

export function parseServiceAccount(json: string): ServiceAccountKey | null {
  try {
    const parsed = JSON.parse(json);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.client_email === 'string' &&
      typeof parsed.private_key === 'string'
    ) {
      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
        token_uri: parsed.token_uri ?? 'https://oauth2.googleapis.com/token',
      };
    }
  } catch {
    /* fall through */
  }
  return null;
}

// ---------------------------------------------------------------
// JWT bearer + token cache (no googleapis dep needed)
// ---------------------------------------------------------------

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(key: ServiceAccountKey): Promise<string> {
  const cacheKey = key.client_email;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt - Date.now() > 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: key.token_uri ?? 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const encHeader = base64url(JSON.stringify(header));
  const encClaims = base64url(JSON.stringify(claims));
  const signingInput = `${encHeader}.${encClaims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(key.private_key).toString('base64url');
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch(key.token_uri ?? 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Google token exchange ${res.status}: ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache.set(cacheKey, {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  });
  return json.access_token;
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// ---------------------------------------------------------------
// Sheets API
// ---------------------------------------------------------------

export async function appendRow(
  key: ServiceAccountKey,
  spreadsheetId: string,
  tabName: string,
  row: (string | number | null)[],
): Promise<void> {
  const token = await getAccessToken(key);
  const range = `${encodeURIComponent(tabName)}!A:Z`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId,
  )}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ values: [row] }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Sheets API ${res.status}: ${detail.slice(0, 200)}`);
  }
}

export async function appendBatch(
  key: ServiceAccountKey,
  spreadsheetId: string,
  tabName: string,
  rows: (string | number | null)[][],
): Promise<void> {
  if (rows.length === 0) return;
  const token = await getAccessToken(key);
  const range = `${encodeURIComponent(tabName)}!A:Z`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId,
  )}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ values: rows }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Sheets API ${res.status}: ${detail.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------
// Event hook + row builders
// ---------------------------------------------------------------

export async function onEvent(event: AppEvent): Promise<void> {
  const installed = await getInstalledApp(event.storefrontSlug, 'google-sheets');
  if (!installed || !installed.enabled) return;
  const settings = normaliseSettings(installed.settings as Partial<SheetsSettings>);
  if (!settings.appendOnEvent || !settings.spreadsheetId) return;
  const json = decryptToken(installed.oauthAccessTokenCt);
  if (!json) return;
  const key = parseServiceAccount(json);
  if (!key) return;

  const entity: SheetsEntity | null =
    event.kind === 'inquiry.created'
      ? 'inquiries'
      : event.kind === 'order.created'
        ? 'orders'
        : event.kind === 'product.created'
          ? 'products'
          : null;
  if (!entity) return;
  const tab = settings.tabs[entity];
  if (!tab || !tab.enabled) return;

  const row =
    entity === 'inquiries'
      ? inquiryRow(
          (event as Extract<AppEvent, { kind: 'inquiry.created' }>).inquiry,
        )
      : entity === 'orders'
        ? orderRow(
            (event as Extract<AppEvent, { kind: 'order.created' }>).order,
            (event as Extract<AppEvent, { kind: 'order.created' }>).items,
          )
        : productRow(
            (event as Extract<AppEvent, { kind: 'product.created' }>).product,
          );

  await appendRow(key, settings.spreadsheetId, tab.tabName, row);
}

export const HEADERS: Record<SheetsEntity, string[]> = {
  inquiries: [
    'Created at',
    'Inquiry id',
    'Visitor name',
    'Email',
    'Phone',
    'Channel',
    'Product',
    'Message',
    'Source',
  ],
  orders: [
    'Created at',
    'Order #',
    'Status',
    'Payment',
    'Fulfilment',
    'Total',
    'Currency',
    'Items',
    'Channel',
  ],
  products: [
    'Created at',
    'Product id',
    'Title',
    'Category',
    'Price (QAR)',
    'Status',
    'Description',
  ],
};

export function inquiryRow(i: Inquiry): (string | number | null)[] {
  return [
    i.createdAt.toISOString(),
    i.id,
    i.visitorName ?? '',
    i.visitorEmail ?? '',
    i.visitorPhone ?? '',
    i.preferredChannel,
    i.productTitle ?? '',
    i.message,
    i.sourceUrl ?? '',
  ];
}

export function orderRow(o: Order, items: OrderItem[]): (string | number | null)[] {
  const summary = items
    .map((it) => `${it.quantity}× ${it.productTitle}`)
    .join(' · ');
  return [
    o.createdAt.toISOString(),
    o.orderNumber,
    o.status,
    o.paymentStatus,
    o.fulfilmentStatus,
    o.total,
    o.currencyCode,
    summary,
    o.channel,
  ];
}

export function productRow(p: Product): (string | number | null)[] {
  return [
    p.createdAt.toISOString(),
    p.id,
    p.title,
    p.category ?? '',
    p.priceQar ?? '',
    p.status,
    p.description ?? '',
  ];
}
