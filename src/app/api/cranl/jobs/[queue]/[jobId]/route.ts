import { NextResponse } from 'next/server';
import { CranlQueueSchema, getCranlJobStatus } from '@/lib/cranl/client';
import { requireCranlUserAccess } from '../../../_access';
import { cranlErrorResponse } from '../../../_errors';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: { queue: string; jobId: string } },
) {
  const access = await requireCranlUserAccess();
  if (!access.ok) return access.response;

  const queue = CranlQueueSchema.safeParse(params.queue);
  if (!queue.success || !params.jobId) {
    return NextResponse.json({ ok: false, error: 'invalid_cranl_job' }, { status: 400 });
  }

  try {
    const job = await getCranlJobStatus(queue.data, params.jobId);
    if (job.metadata?.clerkUserId !== access.userId) {
      return NextResponse.json({ ok: false, error: 'job_not_found' }, { status: 404 });
    }

    const publicJob = { ...job };
    delete publicJob.metadata;
    return NextResponse.json({ ok: true, job: publicJob });
  } catch (error) {
    return cranlErrorResponse(error);
  }
}
