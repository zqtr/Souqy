import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export function GET(_req?: Request): Response {
  void _req;
  return NextResponse.json({ ok: false, error: 'souqnasource_removed' }, { status: 410 });
}

export const POST = GET;
