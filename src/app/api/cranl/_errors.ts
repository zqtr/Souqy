import { NextResponse } from 'next/server';
import { CranlConfigurationError, CranlRequestError } from '@/lib/cranl/client';

export function cranlErrorResponse(error: unknown): NextResponse {
  if (error instanceof CranlConfigurationError) {
    return NextResponse.json({ ok: false, error: 'cranl_not_configured' }, { status: 503 });
  }

  if (error instanceof CranlRequestError) {
    return NextResponse.json(
      {
        ok: false,
        error: 'cranl_request_failed',
        status: error.status,
      },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : 'cranl_unexpected_error',
    },
    { status: 500 },
  );
}
