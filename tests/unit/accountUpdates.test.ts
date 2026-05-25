import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlMock = vi.fn();

vi.mock('next/cache', () => ({
  unstable_noStore: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  hasDb: () => true,
  db: () => sqlMock,
}));

import {
  accountUpdateIdFromSeed,
  accountUpdateAudienceMatchesPlan,
  listUnreadAccountUpdates,
  markAccountUpdateReadForUser,
  productionDeploymentAccountUpdateFromEnv,
  syncProductionDeploymentAccountUpdate,
} from '@/lib/accountUpdates';

const baseRow = {
  id: '28e3de2c-7d8e-46d5-9fc2-320e1e116f1f',
  title: 'Plans',
  body: 'New plan catalog',
  type: 'feature' as const,
  version: 'plans',
  priority: 50,
  published_at: '2026-05-22T00:00:00.000Z',
  expires_at: null,
  summary: 'Plan update',
  badge: 'Plans',
  cta_label: 'View plan',
  cta_href: '/account/settings/plan',
  details_href: '/account/settings/plan',
  image_url: null,
  video_url: null,
  preview_payload: {},
  banner_payload: {},
  is_sticky: false,
  audience: {},
};

describe('account updates', () => {
  beforeEach(() => {
    sqlMock.mockReset();
  });

  it('matches audience rules by current plan', () => {
    expect(accountUpdateAudienceMatchesPlan({}, 'free')).toBe(true);
    expect(accountUpdateAudienceMatchesPlan({ plans: ['free'] }, 'free')).toBe(true);
    expect(accountUpdateAudienceMatchesPlan({ plans: ['free'] }, 'starter')).toBe(false);
    expect(accountUpdateAudienceMatchesPlan({ excludePlans: ['free'] }, 'free')).toBe(false);
    expect(accountUpdateAudienceMatchesPlan({ minPlan: 'pro' }, 'starter')).toBe(false);
    expect(accountUpdateAudienceMatchesPlan({ minPlan: 'pro' }, 'atelier')).toBe(true);
  });

  it('fetches active unread updates with the required SQL filters and audience filtering', async () => {
    sqlMock.mockResolvedValueOnce([
      baseRow,
      {
        ...baseRow,
        id: '09a8df5c-4e24-438a-b444-47904098cb60',
        title: 'Free upsell',
        priority: 20,
        audience: { plans: ['free'] },
      },
      {
        ...baseRow,
        id: '322e662a-e61d-498b-adf7-cd042490eb81',
        title: 'Paid only',
        priority: 10,
        audience: { minPlan: 'pro' },
      },
    ]);

    const updates = await listUnreadAccountUpdates('user_123', 'free', 10);
    expect(updates.map((update) => update.title)).toEqual(['Plans', 'Free upsell']);

    const sql = String(sqlMock.mock.calls[0]?.[0]?.join(' '));
    expect(sql).toContain('u.is_active = true');
    expect(sql).toContain('u.published_at <= now()');
    expect(sql).toContain('u.expires_at is null or u.expires_at > now()');
    expect(sql).toContain('not exists');
    expect(sql).toContain('order by u.priority desc, u.published_at desc');
  });

  it('marks reads with an idempotent user/update insert', async () => {
    sqlMock.mockResolvedValueOnce([]);
    await markAccountUpdateReadForUser('user_123', baseRow.id);

    const sql = String(sqlMock.mock.calls[0]?.[0]?.join(' '));
    expect(sql).toContain('insert into user_update_reads');
    expect(sql).toContain('select');
    expect(sql).toContain('from updates');
    expect(sql).toContain('on conflict (user_id, update_id)');
  });

  it('builds automatic changelog updates without rollout metadata', () => {
    expect(
      productionDeploymentAccountUpdateFromEnv({
        VERCEL_ENV: 'preview',
        VERCEL_GIT_COMMIT_SHA: 'abc123',
      }),
    ).toBeNull();

    const update = productionDeploymentAccountUpdateFromEnv({
      VERCEL_ENV: 'production',
      VERCEL_DEPLOYMENT_ID: 'dpl_123',
      VERCEL_GIT_COMMIT_SHA: 'abcdef1234567890',
      VERCEL_GIT_COMMIT_MESSAGE: 'Add checkout polish',
      VERCEL_GIT_COMMIT_REF: 'main',
      VERCEL_GIT_COMMIT_AUTHOR_NAME: 'Souqna',
      VERCEL_URL: 'souqna.vercel.app',
    });
    const updateId = accountUpdateIdFromSeed('push:dpl_123');

    expect(update).toMatchObject({
      id: updateId,
      title: 'Add checkout polish',
      version: `update:${updateId.slice(0, 8)}`,
      badge: 'Update',
      summary: 'Add checkout polish',
      previewPayload: {
        kind: 'souqna-update',
        route: '/account',
      },
    });
    expect(JSON.stringify(update)).not.toMatch(/dpl_123|deployment|production|vercel/i);
  });

  it('replaces rollout wording in automatic changelog copy', () => {
    const update = productionDeploymentAccountUpdateFromEnv({
      VERCEL_ENV: 'production',
      VERCEL_DEPLOYMENT_ID: 'dpl_789',
      VERCEL_GIT_COMMIT_MESSAGE: 'Deploy production build',
    });

    expect(update).toMatchObject({
      title: 'Souqna update',
      body: 'Souqna improvements are ready to explore.',
      summary: 'Souqna improvements are ready to explore.',
      badge: 'Update',
    });
    expect(JSON.stringify(update)).not.toMatch(/dpl_789|deployment|production|vercel/i);
  });

  it('upserts the automatic changelog row idempotently', async () => {
    sqlMock.mockResolvedValueOnce([]);

    await syncProductionDeploymentAccountUpdate({
      VERCEL_ENV: 'production',
      VERCEL_DEPLOYMENT_ID: 'dpl_456',
      VERCEL_GIT_COMMIT_SHA: '1234567890abcdef',
      VERCEL_GIT_COMMIT_MESSAGE: 'Ship account changelog',
    });

    const sql = String(sqlMock.mock.calls[0]?.[0]?.join(' '));
    expect(sql).toContain('insert into updates');
    expect(sql).toContain('on conflict (id) do update');
    expect(sql).toContain('preview_payload');
    expect(sql).toContain('banner_payload');
  });
});
