import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { env } from '@/lib/env';
import {
  readPulseActivity,
  readPulseSummary,
  type PulseActivity,
} from '@/lib/pulseActivity';

/**
 * Souqna Pulse · read API.
 *
 * The Mac client (Tauri) polls this endpoint every few seconds.
 * Auth is a single bearer token (PULSE_ADMIN_TOKEN) stored in macOS
 * Keychain on the client side and in Vercel env on the server.
 *
 * Query params:
 *   ?since=<ISO timestamp>   tail mode — only events after `since`
 *   ?limit=<n>               cap (default 100, max 500)
 *   ?clerkUserId=<id>        owner/founder Clerk user filter
 *   ?actorClerkUserId=<id>   actor/team-member Clerk user filter
 *   ?storefront=<slug>       storefront filter
 *   ?resourceType=<type>     product/storefront/order/billing/user/page/analytics
 *   ?kind=<prefix-or-exact>  exact kind or namespace prefix
 *   ?kinds=a,b,c             exact kind allow-list
 *   ?summary=1               also include Pulse summary metrics
 *
 * The response is intentionally compact JSON; the client decides how
 * to render. We never expose raw IPs or UAs here — those stay in the
 * DB for forensic queries the founder can run manually if needed.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const QuerySchema = z.object({
  since: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'invalid since timestamp')
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).catch(100),
  clerkUserId: z.string().trim().min(1).optional(),
  actorClerkUserId: z.string().trim().min(1).optional(),
  storefront: z.string().trim().min(1).optional(),
  resourceType: z.string().trim().min(1).optional(),
  kind: z.string().trim().min(1).optional(),
  kinds: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
            .slice(0, 50)
        : undefined,
    ),
  summary: z.enum(['0', '1']).optional(),
});

function authorized(req: NextRequest): boolean {
  const token = env.PULSE_ADMIN_TOKEN;
  if (!token) return false;
  const header = req.headers.get('authorization') ?? '';
  const presented = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : '';
  if (!presented) return false;
  // Constant-time compare; pad to equal length to keep timingSafeEqual happy.
  const a = Buffer.from(presented);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    since: url.searchParams.get('since') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    clerkUserId: url.searchParams.get('clerkUserId') ?? undefined,
    actorClerkUserId: url.searchParams.get('actorClerkUserId') ?? undefined,
    storefront: url.searchParams.get('storefront') ?? undefined,
    resourceType: url.searchParams.get('resourceType') ?? undefined,
    kind: url.searchParams.get('kind') ?? undefined,
    kinds: url.searchParams.get('kinds') ?? undefined,
    summary: url.searchParams.get('summary') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_query', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const filters = parsed.data;

  try {
    const activities = await readPulseActivity({
      since: filters.since,
      limit: filters.limit,
      clerkUserId: filters.clerkUserId,
      actorClerkUserId: filters.actorClerkUserId,
      storefront: filters.storefront,
      resourceType: filters.resourceType,
      kind: filters.kind,
      kinds: filters.kinds,
    });
    const summary =
      filters.summary === '1'
        ? await readPulseSummary({
            since: filters.since,
            clerkUserId: filters.clerkUserId,
            actorClerkUserId: filters.actorClerkUserId,
            storefront: filters.storefront,
            resourceType: filters.resourceType,
            kind: filters.kind,
            kinds: filters.kinds,
          })
        : undefined;
    return NextResponse.json(
      {
        ok: true,
        activities,
        events: activities.map(toLegacyEvent),
        ...(summary ? { summary } : {}),
        at: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error('[pulse api] read failed', err);
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }
}

function toLegacyEvent(activity: PulseActivity) {
  return {
    id: activity.id,
    occurredAt: activity.occurredAt,
    kind: activity.kind,
    funnel:
      typeof activity.metadata.funnel === 'string' ? activity.metadata.funnel : activity.source,
    step: typeof activity.metadata.step === 'number' ? activity.metadata.step : null,
    userId: activity.ownerClerkUserId ?? activity.actorClerkUserId,
    storefront: activity.storefrontSlug,
    props: {
      ...activity.metadata,
      source: activity.source,
      resourceType: activity.resourceType,
      resourceId: activity.resourceId,
      title: activity.title,
      summary: activity.summary,
    },
  };
}
