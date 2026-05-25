import { unstable_noStore as noStore } from 'next/cache';
import { db } from '../db';

/**
 * Per-store install record for a marketplace app. The credential
 * columns hold AES-256-GCM ciphertext (see src/lib/apps/crypto.ts).
 * This module deliberately returns the raw ciphertext: helpers in
 * `crypto.ts` decrypt at the very moment of use to keep plaintext
 * out of memory longer than necessary.
 */
export type InstalledApp = {
  id: number;
  storefrontSlug: string;
  appId: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  providerAccount: Record<string, unknown>;
  oauthAccessTokenCt: string;
  oauthRefreshTokenCt: string;
  oauthExpiresAt: Date | null;
  oauthScope: string | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  installedBy: string;
  installedAt: Date;
  updatedAt: Date;
};

type InstalledAppRow = {
  id: number;
  storefront_slug: string;
  app_id: string;
  enabled: boolean;
  settings: unknown;
  provider_account: unknown;
  oauth_access_token: string;
  oauth_refresh_token: string;
  oauth_expires_at: string | null;
  oauth_scope: string | null;
  last_success_at: string | null;
  last_error: string | null;
  installed_by: string;
  installed_at: string;
  updated_at: string;
};

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function fromRow(r: InstalledAppRow): InstalledApp {
  return {
    id: r.id,
    storefrontSlug: r.storefront_slug,
    appId: r.app_id,
    enabled: r.enabled,
    settings: asObj(r.settings),
    providerAccount: asObj(r.provider_account),
    oauthAccessTokenCt: r.oauth_access_token,
    oauthRefreshTokenCt: r.oauth_refresh_token,
    oauthExpiresAt: r.oauth_expires_at ? new Date(r.oauth_expires_at) : null,
    oauthScope: r.oauth_scope,
    lastSuccessAt: r.last_success_at ? new Date(r.last_success_at) : null,
    lastError: r.last_error,
    installedBy: r.installed_by,
    installedAt: new Date(r.installed_at),
    updatedAt: new Date(r.updated_at),
  };
}

export async function listInstalledApps(
  storefrontSlug: string,
): Promise<InstalledApp[]> {
  noStore();
  const rows = (await db()`
    select * from installed_apps
    where storefront_slug = ${storefrontSlug}
    order by installed_at desc
  `) as unknown as InstalledAppRow[];
  return rows.map(fromRow);
}

