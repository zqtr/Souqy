import { NextResponse } from 'next/server';
import { startSouqyStudioProject } from '@/app/actions/souqyStudio';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const input = await request.json().catch(() => null);
    if (!input) {
      return NextResponse.json({ status: 'error', message: 'Invalid Souqy Studio project.' }, { status: 400 });
    }
    const result = await startSouqyStudioProject(input);
    return NextResponse.json(result, { status: result.status === 'success' ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      { status: 'error', message: err instanceof Error ? err.message : 'Could not start Souqy Studio.' },
      { status: 500 },
    );
  }
}
