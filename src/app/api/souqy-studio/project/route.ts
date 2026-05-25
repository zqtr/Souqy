import { NextResponse } from 'next/server';
import { loadSouqyStudioProject } from '@/app/actions/souqyStudio';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const input = await request.json().catch(() => ({}));
    const result = await loadSouqyStudioProject(input ?? {});
    return NextResponse.json(result, { status: result.status === 'success' ? 200 : 404 });
  } catch (err) {
    return NextResponse.json(
      { status: 'error', message: err instanceof Error ? err.message : 'Could not load Souqy Studio project.' },
      { status: 500 },
    );
  }
}
