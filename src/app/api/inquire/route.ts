import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createInquiry } from '@/lib/inquiries';
import { recordEvent } from '@/lib/analytics';
import { getStorefront } from '@/lib/brief';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const Schema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  productId: z.string().trim().max(128).optional().nullable(),
  productTitle: z.string().trim().max(280).optional().nullable(),
  message: z.string().trim().min(1).max(2000),
  visitorName: z.string().trim().max(120).optional().nullable(),
  visitorEmail: z
    .string()
    .trim()
    .max(180)
    .email()
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  visitorPhone: z.string().trim().max(40).optional().nullable(),
  preferredChannel: z
    .enum(['whatsapp', 'email', 'phone', 'any'])
    .optional()
    .default('whatsapp'),
  marketingConsent: z.boolean().optional().default(false),
  sourceUrl: z.string().trim().url().max(2048).optional().nullable(),
});

/**
 * Public inquiry submission endpoint, called by `<InquireDialog>` on
 * the storefront. Side-effects:
 *
 *   1. Creates / updates a customer row tied to the storefront
 *      (`upsertCustomer`).
 *   2. Inserts the inquiry, foreign-keyed to that customer.
 *   3. Logs an `inquire_submit` analytics event so the Analytics tab
 *      reflects the conversion.
 *
 * Soft-rate-limited to 5 / minute / IP — high enough to forgive a
 * misclick, low enough to discourage drive-by spam. The full anti-abuse
 * picture (Turnstile, honeypot field) lands in a follow-up.
 */
export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  if (!rateLimit(`inquire:${ip}`, 5, 60_000).ok) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests. Try again in a minute.' },
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
    const issues = parsed.error.issues.map((i) => i.message).join('; ');
    return NextResponse.json(
      { ok: false, error: issues || 'Invalid form' },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const sf = await getStorefront(data.storefrontSlug);
  if (!sf) {
    return NextResponse.json({ ok: false, error: 'Unknown store' }, { status: 404 });
  }

  if (!data.visitorEmail && !data.visitorPhone) {
    return NextResponse.json(
      { ok: false, error: 'Add an email or phone so we can reach you.' },
      { status: 400 },
    );
  }

  try {
    const inq = await createInquiry(data.storefrontSlug, {
      productId: data.productId ?? null,
      productTitle: data.productTitle ?? null,
      message: data.message,
      visitorName: data.visitorName ?? null,
      visitorEmail: data.visitorEmail ?? null,
      visitorPhone: data.visitorPhone ?? null,
      preferredChannel: data.preferredChannel,
      sourceUrl: data.sourceUrl ?? null,
      userAgent: request.headers.get('user-agent') ?? null,
      marketingConsent: data.marketingConsent,
    });

    // Best-effort analytics ping. A failure here doesn't fail the inquiry.
    try {
      await recordEvent({
        storefrontSlug: data.storefrontSlug,
        kind: 'inquire_submit',
        productId: data.productId ?? null,
        meta: { inquiryId: inq.id, channel: data.preferredChannel },
      });
    } catch {
      /* swallow */
    }

    return NextResponse.json({ ok: true, inquiryId: inq.id });
  } catch (err) {
    console.error('[/api/inquire] insert failed', err);
    return NextResponse.json(
      { ok: false, error: 'We couldn’t deliver your inquiry. Try again.' },
      { status: 500 },
    );
  }
}
