import { createHash } from 'node:crypto';
import type { AppEvent } from './dispatch';
import {
  getInstalledApp,
  installApp,
  setAppLastError,
  setAppLastSuccess,
  updateAppSettings,
  updateOAuthTokens,
  type InstalledApp,
} from './installed';
import { requiredOAuthEnv } from './oauth';
import { decryptToken, encryptToken } from './crypto';
import { listCustomers, type Customer } from '@/lib/customers';
import { getAllProducts, type Product } from '@/lib/products';
import { recordAudit } from '@/lib/audit';
import { env } from '@/lib/env';
import { DEFAULT_WHATSAPP_SETTINGS } from './whatsapp';

const KLAVIYO_REVISION = '2026-04-15';

class HttpError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

type OAuthTokens = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scope?: string | null;
  providerAccount?: Record<string, unknown>;
  settings?: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function jsonFetch<T>(
  url: string,
  init: RequestInit,
  context: string,
): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { message: text.slice(0, 500) };
    }
  }
  if (!res.ok) {
    const message =
      asRecord(asRecord(body).error).message ??
      asRecord(body).detail ??
      asRecord(body).message ??
      `${context} failed`;
    throw new HttpError(String(message), res.status, body);
  }
  return body as T;
}

export async function exchangeMailchimpCode(input: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<OAuthTokens> {
  const token = await jsonFetch<Record<string, unknown>>(
    'https://login.mailchimp.com/oauth2/token',
    {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: input.clientId,
        client_secret: input.clientSecret,
        redirect_uri: input.redirectUri,
        code: input.code,
      }),
    },
    'Mailchimp token exchange',
  );
  const accessToken = String(token.access_token ?? '');
  if (!accessToken) throw new Error('Mailchimp did not return an access token.');

  const metadata = await jsonFetch<Record<string, unknown>>(
    'https://login.mailchimp.com/oauth2/metadata',
    { headers: { Authorization: `OAuth ${accessToken}` } },
    'Mailchimp metadata fetch',
  );
  const dc = String(metadata.dc ?? '');
  if (!dc) throw new Error('Mailchimp did not return a data-center prefix.');

  const audience = await firstMailchimpAudience(accessToken, dc).catch(() => null);
  return {
    accessToken,
    providerAccount: {
      provider: 'mailchimp',
      dc,
      accountId: metadata.account_id ?? null,
      loginId: metadata.login_id ?? null,
      loginName: metadata.login_name ?? null,
      apiEndpoint: `https://${dc}.api.mailchimp.com/3.0`,
    },
    settings: {
      audienceId: audience?.id ?? null,
      audienceName: audience?.name ?? null,
      lastSync: null,
    },
  };
}

async function firstMailchimpAudience(accessToken: string, dc: string) {
  const body = await jsonFetch<Record<string, unknown>>(
    `https://${dc}.api.mailchimp.com/3.0/lists?count=10`,
    { headers: { Authorization: `OAuth ${accessToken}` } },
    'Mailchimp audience fetch',
  );
  const lists = Array.isArray(body.lists) ? body.lists : [];
  const first = asRecord(lists[0]);
  const id = typeof first.id === 'string' ? first.id : '';
  if (!id) return null;
  return { id, name: typeof first.name === 'string' ? first.name : id };
}

export async function exchangeKlaviyoCode(input: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
}): Promise<OAuthTokens> {
  const token = await jsonFetch<Record<string, unknown>>(
    'https://a.klaviyo.com/oauth/token',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${input.clientId}:${input.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: input.code,
        redirect_uri: input.redirectUri,
        code_verifier: input.codeVerifier,
      }),
    },
    'Klaviyo token exchange',
  );
  const accessToken = String(token.access_token ?? '');
  if (!accessToken) throw new Error('Klaviyo did not return an access token.');
  const expiresIn = Number(token.expires_in ?? 0);
  const account = (await klaviyoApi<Record<string, unknown>>(
    accessToken,
    '/api/accounts/',
    { method: 'GET' },
  ).catch(() => ({}))) as Record<string, unknown>;
  const accountData = asRecord(Array.isArray(account.data) ? account.data[0] : account.data);
  const accountAttributes = asRecord(accountData.attributes);
  return {
    accessToken,
    refreshToken:
      typeof token.refresh_token === 'string' ? token.refresh_token : null,
    expiresAt:
      Number.isFinite(expiresIn) && expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000)
        : null,
    scope: typeof token.scope === 'string' ? token.scope : null,
    providerAccount: {
      provider: 'klaviyo',
      accountId: accountData.id ?? null,
      name: accountAttributes.name ?? null,
      contactEmail: accountAttributes.contact_email ?? null,
    },
    settings: { lastSync: null },
  };
}

