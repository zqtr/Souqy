import { NextResponse } from 'next/server';
import {
  normalizeSkipCashStatusId,
  normalizeWebhookPayload,
  verifySkipCashWebhookSignature,
  verifySkipCashWebhookSignatureWithKey,
  type SkipCashWebhookPayload,
} from '@/lib/skipcash';
import {
  getOrderById,
  markOnlinePaymentFailed,
  markOnlinePaymentSucceeded,
} from '@/lib/checkout-orders';
import { getStorefrontSkipCashCredentials } from '@/lib/storefrontSkipcash';
import { recordPlatformFeeForPaidOrder } from '@/lib/platformFees';
import { getStorefront } from '@/lib/brief';
import { sendSentPaymentStatusNotification } from '@/lib/sent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let payload: SkipCashWebhookPayload;
  try {
    payload = (await req.json()) as SkipCashWebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const normalized = normalizeWebhookPayload(payload);
  const orderId = normalized.Custom1 || '';
  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'missing_order' }, { status: 400 });
  }

  const order = await getOrderById(orderId);
  if (!order) {
    return NextResponse.json({ ok: false, error: 'order_not_found' }, { status: 404 });
  }

  const signature = req.headers.get('authorization');
  if (order.collectionMode === 'platform_skipcash') {
    if (!verifySkipCashWebhookSignature(payload, signature)) {
      return NextResponse.json({ ok: false, error: 'bad_signature' }, { status: 401 });
    }
  } else {
    const credentials = await getStorefrontSkipCashCredentials(order.storefrontSlug);
    if (credentials?.webhookKey && !verifySkipCashWebhookSignatureWithKey(payload, signature, credentials.webhookKey)) {
      return NextResponse.json({ ok: false, error: 'bad_signature' }, { status: 401 });
    }
  }

  const statusId = normalizeSkipCashStatusId(normalized.StatusId);
  if (statusId === 2) {
    const updated = await markOnlinePaymentSucceeded(order.id, order.storefrontSlug);
    if (updated) {
      await recordPlatformFeeForPaidOrder(updated);
      await notifyPaymentStatus(updated, 'paid');
    }
  } else if (statusId === 3 || statusId === 4 || statusId === 5) {
    const updated = await markOnlinePaymentFailed(order.id, order.storefrontSlug);
    if (updated) await notifyPaymentStatus(updated, 'failed');
  }

  return NextResponse.json({ ok: true });
}

async function notifyPaymentStatus(
  order: NonNullable<Awaited<ReturnType<typeof getOrderById>>>,
  status: 'paid' | 'failed',
) {
  try {
    const storefront = await getStorefront(order.storefrontSlug);
    if (!storefront) return;
    const sent = await sendSentPaymentStatusNotification({
      storeName: storefront.businessName,
      order,
      status,
      idempotencyKey: `skipcash-${status}-${order.id}`,
    });
    if (sent.status === 'error') {
      console.warn('[checkout.skipcash-webhook] Sent notification failed', sent.reason);
    }
  } catch (err) {
    console.warn('[checkout.skipcash-webhook] Sent notification failed', err);
  }
}
