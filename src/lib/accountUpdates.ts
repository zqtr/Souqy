import 'server-only';

import { createHash } from 'node:crypto';
import { unstable_noStore as noStore } from 'next/cache';
import { db, hasDb } from './db';
import { PLAN_RANK, type Plan } from './plans';

export type AccountUpdateType = 'feature' | 'billing' | 'system' | 'warning';

export type AccountUpdate = {
  id: string;
  title: string;
  body: string;
  type: AccountUpdateType;
  version: string | null;
  priority: number;
  publishedAt: string;
  expiresAt: string | null;
  summary: string | null;
  badge: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  detailsHref: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  previewPayload: Record<string, unknown>;
  bannerPayload: Record<string, unknown>;
  isSticky: boolean;
  audience: Record<string, unknown>;
};

type AccountUpdateRow = {
  id: string;
  title: string;
  body: string;
  type: AccountUpdateType;
  version: string | null;
  priority: number;
  published_at: string;
  expires_at: string | null;
  summary: string | null;
  badge: string | null;
  cta_label: string | null;
  cta_href: string | null;
  details_href: string | null;
  image_url: string | null;
  video_url: string | null;
  preview_payload: unknown;
  banner_payload: unknown;
  is_sticky: boolean;
  audience: unknown;
};

type DeploymentEnv = Record<string, string | undefined>;

type DeploymentAccountUpdate = {
  id: string;
  title: string;
  body: string;
  version: string;
  priority: number;
  summary: string;
  badge: string;
  previewPayload: Record<string, unknown>;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function fromRow(row: AccountUpdateRow): AccountUpdate {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    type: row.type,
    version: row.version,
    priority: Number(row.priority ?? 0),
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
    summary: row.summary,
    badge: row.badge,
    ctaLabel: row.cta_label,
    ctaHref: row.cta_href,
    detailsHref: row.details_href,
    imageUrl: row.image_url,
    videoUrl: row.video_url,
    previewPayload: asObject(row.preview_payload),
    bannerPayload: asObject(row.banner_payload),
    isSticky: row.is_sticky === true,
    audience: asObject(row.audience),
  };
}

function isMissingUpdatesTableError(error: unknown): boolean {
  const code = typeof error === 'object' && error ? (error as { code?: unknown }).code : null;
  const message =
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message)
      : String(error);
  return (
    code === '42P01' ||
    message.includes('relation "updates" does not exist') ||
    message.includes('relation "user_update_reads" does not exist')
  );
}

function cleanEnvValue(value: string | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function cleanPublicUpdateText(value: string | null, fallback: string): string {
  const cleaned = value?.trim();
  if (!cleaned) return fallback;
  return /\bdpl_[a-z0-9_]+\b|deployment|deployed|deploy|production|vercel/iu.test(cleaned)
    ? fallback
    : cleaned;
}

export function accountUpdateIdFromSeed(seed: string): string {
  const hex = createHash('sha256').update(`souqna-account-update:${seed}`).digest('hex');
  const versionNibble = `4${hex.slice(13, 16)}`;
  const variantNibble = `${((Number.parseInt(hex[16] ?? '8', 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`;
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    versionNibble,
    variantNibble,
    hex.slice(20, 32),
  ].join('-');
}

export function productionDeploymentAccountUpdateFromEnv(
  source: DeploymentEnv = process.env,
): DeploymentAccountUpdate | null {
  const vercelEnv = cleanEnvValue(source.VERCEL_ENV ?? source.NEXT_PUBLIC_VERCEL_ENV);
  if (vercelEnv !== 'production') return null;

  const deploymentKey =
    cleanEnvValue(source.VERCEL_DEPLOYMENT_ID) ??
    cleanEnvValue(source.VERCEL_GIT_COMMIT_SHA) ??
    cleanEnvValue(source.VERCEL_URL);
  if (!deploymentKey) return null;

  const commitMessage = cleanEnvValue(source.VERCEL_GIT_COMMIT_MESSAGE);
  const fallback = 'Souqna improvements are ready to explore.';
  const visibleMessage = cleanPublicUpdateText(commitMessage, fallback);
  const summary =
    visibleMessage.length > 120
      ? `${visibleMessage.slice(0, 117).trimEnd()}...`
      : visibleMessage;
  const id = accountUpdateIdFromSeed(`push:${deploymentKey}`);

  return {
    id,
    title: summary === fallback ? 'Souqna update' : summary,
    body: summary,
    version: `update:${id.slice(0, 8)}`,
    priority: 35,
    summary,
    badge: 'Update',
    previewPayload: {
      kind: 'souqna-update',
      route: '/account',
    },
  };
}

