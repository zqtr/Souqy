import { NextResponse } from 'next/server';
import { getStorefront } from '@/lib/brief';
import { getOrderById } from '@/lib/checkout-orders';
import {
  createSadadCheckoutParams,
  sadadCheckoutEndpoint,
  type SadadCheckoutParams,
} from '@/lib/sadad';
import { getStorefrontSadadCredentials } from '@/lib/storefrontSadad';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug') ?? '';
  const orderId = url.searchParams.get('orderId') ?? '';
  if (!slug || !orderId) {
    return NextResponse.json({ ok: false, error: 'missing_params' }, { status: 400 });
  }

  const [storefront, order, credentials] = await Promise.all([
    getStorefront(slug),
    getOrderById(orderId, slug),
    getStorefrontSadadCredentials(slug),
  ]);
  if (!storefront || !order || order.paymentMethod !== 'sadad' || !credentials) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const params: SadadCheckoutParams = createSadadCheckoutParams({
    slug,
    orderId: order.id,
    amountQar: order.totalQar,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    locale: storefront.locale,
    credentials,
    items: order.items.map((item) => ({
      title: item.titleSnapshot,
      amountQar: item.priceQarSnapshot,
      quantity: item.quantity,
    })),
  });

  return new NextResponse(renderSadadForm(params), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function renderSadadForm(params: SadadCheckoutParams): string {
  const inputs = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(
      ([key, value]) =>
        `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(String(value))}" />`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Redirecting to SADAD...</title>
  </head>
  <body>
    <form id="sadad-form" action="${sadadCheckoutEndpoint()}" method="post">
      ${inputs}
      <noscript><button type="submit">Continue to SADAD</button></noscript>
    </form>
    <script>document.getElementById('sadad-form').submit();</script>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
