import { NextResponse } from 'next/server';
import { confirmSouqyStudioAsset } from '@/app/actions/souqyStudio';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const input = await request.json().catch(() => null);
    if (!input) {
      return NextResponse.json({ status: 'error', message: 'Invalid confirmation request.' }, { status: 400 });
    }
    const result = await confirmSouqyStudioAsset(input);
    return NextResponse.json(result, { status: result.status === 'success' ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      { status: 'error', message: err instanceof Error ? err.message : 'Could not confirm Souqy Studio asset.' },
      { status: 500 },
    );
  }
}