export async function syncProductionDeploymentAccountUpdate(
  source: DeploymentEnv = process.env,
): Promise<void> {
  noStore();
  if (!hasDb()) return;
  const update = productionDeploymentAccountUpdateFromEnv(source);
  if (!update) return;
  const previewPayload = JSON.stringify(update.previewPayload);

  try {
    await db()`
      insert into updates (
        id, title, body, type, version, priority, published_at,
        summary, badge, is_active, is_sticky, audience,
        preview_payload, banner_payload
      ) values (
        ${update.id}, ${update.title}, ${update.body}, 'system', ${update.version}, ${update.priority}, now(),
        ${update.summary}, ${update.badge}, true, false, '{}'::jsonb,
        ${previewPayload}::jsonb, '{}'::jsonb
      )
      on conflict (id) do update
        set title = excluded.title,
            body = excluded.body,
            type = excluded.type,
            version = excluded.version,
            priority = excluded.priority,
            summary = excluded.summary,
            badge = excluded.badge,
            is_active = true,
            is_sticky = false,
            audience = '{}'::jsonb,
            preview_payload = excluded.preview_payload,
            banner_payload = excluded.banner_payload,
            updated_at = now()
    `;
  } catch (error) {
    if (!isMissingUpdatesTableError(error)) throw error;
    console.warn('[accountUpdates] changelog unavailable', error);
  }
}

export function accountUpdateAudienceMatchesPlan(
  audience: Record<string, unknown>,
  plan: Plan,
): boolean {
  const plans = audience.plans;
  if (Array.isArray(plans) && plans.length > 0 && !plans.includes(plan)) return false;

  const excludePlans = audience.excludePlans;
  if (Array.isArray(excludePlans) && excludePlans.includes(plan)) return false;

  const minPlan = audience.minPlan;
  if (
    typeof minPlan === 'string' &&
    minPlan in PLAN_RANK &&
    PLAN_RANK[plan] < PLAN_RANK[minPlan as Plan]
  ) {
    return false;
  }

  return true;
}

export async function listUnreadAccountUpdates(
  userId: string,
  plan: Plan,
  limit = 10,
): Promise<AccountUpdate[]> {
  noStore();
  if (!hasDb() || !userId) return [];
  let rows: AccountUpdateRow[];
  try {
    rows = (await db()`
      select
        u.id, u.title, u.body, u.type, u.version, u.priority,
        u.published_at, u.expires_at, u.summary, u.badge,
        u.cta_label, u.cta_href, u.details_href, u.image_url, u.video_url,
        u.preview_payload, u.banner_payload, u.is_sticky, u.audience
      from updates u
      where u.is_active = true
        and u.published_at <= now()
        and (u.expires_at is null or u.expires_at > now())
        and not exists (
          select 1
          from user_update_reads r
          where r.user_id = ${userId}
            and r.update_id = u.id
        )
      order by u.priority desc, u.published_at desc
      limit ${Math.min(Math.max(limit * 4, 10), 100)}
    `) as unknown as AccountUpdateRow[];
  } catch (error) {
    if (!isMissingUpdatesTableError(error)) throw error;
    console.warn('[accountUpdates] updates tables unavailable', error);
    return [];
  }

  return rows
    .map(fromRow)
    .filter((update) => accountUpdateAudienceMatchesPlan(update.audience, plan))
    .slice(0, Math.min(Math.max(limit, 1), 50));
}

export async function markAccountUpdateReadForUser(
  userId: string,
  updateId: string,
): Promise<void> {
  if (!hasDb() || !userId || !updateId) return;
  try {
    await db()`
      insert into user_update_reads (user_id, update_id, read_at)
      select ${userId}, id, now()
      from updates
      where id = ${updateId}
      on conflict (user_id, update_id) do update set read_at = user_update_reads.read_at
    `;
  } catch (error) {
    if (!isMissingUpdatesTableError(error)) throw error;
    console.warn('[accountUpdates] read tracking unavailable', error);
  }
}
