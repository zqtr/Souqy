import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStorefront } from '@/lib/brief';
import { getPublicProducts } from '@/lib/products';
import { rateLimit } from '@/lib/rate-limit';
import {
  answerCustomerWithSouqy,
  blockedCustomerReply,
  isBlockedCustomerRequest,
} from '@/lib/souqy/customerAssistant';

export const runtime = 'nodejs';

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(1200),
});

const Schema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  messages: z.array(MessageSchema).min(1).max(12),
});

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  if (!rateLimit(`souqy-customer-chat:${ip}`, 20, 60_000).ok) {
    return NextResponse.json(
      { ok: false, error: 'Too many messages. Try again in a minute.' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid chat message.' }, { status: 400 });
  }

  const storefront = await getStorefront(parsed.data.storefrontSlug);
  if (!storefront || !storefront.isPublished) {
    return NextResponse.json({ ok: false, error: 'Unknown store' }, { status: 404 });
  }
  const latest = parsed.data.messages.at(-1);
  if (latest && isBlockedCustomerRequest(latest.content)) {
    return NextResponse.json({ ok: true, message: blockedCustomerReply(storefront.locale) });
  }

  const products = await getPublicProducts(storefront.slug);
  const message = await answerCustomerWithSouqy({
    storefront,
    products,
    messages: parsed.data.messages,
  });

  return NextResponse.json({ ok: true, message });
}
