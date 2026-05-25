import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { assertStorefrontOwner } from '@/lib/products';
import { getInstalledApp } from '@/lib/apps/installed';
import { decryptToken } from '@/lib/apps/crypto';
import { rateLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

/**
 * Server-side proxy to Giphy's search endpoint. Required because the
 * founder's API key is encrypted at rest in `installed_apps`. The
 * client never touches the key directly.
 *
 * Auth: requires the signed-in Clerk user to own the storefront.
 * Rate-limit: 30 req/min per Clerk user.
 */
const Schema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  q: z.string().trim().min(1).max(120),
  limit: z.number().int().positive().max(50).optional().default(24),
});

type GiphyResponse = {
  data?: Array<{
    id: string;
    title: string;
    images?: {
      fixed_height?: { url?: string; width?: string; height?: string };
      original?: { url?: string; width?: string; height?: string };
    };
  }>;
};

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 });
  }
  const url = new URL(request.url);
  const parsed = Schema.safeParse({
    storefrontSlug: url.searchParams.get('store') ?? '',
    q: url.searchParams.get('q') ?? '',
    limit: url.searchParams.get('limit')
      ? Number(url.searchParams.get('limit'))
      : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid request' }, { status: 400 });
  }

  const owner = await assertStorefrontOwner(parsed.data.storefrontSlug, userId);
  if (!owner) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

  const rl = rateLimit(`giphy:${userId}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: 'rate limited' }, { status: 429 });
  }

  const installed = await getInstalledApp(parsed.data.storefrontSlug, 'giphy');
  if (!installed || !installed.enabled) {
    return NextResponse.json(
      { ok: false, error: 'Giphy is not installed on this storefront' },
      { status: 404 },
    );
  }

  let apiKey = decryptToken(installed.oauthAccessTokenCt);
  if (!apiKey) apiKey = env.GIPHY_API_KEY ?? '';
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Giphy API key is unreadable. Reinstall the app from /account/apps/giphy.',
      },
      { status: 503 },
    );
  }

  try {
    const upstream = await fetch(
      `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(parsed.data.q)}&limit=${parsed.data.limit}&rating=pg-13&bundle=messaging_non_clips`,
      { cache: 'no-store' },
    );
    if (!upstream.ok) {
      return NextResponse.json(
        { ok: false, error: `Giphy returned ${upstream.status}` },
        { status: 502 },
      );
    }
    const json = (await upstream.json()) as GiphyResponse;
    const results = (json.data ?? [])
      .map((g) => {
        const fixed = g.images?.fixed_height;
        const original = g.images?.original;
        if (!fixed?.url || !original?.url) return null;
        return {
          id: g.id,
          title: g.title || 'Giphy clip',
          previewUrl: fixed.url,
          previewWidth: Number(fixed.width) || 200,
          previewHeight: Number(fixed.height) || 200,
          fullUrl: original.url,
        };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error('[/api/apps/giphy/search] failed', err);
    return NextResponse.json(
      { ok: false, error: 'Giphy request failed' },
      { status: 502 },
    );
  }
}