export async function getInstalledApp(
  storefrontSlug: string,
  appId: string,
): Promise<InstalledApp | null> {
  noStore();
  const rows = (await db()`
    select * from installed_apps
    where storefront_slug = ${storefrontSlug} and app_id = ${appId}
    limit 1
  `) as unknown as InstalledAppRow[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function getInstalledAppByProviderAccountField(
  appId: string,
  field: string,
  value: string,
): Promise<InstalledApp | null> {
  noStore();
  const rows = (await db()`
    select * from installed_apps
    where app_id = ${appId}
      and enabled = true
      and provider_account ->> ${field} = ${value}
    order by updated_at desc
    limit 1
  `) as unknown as InstalledAppRow[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export type InstallAppInput = {
  appId: string;
  installedBy: string;
  settings?: Record<string, unknown>;
  providerAccount?: Record<string, unknown>;
  accessTokenCt?: string;
  refreshTokenCt?: string;
  expiresAt?: Date | null;
  scope?: string | null;
};

export async function installApp(
  storefrontSlug: string,
  input: InstallAppInput,
): Promise<InstalledApp> {
  const rows = (await db()`
    insert into installed_apps (
      storefront_slug, app_id, enabled, settings, provider_account,
      oauth_access_token, oauth_refresh_token, oauth_expires_at, oauth_scope,
      installed_by, last_success_at
    ) values (
      ${storefrontSlug}, ${input.appId}, true,
      ${JSON.stringify(input.settings ?? {})}::jsonb,
      ${JSON.stringify(input.providerAccount ?? {})}::jsonb,
      ${input.accessTokenCt ?? ''}, ${input.refreshTokenCt ?? ''},
      ${input.expiresAt ? input.expiresAt.toISOString() : null},
      ${input.scope ?? null},
      ${input.installedBy}, now()
    )
    on conflict (storefront_slug, app_id) do update set
      enabled = true,
      settings = coalesce(excluded.settings, installed_apps.settings),
      provider_account = coalesce(excluded.provider_account, installed_apps.provider_account),
      oauth_access_token = case when excluded.oauth_access_token <> '' then excluded.oauth_access_token else installed_apps.oauth_access_token end,
      oauth_refresh_token = case when excluded.oauth_refresh_token <> '' then excluded.oauth_refresh_token else installed_apps.oauth_refresh_token end,
      oauth_expires_at = coalesce(excluded.oauth_expires_at, installed_apps.oauth_expires_at),
      oauth_scope = coalesce(excluded.oauth_scope, installed_apps.oauth_scope),
      last_success_at = now(),
      last_error = null,
      updated_at = now()
    returning *
  `) as unknown as InstalledAppRow[];
  if (!rows[0]) throw new Error('install app failed');
  return fromRow(rows[0]);
}

export async function uninstallApp(
  storefrontSlug: string,
  appId: string,
): Promise<boolean> {
  const rows = (await db()`
    delete from installed_apps
    where storefront_slug = ${storefrontSlug} and app_id = ${appId}
    returning id
  `) as unknown as { id: number }[];
  return rows.length > 0;
}

export async function updateAppSettings(
  storefrontSlug: string,
  appId: string,
  settings: Record<string, unknown>,
): Promise<InstalledApp | null> {
  const rows = (await db()`
    update installed_apps set
      settings = ${JSON.stringify(settings)}::jsonb,
      updated_at = now()
    where storefront_slug = ${storefrontSlug} and app_id = ${appId}
    returning *
  `) as unknown as InstalledAppRow[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function updateOAuthTokens(
  storefrontSlug: string,
  appId: string,
  input: {
    accessTokenCt?: string;
    refreshTokenCt?: string;
    expiresAt?: Date | null;
    scope?: string | null;
  },
): Promise<InstalledApp | null> {
  const rows = (await db()`
    update installed_apps set
      oauth_access_token = case
        when ${input.accessTokenCt ?? ''} <> '' then ${input.accessTokenCt ?? ''}
        else oauth_access_token
      end,
      oauth_refresh_token = case
        when ${input.refreshTokenCt ?? ''} <> '' then ${input.refreshTokenCt ?? ''}
        else oauth_refresh_token
      end,
      oauth_expires_at = ${input.expiresAt ? input.expiresAt.toISOString() : null},
      oauth_scope = coalesce(${input.scope ?? null}, oauth_scope),
      updated_at = now()
    where storefront_slug = ${storefrontSlug} and app_id = ${appId}
    returning *
  `) as unknown as InstalledAppRow[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function setAppLastSuccess(
  storefrontSlug: string,
  appId: string,
): Promise<void> {
  await db()`
    update installed_apps set
      last_success_at = now(), last_error = null, updated_at = now()
    where storefront_slug = ${storefrontSlug} and app_id = ${appId}
  `;
}

export async function setAppLastError(
  storefrontSlug: string,
  appId: string,
  error: string,
): Promise<void> {
  await db()`
    update installed_apps set
      last_error = ${error.slice(0, 1000)}, updated_at = now()
    where storefront_slug = ${storefrontSlug} and app_id = ${appId}
  `;
}

export type AppStateRow = {
  storefrontSlug: string;
  appId: string;
  key: string;
  value: Record<string, unknown>;
  updatedAt: Date;
};

export async function getAppState(
  storefrontSlug: string,
  appId: string,
  key: string,
): Promise<AppStateRow | null> {
  noStore();
  const rows = (await db()`
    select * from app_state
    where storefront_slug = ${storefrontSlug}
      and app_id = ${appId}
      and key = ${key}
    limit 1
  `) as unknown as Array<{
    storefront_slug: string;
    app_id: string;
    key: string;
    value: unknown;
    updated_at: string;
  }>;
  const r = rows[0];
  if (!r) return null;
  return {
    storefrontSlug: r.storefront_slug,
    appId: r.app_id,
    key: r.key,
    value: asObj(r.value),
    updatedAt: new Date(r.updated_at),
  };
}

export async function setAppState(
  storefrontSlug: string,
  appId: string,
  key: string,
  value: Record<string, unknown>,
): Promise<void> {
  await db()`
    insert into app_state (storefront_slug, app_id, key, value)
    values (
      ${storefrontSlug}, ${appId}, ${key},
      ${JSON.stringify(value)}::jsonb
    )
    on conflict (storefront_slug, app_id, key) do update set
      value = excluded.value,
      updated_at = now()
  `;
}