async function klaviyoApi<T>(
  accessToken: string,
  path: string,
  init: RequestInit,
): Promise<T> {
  return jsonFetch<T>(
    `https://a.klaviyo.com${path}`,
    {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        revision: KLAVIYO_REVISION,
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers ?? {}),
      },
    },
    'Klaviyo API request',
  );
}

export async function exchangeMetaCode(input: {
  appId: 'whatsapp-business' | 'instagram-shop';
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<OAuthTokens> {
  const token = await jsonFetch<Record<string, unknown>>(
    `https://graph.facebook.com/${env.META_GRAPH_VERSION}/oauth/access_token`,
    {
      method: 'POST',
      body: new URLSearchParams({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        redirect_uri: input.redirectUri,
        code: input.code,
      }),
    },
    'Meta token exchange',
  );
  const accessToken = String(token.access_token ?? '');
  if (!accessToken) throw new Error('Meta did not return an access token.');
  const expiresIn = Number(token.expires_in ?? 0);
  const me = (await metaGet<Record<string, unknown>>(
    accessToken,
    '/me?fields=id,name,email',
  ).catch(() => ({}))) as Record<string, unknown>;
  const businesses = (await metaGet<Record<string, unknown>>(
    accessToken,
    '/me/businesses?fields=id,name',
  ).catch(() => ({ data: [] }))) as Record<string, unknown>;
  const firstBusiness = asRecord(
    Array.isArray(businesses.data) ? businesses.data[0] : null,
  );

  if (input.appId === 'whatsapp-business') {
    const wabas = firstBusiness.id
      ? ((await metaGet<Record<string, unknown>>(
          accessToken,
          `/${firstBusiness.id}/owned_whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name}`,
        ).catch(() => ({ data: [] }))) as Record<string, unknown>)
      : { data: [] };
    const firstWaba = asRecord(Array.isArray(wabas.data) ? wabas.data[0] : null);
    const phoneNumbers = asRecord(firstWaba.phone_numbers);
    const firstPhone = asRecord(
      Array.isArray(phoneNumbers.data) ? phoneNumbers.data[0] : null,
    );
    return {
      accessToken,
      expiresAt:
        Number.isFinite(expiresIn) && expiresIn > 0
          ? new Date(Date.now() + expiresIn * 1000)
          : null,
      providerAccount: {
        provider: 'meta',
        app: 'whatsapp-business',
        userId: me.id ?? null,
        userName: me.name ?? null,
        businessId: firstBusiness.id ?? null,
        businessName: firstBusiness.name ?? null,
        wabaId: firstWaba.id ?? null,
        wabaName: firstWaba.name ?? null,
        phoneNumberId: firstPhone.id ?? null,
        displayPhoneNumber: firstPhone.display_phone_number ?? null,
        verifiedName: firstPhone.verified_name ?? null,
        gated: !firstWaba.id || !firstPhone.id,
      },
      settings: { ...DEFAULT_WHATSAPP_SETTINGS, lastSync: null },
    };
  }

  const catalogs = firstBusiness.id
    ? ((await metaGet<Record<string, unknown>>(
        accessToken,
        `/${firstBusiness.id}/owned_product_catalogs?fields=id,name`,
      ).catch(() => ({ data: [] }))) as Record<string, unknown>)
    : { data: [] };
  const firstCatalog = asRecord(Array.isArray(catalogs.data) ? catalogs.data[0] : null);
  return {
    accessToken,
    expiresAt:
      Number.isFinite(expiresIn) && expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000)
        : null,
    providerAccount: {
      provider: 'meta',
      app: 'instagram-shop',
      userId: me.id ?? null,
      userName: me.name ?? null,
      businessId: firstBusiness.id ?? null,
      businessName: firstBusiness.name ?? null,
      catalogId: firstCatalog.id ?? null,
      catalogName: firstCatalog.name ?? null,
      gated: !firstCatalog.id,
    },
    settings: {
      catalogId: firstCatalog.id ?? null,
      catalogName: firstCatalog.name ?? null,
      lastSync: null,
    },
  };
}

async function metaGet<T>(accessToken: string, path: string): Promise<T> {
  const url = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION}${path}`);
  url.searchParams.set('access_token', accessToken);
  return jsonFetch<T>(url.toString(), { method: 'GET' }, 'Meta Graph request');
}

export async function persistOAuthInstall(input: {
  storefrontSlug: string;
  appId: string;
  clerkUserId: string;
  tokens: OAuthTokens;
}) {
  await installApp(input.storefrontSlug, {
    appId: input.appId,
    installedBy: input.clerkUserId,
    settings: input.tokens.settings ?? {},
    providerAccount: input.tokens.providerAccount ?? {},
    accessTokenCt: encryptToken(input.tokens.accessToken),
    refreshTokenCt: encryptToken(input.tokens.refreshToken ?? ''),
    expiresAt: input.tokens.expiresAt ?? null,
    scope: input.tokens.scope ?? null,
  });
  await recordAudit({
    storefrontSlug: input.storefrontSlug,
    clerkUserId: input.clerkUserId,
    action: 'app.oauth.connect',
    targetId: input.appId,
    summary: `Connected ${input.appId}`,
    meta: { provider: input.tokens.providerAccount?.provider ?? input.appId },
  });
}

export async function syncOAuthApp(storefrontSlug: string, appId: string) {
  const installed = await getInstalledApp(storefrontSlug, appId);
  if (!installed) return;
  try {
    if (appId === 'mailchimp') await syncMailchimpBackfill(installed);
    if (appId === 'klaviyo') await syncKlaviyoBackfill(installed);
    if (appId === 'whatsapp-business') {
      if (installed.providerAccount.gated === true) {
        throw new Error(
          'Meta setup is incomplete. Connect an approved WhatsApp Business account and phone number before messaging can run.',
        );
      }
    }
    if (appId === 'instagram-shop') await syncInstagramCatalog(installed);
    await setAppLastSuccess(storefrontSlug, appId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth app sync failed';
    await setAppLastError(storefrontSlug, appId, message);
    throw err;
  }
}

export async function onMailchimpEvent(event: AppEvent) {
  const installed = await getInstalledApp(event.storefrontSlug, 'mailchimp');
  if (!installed?.enabled) return;
  if (event.kind === 'inquiry.created' && event.inquiry.visitorEmail) {
    await syncMailchimpContact(installed, {
      email: event.inquiry.visitorEmail,
      firstName: event.inquiry.visitorName,
      lastName: null,
      phone: event.inquiry.visitorPhone,
      tags: ['souqna', 'inquiry'],
      marketingConsent: true,
    });
  }
}

export async function onKlaviyoEvent(event: AppEvent) {
  const installed = await getInstalledApp(event.storefrontSlug, 'klaviyo');
  if (!installed?.enabled) return;
  if (event.kind === 'inquiry.created' && event.inquiry.visitorEmail) {
    await postKlaviyoEvent(installed, 'Souqna Inquiry Created', {
      email: event.inquiry.visitorEmail,
      phone: event.inquiry.visitorPhone,
      firstName: event.inquiry.visitorName,
      lastName: null,
      properties: {
        source: 'souqna',
        storefront: event.storefrontSlug,
        productTitle: event.inquiry.productTitle,
      },
    });
  }
  if (event.kind === 'order.created') {
    await postKlaviyoEvent(installed, 'Souqna Order Created', {
      email: String(event.order.meta.email ?? ''),
      phone: String(event.order.meta.phone ?? ''),
      firstName: null,
      lastName: null,
      properties: {
        source: 'souqna',
        storefront: event.storefrontSlug,
        orderNumber: event.order.orderNumber,
        total: event.order.total,
        currency: event.order.currencyCode,
        products: event.items.map((item) => item.productTitle),
      },
    });
  }
}

async function syncMailchimpBackfill(installed: InstalledApp) {
  if (!installed.settings.audienceId) {
    throw new Error('Choose a Mailchimp audience before syncing.');
  }
  const customers = await listCustomers(installed.storefrontSlug, { limit: 1000 });
  for (const customer of customers.filter((c) => c.email && c.marketingConsent)) {
    await syncMailchimpContact(installed, customer);
  }
  await updateAppSettings(installed.storefrontSlug, 'mailchimp', {
    ...installed.settings,
    lastSync: new Date().toISOString(),
  });
}

async function syncMailchimpContact(
  installed: InstalledApp,
  customer: Pick<
    Customer,
    'email' | 'phone' | 'firstName' | 'lastName' | 'tags' | 'marketingConsent'
  >,
) {
  const accessToken = decryptToken(installed.oauthAccessTokenCt);
  const dc = String(installed.providerAccount.dc ?? '');
  const audienceId = String(installed.settings.audienceId ?? '');
  if (!accessToken || !dc || !audienceId || !customer.email) return;
  if (!customer.marketingConsent) return;

  const hash = createHash('md5')
    .update(customer.email.trim().toLowerCase())
    .digest('hex');
  await jsonFetch(
    `https://${dc}.api.mailchimp.com/3.0/lists/${audienceId}/members/${hash}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `OAuth ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: customer.email,
        status_if_new: 'subscribed',
        status: 'subscribed',
        merge_fields: {
          FNAME: customer.firstName ?? '',
          LNAME: customer.lastName ?? '',
          PHONE: customer.phone ?? '',
        },
        tags: ['souqna', ...(customer.tags ?? [])],
      }),
    },
    'Mailchimp contact sync',
  );
}

