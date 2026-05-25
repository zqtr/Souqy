import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';
import { storefrontPageUrl } from './storefrontUrl';

export type SadadMerchantCredentials = {
  merchantId: string;
  website: string;
  secretKey: string;
};

export type SadadCredentialMode = 'live' | 'sandbox';

export type SadadCheckoutParams = {
  merchant_id: string;
  ORDER_ID: string;
  TXN_AMOUNT: string;
  WEBSITE: string;
  CALLBACK_URL: string;
  MOBILE_NO: string;
  EMAIL: string;
  txnDate: string;
  signature: string;
} & Record<string, string | undefined>;

export type SadadCheckoutItem = {
  title: string;
  amountQar: number;
  quantity: number;
};

export type SadadCallbackPayload = Record<string, string>;

const SADAD_CHECKOUT_ENDPOINT = 'https://sadadqa.com/webpurchase';
const SADAD_AUTH_ENDPOINTS: Record<SadadCredentialMode, string> = {
  live: 'https://api-s.sadad.qa/api/userbusinesses/login',
  sandbox: 'https://api-sandbox.sadad.qa/api/userbusinesses/login',
};
const SIGNED_REQUEST_KEYS = [
  'CALLBACK_URL',
  'EMAIL',
  'MOBILE_NO',
  'ORDER_ID',
  'TXN_AMOUNT',
  'WEBSITE',
  'merchant_id',
  'txnDate',
] as const;

export function sadadCheckoutEndpoint(): string {
  return SADAD_CHECKOUT_ENDPOINT;
}

export async function verifySadadCredentials(
  credentials: SadadMerchantCredentials,
): Promise<{ ok: true; mode: SadadCredentialMode } | { ok: false; reason: string }> {
  const sadadId = Number(credentials.merchantId);
  if (!Number.isInteger(sadadId) || sadadId <= 0) {
    return { ok: false, reason: 'SADAD ID must be a number.' };
  }

  for (const mode of ['live', 'sandbox'] as const) {
    try {
      const res = await fetch(SADAD_AUTH_ENDPOINTS[mode], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sadadId,
          secretKey: credentials.secretKey,
          domain: credentials.website,
        }),
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => null)) as { accessToken?: unknown } | null;
      if (res.ok && typeof json?.accessToken === 'string' && json.accessToken.length > 0) {
        return { ok: true, mode };
      }
    } catch {
      // Try the other mode before failing. Live/test keys are separate in SADAD.
    }
  }

  return {
    ok: false,
    reason: 'SADAD rejected those credentials. Check the SADAD ID, registered website/domain, and secret key.',
  };
}

export function sadadAmount(amountQar: number): string {
  return amountQar.toFixed(2);
}

export function sadadTxnDate(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function createSadadCheckoutParams({
  slug,
  orderId,
  amountQar,
  customerPhone,
  customerEmail,
  credentials,
}: {
  slug: string;
  orderId: string;
  amountQar: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  locale: 'en' | 'ar';
  credentials: SadadMerchantCredentials;
  items: SadadCheckoutItem[];
}): SadadCheckoutParams {
  const sadadOrderId = toSadadOrderId(orderId);
  const productDetails = sadadProductDetails(sadadOrderId, amountQar);
  const params = {
    merchant_id: credentials.merchantId,
    ORDER_ID: sadadOrderId,
    TXN_AMOUNT: sadadAmount(amountQar),
    WEBSITE: credentials.website,
    CALLBACK_URL: storefrontPageUrl(slug, `/api/checkout/sadad-callback`),
    MOBILE_NO: normalizePhone(customerPhone),
    EMAIL: customerEmail || `${sadadOrderId}@souqna.qa`,
    txnDate: sadadTxnDate(),
  };
  return {
    ...params,
    ...sadadProductDetailFields(productDetails),
    signature: signSadadValues(params, credentials.secretKey),
  };
}

export function signSadadValues(
  values: Partial<Record<(typeof SIGNED_REQUEST_KEYS)[number] | string, string>>,
  secretKey: string,
): string {
  const body = SIGNED_REQUEST_KEYS.map((key) => values[key] ?? '').join('');
  return createHash('sha256').update(`${secretKey}${body}`, 'utf8').digest('hex');
}

export function verifySadadCallbackSignature(
  payload: SadadCallbackPayload,
  secretKey: string,
): boolean {
  const received = payload.checksumhash;
  if (!received) return false;
  const signedPayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) => key !== 'checksumhash'),
  );
  const body = Object.keys(signedPayload)
    .sort()
    .map((key) => signedPayload[key] ?? '')
    .join('');
  const expected = createHash('sha256')
    .update(`${secretKey}${body}`, 'utf8')
    .digest('hex')
    .toLowerCase();
  return safeEqual(expected, received.toLowerCase());
}

