import { NextResponse } from 'next/server';
import {
  getOrderById,
  markOnlinePaymentFailed,
  markOnlinePaymentSucceeded,
} from '@/lib/checkout-orders';
import {
  isSadadFailed,
  isSadadPaid,
  sadadOrderIdFromCallback,
  sadadTransactionStatus,
  verifySadadCallbackSignature,
  type SadadCallbackPayload,
} from '@/lib/sadad';
import { getStorefrontSadadCredentials } from '@/lib/storefrontSadad';
import { storefrontPageUrl } from '@/lib/storefrontUrl';
import { recordPlatformFeeForPaidOrder } from '@/lib/platformFees';
import { getStorefront } from '@/lib/brief';
import { sendSentPaymentStatusNotification } from '@/lib/sent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const form = await req.formData();
  const payload: SadadCallbackPayload = {};
  for (const [key, value] of form.entries()) {
    payload[key] = typeof value === 'string' ? value : value.name;
  }

  const orderId = sadadOrderIdFromCallback(payload);
  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'missing_order' }, { status: 400 });
  }

  const order = await getOrderById(orderId);
  if (!order || order.paymentMethod !== 'sadad') {
    return NextResponse.json({ ok: false, error: 'order_not_found' }, { status: 404 });
  }

  const credentials = await getStorefrontSadadCredentials(order.storefrontSlug);
  if (!credentials || !verifySadadCallbackSignature(payload, credentials.secretKey)) {
    const failedUrl = storefrontPageUrl(
      order.storefrontSlug,
      `/checkout/thank-you/${order.id}?sadad=unverified`,
    );
    return NextResponse.redirect(failedUrl, 303);
  }

  if (isSadadPaid(payload)) {
    const updated = await markOnlinePaymentSucceeded(order.id, order.storefrontSlug);
    if (updated) {
      await recordPlatformFeeForPaidOrder(updated);
      await notifyPaymentStatus(updated, 'paid');
    }
  } else if (isSadadFailed(payload)) {
    const updated = await markOnlinePaymentFailed(order.id, order.storefrontSlug);
    if (updated) await notifyPaymentStatus(updated, 'failed');
  }

  const status = isSadadPaid(payload)
    ? 'paid'
    : isSadadFailed(payload)
      ? 'failed'
      : sadadTransactionStatus(payload) === '1'
        ? 'pending'
        : 'pending';
  return NextResponse.redirect(
    storefrontPageUrl(order.storefrontSlug, `/checkout/thank-you/${order.id}?sadad=${status}`),
    303,
  );
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
      idempotencyKey: `sadad-${status}-${order.id}`,
    });
    if (sent.status === 'error') {
      console.warn('[checkout.sadad-callback] Sent notification failed', sent.reason);
    }
  } catch (err) {
    console.warn('[checkout.sadad-callback] Sent notification failed', err);
  }
}
