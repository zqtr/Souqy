import { z } from 'zod';
import {
  getOrCreateSouqyConversation,
  sendSouqyMessage,
} from '@/app/actions/souqyChat';
import {
  mobileError,
  mobileJson,
  mobileOptions,
  requireMobileStoreAccess,
  searchParam,
} from '@/lib/mobile/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(): Response {
  return mobileOptions();
}

const QuerySchema = z.object({
  store: z.string().trim().min(1),
});

const SendSchema = z.object({
  store: z.string().trim().min(1),
  conversationId: z.string().uuid().optional().nullable(),
  message: z.string().trim().min(1).max(1600),
  mode: z.enum(['ask', 'agent']).optional(),
});

export async function GET(req: Request): Promise<Response> {
  const parsed = QuerySchema.safeParse({ store: searchParam(req, 'store') });
  if (!parsed.success) {
    return mobileError(400, 'missing_store', 'Choose a storefront first.');
  }

  const gate = await requireMobileStoreAccess(parsed.data.store, 'builder.edit');
  if (!gate.ok) return gate.response;

  const result = await getOrCreateSouqyConversation({
    storefrontSlug: gate.access.storefront.slug,
  });

  if (result.status === 'error') {
    return mobileError(400, 'souqy_chat_error', result.message);
  }

  return mobileJson(result);
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = SendSchema.safeParse(body);
  if (!parsed.success) {
    return mobileError(400, 'invalid_message', 'Ask Souqy with a shorter message.');
  }

  const gate = await requireMobileStoreAccess(parsed.data.store, 'builder.edit');
  if (!gate.ok) return gate.response;

  const result = await sendSouqyMessage({
    storefrontSlug: gate.access.storefront.slug,
    conversationId: parsed.data.conversationId,
    message: parsed.data.message,
    mode: parsed.data.mode ?? 'ask',
  });

  if (result.status === 'error') {
    return mobileError(400, 'souqy_chat_error', result.message);
  }

  return mobileJson(result);
}