export function isSadadPaid(payload: SadadCallbackPayload): boolean {
  const status = sadadTransactionStatus(payload);
  if (status) return status === '3';
  return normalizeSadadText(payload.STATUS) === 'txn_success';
}

export function isSadadFailed(payload: SadadCallbackPayload): boolean {
  const status = sadadTransactionStatus(payload);
  if (status) return status === '2';

  const rawStatus = [
    payload.STATUS,
    payload.RESPCODE,
    payload.RESPMSG,
    payload.status,
    payload.message,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!rawStatus) return false;
  if (rawStatus.includes('success') || rawStatus.includes('paid')) return false;
  return (
    rawStatus.includes('fail') ||
    rawStatus.includes('cancel') ||
    rawStatus.includes('declin') ||
    rawStatus.includes('reject') ||
    rawStatus.includes('error') ||
    rawStatus.includes('expired')
  );
}

export function sadadTransactionStatus(payload: SadadCallbackPayload): '1' | '2' | '3' | null {
  const raw =
    payload.transaction_status ??
    payload.transactionStatus ??
    payload.transactionstatus ??
    payload.TransactionStatus ??
    null;
  const normalized = raw?.trim();
  return normalized === '1' || normalized === '2' || normalized === '3'
    ? normalized
    : null;
}

function normalizeSadadText(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function sadadOrderIdFromCallback(payload: SadadCallbackPayload): string | null {
  const raw = payload.ORDERID || payload.ORDER_ID || payload.website_ref_no || null;
  if (!raw) return null;
  return fromSadadOrderId(raw);
}

export function toSadadOrderId(orderId: string): string {
  const base = orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
  const attempt = Date.now().toString(36);
  return `${base}${attempt}`.slice(0, 64);
}

export function fromSadadOrderId(orderId: string): string {
  const clean = orderId.replace(/[^a-fA-F0-9]/g, '');
  if (clean.length >= 32) {
    const orderUuid = clean.slice(0, 32);
    return [
      orderUuid.slice(0, 8),
      orderUuid.slice(8, 12),
      orderUuid.slice(12, 16),
      orderUuid.slice(16, 20),
      orderUuid.slice(20),
    ].join('-').toLowerCase();
  }
  return orderId;
}

type SadadProductDetail = {
  order_id: string;
  amount: string;
  quantity: string;
};

function sadadProductDetails(
  sadadOrderId: string,
  totalQar: number,
): SadadProductDetail[] {
  return [
    {
      order_id: sadadOrderId,
      amount: sadadAmount(totalQar),
      quantity: '1',
    },
  ];
}

function sadadProductDetailFields(productDetails: SadadProductDetail[]): Record<string, string> {
  return Object.fromEntries(
    productDetails.flatMap((item, index) => [
      [`productdetail[${index}][order_id]`, item.order_id],
      [`productdetail[${index}][amount]`, item.amount],
      [`productdetail[${index}][quantity]`, item.quantity],
    ]),
  );
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D+/g, '');
  if (digits.startsWith('974')) return digits;
  if (digits.length === 8) return `974${digits}`;
  return digits.slice(0, 15);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
