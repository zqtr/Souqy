import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadSubject() {
  vi.resetModules();
  return import('@/lib/vercelDomains');
}

function resetVercelEnv() {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.VERCEL_API_TOKEN;
  delete process.env.VERCEL_TOKEN;
  delete process.env.VERCEL_PROJECT_ID;
  delete process.env.VERCEL_TEAM_ID;
  process.env.BRIEF_ROOT_DOMAIN = 'souqna.qa';
  process.env.BRIEF_FALLBACK_ROOT_DOMAIN = 'souqna.co';
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('ensureStorefrontDomain', () => {
  beforeEach(() => {
    resetVercelEnv();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('skips safely when no Vercel token is configured', async () => {
    process.env.VERCEL_PROJECT_ID = 'prj_test';
    const { ensureStorefrontDomain } = await loadSubject();

    const result = await ensureStorefrontDomain('noura');

    expect(result).toEqual({
      ok: true,
      status: 'skipped',
      primaryUrl: 'https://noura.souqna.qa',
      fallbackUrl: 'https://noura.souqna.co',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('treats a blank token as an unconfigured production error', async () => {
    process.env.VERCEL_API_TOKEN = '';
    process.env.VERCEL_PROJECT_ID = 'prj_test';
    const { ensureStorefrontDomain } = await loadSubject();

    const result = await ensureStorefrontDomain('noura');

    expect(result).toMatchObject({
      ok: false,
      code: 'unconfigured',
      primaryUrl: 'https://noura.souqna.qa',
      fallbackUrl: 'https://noura.souqna.co',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('classifies project preflight 404 as project_not_found', async () => {
    process.env.VERCEL_API_TOKEN = 'token';
    process.env.VERCEL_PROJECT_ID = 'prj_missing';
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(404, { error: { code: 'not_found' } }),
    );
    const { ensureStorefrontDomain } = await loadSubject();

    const result = await ensureStorefrontDomain('noura');

    expect(result).toMatchObject({
      ok: false,
      code: 'project_not_found',
      primaryUrl: 'https://noura.souqna.qa',
      fallbackUrl: 'https://noura.souqna.co',
    });
  });

  it('returns exists for already-attached storefront domains', async () => {
    process.env.VERCEL_API_TOKEN = 'token';
    process.env.VERCEL_PROJECT_ID = 'prj_test';
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(200, { id: 'prj_test' }))
      .mockResolvedValueOnce(
        jsonResponse(409, { error: { code: 'domain_already_exists' } }),
      );
    const { ensureStorefrontDomain } = await loadSubject();

    const result = await ensureStorefrontDomain('noura');

    expect(result).toEqual({
      ok: true,
      status: 'exists',
      primaryUrl: 'https://noura.souqna.qa',
      fallbackUrl: 'https://noura.souqna.co',
    });
  });

  it('does not mark domain_taken storefront domains as live', async () => {
    process.env.VERCEL_API_TOKEN = 'token';
    process.env.VERCEL_PROJECT_ID = 'prj_test';
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(200, { id: 'prj_test' }))
      .mockResolvedValueOnce(jsonResponse(409, { error: { code: 'domain_taken' } }));
    const { ensureStorefrontDomain } = await loadSubject();

    const result = await ensureStorefrontDomain('noura');

    expect(result).toMatchObject({
      ok: false,
      code: 'taken',
      primaryUrl: 'https://noura.souqna.qa',
      fallbackUrl: 'https://noura.souqna.co',
    });
  });
});
