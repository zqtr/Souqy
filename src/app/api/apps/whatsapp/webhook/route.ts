import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { handleWhatsAppWebhook } from '@/lib/apps/whatsapp';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');

  if (
    mode === 'subscribe' &&
    challenge &&
    env.WHATSAPP_WEBHOOK_VERIFY_TOKEN &&
    token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({ ok: false, error: 'verification_failed' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const result = await handleWhatsAppWebhook(body);
  return NextResponse.json({ ok: true, ...result });
}
