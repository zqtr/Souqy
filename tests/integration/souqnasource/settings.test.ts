import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { getSettings, saveSettings, DEFAULT_SETTINGS } from '@/lib/apps/souqnasource/settings';

const slug = process.env.TEST_STOREFRONT_SLUG ?? `test-store-settings-${Date.now()}`;
const seedBrief = !process.env.TEST_STOREFRONT_SLUG;

beforeAll(async () => {
  if (seedBrief) {
    await db()`
      insert into briefs (slug, locale, founder_name, business_name, contact_email,
        ownership, experience, business_type, market_volume, payments, clerk_user_id)
      values (${slug}, 'en', 't', 't', 't@t', 't', 't', 't', 't', 't', 'user_test')
      on conflict (slug) do nothing
    `;
  }
});

afterAll(async () => {
  await db()`delete from app_state where storefront_slug = ${slug} and app_id = 'souqnasource'`;
  if (seedBrief) {
    await db()`delete from briefs where slug = ${slug}`;
  }
});

describe('settings', () => {
  it('returns defaults for fresh store', async () => {
    const s = await getSettings(`${slug}-fresh-${Date.now()}`);
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips a patch', async () => {
    const next = await saveSettings(slug, { driftThreshold: 0.15 });
    expect(next.driftThreshold).toBe(0.15);
    const reread = await getSettings(slug);
    expect(reread.driftThreshold).toBe(0.15);
  });
});
