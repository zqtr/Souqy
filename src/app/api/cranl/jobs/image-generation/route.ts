import { NextResponse } from 'next/server';
import {
  createCranlImageGenerationJob,
  CranlImageGenerationRequestSchema,
} from '@/lib/cranl/client';
import { requireCranlUserAccess } from '../../_access';
import { cranlErrorResponse } from '../../_errors';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const access = await requireCranlUserAccess();
  if (!access.ok) return access.response;

  const body = await request.json().catch(() => null);
  const parsed = CranlImageGenerationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_image_generation_job' }, { status: 400 });
  }

  try {
    const job = await createCranlImageGenerationJob({
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
