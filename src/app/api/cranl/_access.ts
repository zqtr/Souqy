import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { gateAtelierPro } from '@/lib/billing';

export async function requireCranlUserAccess(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse<{ ok: false; error: string }> }
> {
  const { userId } = await auth();
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 }),
    };
  }

  const gate = await gateAtelierPro(userId);
  if (!gate.ok) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: 'souqy_plan_required' }, { status: 403 }),
    };
  }

  return { ok: true, userId };
}
