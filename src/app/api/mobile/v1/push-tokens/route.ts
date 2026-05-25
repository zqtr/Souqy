import { z } from 'zod';
import {
  deleteMobilePushToken,
  upsertMobilePushToken,
} from '@/lib/mobile/push';
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

const TokenSchema = z.object({
  deviceId: z.string().trim().min(3).max(160),
  expoPushToken: z.string().trim().min(10).max(300),
  platform: z.string().trim().min(2).max(20).default('ios'),
  appVersion: z.string().trim().max(40).optional().nullable(),
});

const DeleteSchema = z.object({
  deviceId: z.string().trim().min(3).max(160).optional(),
  expoPushToken: z.string().trim().min(10).max(300).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const gate = await requireMobileUser();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  const parsed = TokenSchema.safeParse(body);
  if (!parsed.success) {
    return mobileError(400, 'invalid_push_token', 'Invalid push token.');
  }
  await upsertMobilePushToken({
    clerkUserId: gate.user.userId,
    ...parsed.data,
  });
  return mobileJson({ ok: true });
}

export async function DELETE(req: Request): Promise<Response> {
  const gate = await requireMobileUser();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success || (!parsed.data.deviceId && !parsed.data.expoPushToken)) {
    return mobileError(400, 'invalid_push_token_delete', 'Provide a device or push token.');
  }
  await deleteMobilePushToken({
    clerkUserId: gate.user.userId,
    deviceId: parsed.data.deviceId,
    expoPushToken: parsed.data.expoPushToken,
  });
  return mobileJson({ ok: true });
}