async function syncKlaviyoBackfill(installed: InstalledApp) {
  const customers = await listCustomers(installed.storefrontSlug, { limit: 1000 });
  for (const customer of customers.filter((c) => c.email && c.marketingConsent)) {
    await postKlaviyoEvent(installed, 'Souqna Customer Synced', {
      email: customer.email,
      phone: customer.phone,
      firstName: customer.firstName,
      lastName: customer.lastName,
      properties: {
        source: 'souqna',
        storefront: installed.storefrontSlug,
        tags: customer.tags,
        orderCount: customer.orderCount,
        inquiryCount: customer.inquiryCount,
        totalSpent: customer.totalSpent,
      },
    });
  }
  await updateAppSettings(installed.storefrontSlug, 'klaviyo', {
    ...installed.settings,
    lastSync: new Date().toISOString(),
  });
}

async function postKlaviyoEvent(
  installed: InstalledApp,
  inputName: string,
  input: {
    email: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    properties: Record<string, unknown>;
  },
) {
  if (!input.email && !input.phone) return;
  await klaviyoApiForInstalled(installed, '/api/events/', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'event',
        attributes: {
          time: new Date().toISOString(),
          properties: input.properties,
          metric: {
            data: { type: 'metric', attributes: { name: inputName } },
          },
          profile: {
            data: {
              type: 'profile',
              attributes: {
                email: input.email || undefined,
                phone_number: input.phone || undefined,
                first_name: input.firstName || undefined,
                last_name: input.lastName || undefined,
              },
            },
          },
        },
      },
    }),
  });
}

