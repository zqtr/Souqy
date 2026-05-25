import { NextResponse } from 'next/server';
import { pushWeeklyStoreReminders } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!expected || !timingSafeEq(got, expected)) {
    return new NextResponse('unauthorized', { status: 401 });
  }

  const summary = await pushWeeklyStoreReminders();
  return NextResponse.json({ ok: true, summary });
}

export const GET = POST;
