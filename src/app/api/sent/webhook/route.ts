import { NextResponse, type NextRequest } from 'next/server';
import {
  handleSentWebhook,
  SentWebhookAuthError,
  SentWebhookPayloadError,
} from '@/lib/sentWebhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ ok: true, service: 'sent-webhook' });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  try {
    const result = await handleSentWebhook(rawBody, req.headers);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof SentWebhookAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    if (err instanceof SyntaxError || err instanceof SentWebhookPayloadError) {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    }
    console.error('[sent.webhook] handler failed', err);
    return NextResponse.json({ ok: false, error: 'handler_failed' }, { status: 500 });
  }
}