async function getFreshKlaviyoAccessToken(installed: InstalledApp) {
  const accessToken = decryptToken(installed.oauthAccessTokenCt);
  if (!accessToken) throw new Error('Reconnect Klaviyo to refresh access.');
  const expiresAt = installed.oauthExpiresAt?.getTime() ?? 0;
  if (expiresAt > Date.now() + 120_000) return accessToken;
  return refreshKlaviyoTokens(installed);
}

async function refreshKlaviyoTokens(installed: InstalledApp) {
  const refreshToken = decryptToken(installed.oauthRefreshTokenCt);
  const client = requiredOAuthEnv('klaviyo');
  if (!refreshToken || !client) {
    await setAppLastError(
      installed.storefrontSlug,
      'klaviyo',
      'Reauthorization required: Klaviyo refresh credentials are missing.',
    );
    throw new Error('Reauthorization required: Klaviyo refresh credentials are missing.');
  }

  try {
    const token = await jsonFetch<Record<string, unknown>>(
      'https://a.klaviyo.com/oauth/token',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${client.clientId}:${client.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      },
      'Klaviyo token refresh',
    );
    const accessToken = String(token.access_token ?? '');
    if (!accessToken) throw new Error('Klaviyo did not return a refreshed access token.');
    const nextRefreshToken =
      typeof token.refresh_token === 'string' ? token.refresh_token : refreshToken;
    const expiresIn = Number(token.expires_in ?? 0);
    await updateOAuthTokens(installed.storefrontSlug, 'klaviyo', {
      accessTokenCt: encryptToken(accessToken),
      refreshTokenCt: encryptToken(nextRefreshToken),
      expiresAt:
        Number.isFinite(expiresIn) && expiresIn > 0
          ? new Date(Date.now() + expiresIn * 1000)
          : null,
      scope: typeof token.scope === 'string' ? token.scope : null,
    });
    return accessToken;
  } catch (err) {
    if (isInvalidGrant(err)) {
      await setAppLastError(
        installed.storefrontSlug,
        'klaviyo',
        'Reauthorization required: Klaviyo refresh token expired or was revoked.',
      );
    }
    throw err;
  }
}

