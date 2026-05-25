import { z } from 'zod';
import {
  getUnreadCount,
  listNotifications,
  markAllRead,
  markRead,
} from '@/lib/notifications';
import {
  mobileError,
  mobileJson,
  mobileOptions,
  requireMobileUser,
} from '@/lib/mobile/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(): Response {
  return mobileOptions();
}

const PatchSchema = z.object({
  ids: z.array(z.string().uuid()).max(200).optional(),
  all: z.boolean().optional(),
});

export async function GET(req: Request): Promise<Response> {
  const gate = await requireMobileUser();
  if (!gate.ok) return gate.response;

  const before = new URL(req.url).searchParams.get('before') ?? undefined;
  const [rows, unreadCount] = await Promise.all([
    listNotifications(gate.user.userId, { limit: 30, before }),
    getUnreadCount(gate.user.userId),
  ]);

  return mobileJson({ rows, unreadCount });
}

export async function PATCH(req: Request): Promise<Response> {
  const gate = await requireMobileUser();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return mobileError(400, 'invalid_notifications_update', 'Invalid notification update.');
  }

  if (parsed.data.all) {
    await markAllRead(gate.user.userId);
  } else if (parsed.data.ids?.length) {
    await markRead({ userId: gate.user.userId, ids: parsed.data.ids });
  }
  return mobileJson({ unreadCount: await getUnreadCount(gate.user.userId) });
}
