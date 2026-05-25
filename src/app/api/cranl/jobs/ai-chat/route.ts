import { NextResponse } from 'next/server';
import { createCranlAiChatJob, CranlAiChatRequestSchema } from '@/lib/cranl/client';
import { requireCranlUserAccess } from '../../_access';
import { cranlErrorResponse } from '../../_errors';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const access = await requireCranlUserAccess();
  if (!access.ok) return access.response;

  const body = await request.json().catch(() => null);
  const parsed = CranlAiChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_ai_chat_job' }, { status: 400 });
  }

  try {
    const job = await createCranlAiChatJob({
      ...parsed.data,
      metadata: {
        ...parsed.data.metadata,
        source: 'souqna-web',
        clerkUserId: access.userId,
      },
    });
    return NextResponse.json({ ok: true, job }, { status: 202 });
  } catch (error) {
    return cranlErrorResponse(error);
  }
}