async function klaviyoApiForInstalled<T>(
  installed: InstalledApp,
  path: string,
  init: RequestInit,
): Promise<T> {
  let accessToken = await getFreshKlaviyoAccessToken(installed);
  try {
    return await klaviyoApi<T>(accessToken, path, init);
  } catch (err) {
    if (!(err instanceof HttpError) || err.status !== 401) throw err;
    accessToken = await refreshKlaviyoTokens(installed);
    return klaviyoApi<T>(accessToken, path, init);
  }
}

function isInvalidGrant(err: unknown) {
  if (!(err instanceof HttpError)) return false;
  const body = asRecord(err.body);
  const errors = Array.isArray(body.errors) ? body.errors.map(asRecord) : [];
  return (
    body.error === 'invalid_grant' ||
    errors.some((item) => item.code === 'invalid_grant' || item.id === 'invalid_grant') ||
    /invalid_grant/i.test(err.message)
  );
}

async function syncInstagramCatalog(installed: InstalledApp) {
  const accessToken = decryptToken(installed.oauthAccessTokenCt);
  const catalogId = String(installed.settings.catalogId ?? '');
  if (!accessToken) throw new Error('Reconnect Instagram Shop before syncing.');
  if (!catalogId) {
    throw new Error('Select a Meta catalog before syncing Instagram Shop products.');
  }
  const products = (await getAllProducts(installed.storefrontSlug)).filter(
    (p) => p.status === 'active',
  );
  const validProducts = products
    .filter((product) => canSyncMetaProduct(product))
    .slice(0, 100);
  const skippedProducts = Math.max(0, products.length - validProducts.length);
  for (const product of validProducts) {
    await upsertMetaCatalogProduct(accessToken, catalogId, product);
  }
  await updateAppSettings(installed.storefrontSlug, 'instagram-shop', {
    ...installed.settings,
    lastSync: new Date().toISOString(),
    syncedProducts: validProducts.length,
    skippedProducts,
  });
}

function canSyncMetaProduct(product: Product) {
  return Boolean(product.imageUrl && product.priceQar && product.priceQar > 0);
}

async function upsertMetaCatalogProduct(
  accessToken: string,
  catalogId: string,
  product: Product,
) {
  const url = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${catalogId}/products`);
  url.searchParams.set('access_token', accessToken);
  await jsonFetch(
    url.toString(),
    {
      method: 'POST',
      body: new URLSearchParams({
        retailer_id: product.id,
        name: product.title,
        description: product.description || product.title,
        availability: product.status === 'sold_out' ? 'out of stock' : 'in stock',
        condition: 'new',
        price: `${Math.round((product.priceQar ?? 0) * 100)} QAR`,
        image_url: product.imageUrl || '',
        url: `https://souqna.qa/brief/${installedSafeSlug(product.storefrontSlug)}`,
      }),
    },
    'Meta catalog sync',
  );
}

function installedSafeSlug(slug: string) {
  return encodeURIComponent(slug);
}

export async function revokeOAuthProvider(installed: InstalledApp): Promise<void> {
  if (installed.appId !== 'klaviyo') return;
  const client = requiredOAuthEnv('klaviyo');
  const refreshToken = decryptToken(installed.oauthRefreshTokenCt);
  const accessToken = decryptToken(installed.oauthAccessTokenCt);
  const token = refreshToken || accessToken;
  if (!client || !token) return;
  await jsonFetch<Record<string, unknown>>(
    'https://a.klaviyo.com/oauth/revoke',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${client.clientId}:${client.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ token }),
    },
    'Klaviyo token revoke',
  ).catch((err) => {
    if (err instanceof HttpError && err.status === 400 && isInvalidGrant(err)) return {};
    throw err;
  });
}
