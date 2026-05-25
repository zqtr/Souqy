import 'server-only';

import { env } from './env';
import type { Order } from './checkout-orders';
import {
  SENT_TEMPLATE_IDS,
  type SentTemplateKind,
} from './sentTemplateCatalog';

export type { SentTemplateKind } from './sentTemplateCatalog';

export type SentChannel = 'sent' | 'sms' | 'whatsapp' | 'rcs';

type SentEnvSource = Partial<{
  SENT_TEMPLATE_MARKETING_ID: string;
  SENT_TEMPLATE_CUSTOMER_CARE_ID: string;
  SENT_TEMPLATE_FRAUD_ALERT_ID: string;
  SENT_TEMPLATE_DELIVERY_NOTIFICATION_ID: string;
  SENT_TEMPLATE_ACCOUNT_NOTIFICATION_ID: string;
}>;

export const SENT_TEMPLATE_ENV_KEYS = {
  marketing: 'SENT_TEMPLATE_MARKETING_ID',
  customer_care: 'SENT_TEMPLATE_CUSTOMER_CARE_ID',
  fraud_alert: 'SENT_TEMPLATE_FRAUD_ALERT_ID',
  delivery_notification: 'SENT_TEMPLATE_DELIVERY_NOTIFICATION_ID',
  account_notification: 'SENT_TEMPLATE_ACCOUNT_NOTIFICATION_ID',
} as const satisfies Record<SentTemplateKind, keyof SentEnvSource>;

export { SENT_TEMPLATE_IDS } from './sentTemplateCatalog';

export type SentSendResult =
  | {
      status: 'sent';
      messageId: string | null;
      recipientCount: number;
      raw: unknown;
    }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; reason: string; statusCode?: number };

export type SentMessageStatusResult =
  | {
      status: 'ok';
      messageStatus: string;
      channel: string | null;
      description: string | null;
      activities: Array<{
        status: string;
        description: string | null;
        timestamp: string | null;
      }>;
      raw: unknown;
    }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; reason: string; statusCode?: number };

export type SentTemplateParameters = Record<string, string | number | boolean | null>;

export type SentMessagePayload = {
  to: string[];
  template: {
    id: string;
    parameters?: SentTemplateParameters;
  };
  channel?: SentChannel[];
  sandbox?: boolean;
};

export function sentTemplateId(
  kind: SentTemplateKind,
  source: SentEnvSource = env,
): string {
  const key = SENT_TEMPLATE_ENV_KEYS[kind];
  return source[key]?.trim() || SENT_TEMPLATE_IDS[kind];
}

export function normalizeSentPhone(phone: string | null | undefined): string | null {
  const raw = phone?.trim();
  if (!raw) return null;
  if (raw.startsWith('+')) {
    const digits = raw.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00') && digits.length >= 10 && digits.length <= 17) {
    return `+${digits.slice(2)}`;
  }
  if (digits.length === 8) return `+974${digits}`;
  if (digits.startsWith('974') && digits.length === 11) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function buildSentMessagePayload(input: {
  to: Array<string | null | undefined>;
  templateId: string;
  parameters?: SentTemplateParameters;
  channel?: SentChannel[];
  sandbox?: boolean;
}): SentMessagePayload | null {
  const recipients = Array.from(
    new Set(input.to.map(normalizeSentPhone).filter((phone): phone is string => Boolean(phone))),
  );
  if (recipients.length === 0) return null;
  const cleanParams = cleanParameters(input.parameters ?? {});
  return {
    to: recipients,
    template: {
      id: input.templateId,
      ...(Object.keys(cleanParams).length > 0 ? { parameters: cleanParams } : {}),
    },
    ...(input.channel && input.channel.length > 0 ? { channel: input.channel } : {}),
    ...(typeof input.sandbox === 'boolean' ? { sandbox: input.sandbox } : {}),
  };
}

export async function sendSentTemplate(input: {
  kind: SentTemplateKind;
  to: Array<string | null | undefined>;
  parameters?: SentTemplateParameters;
  channel?: SentChannel[];
  sandbox?: boolean;
  idempotencyKey?: string;
}): Promise<SentSendResult> {
  if (!env.SENT_API_KEY) return { status: 'skipped', reason: 'missing_sent_api_key' };

  const templateId = sentTemplateId(input.kind);
  if (!templateId) return { status: 'skipped', reason: 'missing_sent_template_id' };

  const payload = buildSentMessagePayload({
    to: input.to,
    templateId,
    parameters: sentTemplateParameters(input.kind, input.parameters ?? {}),
    channel: input.channel,
    sandbox: input.sandbox,
  });
  if (!payload) return { status: 'skipped', reason: 'invalid_recipient_phone' };

  try {
    const res = await fetch('https://api.sent.dm/v3/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.SENT_API_KEY,
        ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as unknown;
    if (!res.ok) {
      return {
        status: 'error',
        statusCode: res.status,
        reason: sentErrorMessage(json, res.status),
      };
    }
    return {
      status: 'sent',
      messageId: extractMessageId(json),
      recipientCount: payload.to.length,
      raw: json,
    };
  } catch (err) {
    return {
      status: 'error',
      reason: err instanceof Error ? err.message : 'Sent request failed.',
    };
  }
}

export async function getSentMessageStatus(messageId: string): Promise<SentMessageStatusResult> {
  const id = messageId.trim();
  if (!id) return { status: 'skipped', reason: 'missing_message_id' };
  if (!env.SENT_API_KEY) return { status: 'skipped', reason: 'missing_sent_api_key' };

  try {
    const res = await fetch(`https://api.sent.dm/v3/messages/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: {
        'x-api-key': env.SENT_API_KEY,
      },
    });
    const json = (await res.json().catch(() => ({}))) as unknown;
    if (!res.ok) {
      return {
        status: 'error',
        statusCode: res.status,
        reason: sentErrorMessage(json, res.status),
      };
    }
    const data = asRecord(asRecord(json).data);
    const events = asArray(data.events).map(asRecord);
    const messageStatus = text(data.status) || 'UNKNOWN';
    const matchingStatusEvent =
      events.find((event) => text(event.status).toUpperCase() === messageStatus.toUpperCase()) ??
      events[events.length - 1] ??
      {};
    return {
      status: 'ok',
      messageStatus,
      channel: text(data.channel) || null,
      description:
        text(matchingStatusEvent.description) ||
        text(data.failure_reason) ||
        text(data.reason) ||
        text(data.error_message) ||
        text(data.error) ||
        text(data.description) ||
        null,
      activities: events.map((event) => ({
        status: text(event.status) || 'UNKNOWN',
        description: text(event.description) || null,
        timestamp: text(event.timestamp) || null,
      })),
      raw: json,
    };
  } catch (err) {
    return {
      status: 'error',
      reason: err instanceof Error ? err.message : 'Sent status request failed.',
    };
  }
}

export async function waitForSentMessageStatus(
  messageId: string,
  options: { attempts?: number; delayMs?: number } = {},
): Promise<SentMessageStatusResult> {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 500;
  let latest: SentMessageStatusResult = { status: 'skipped', reason: 'missing_message_id' };

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    latest = await getSentMessageStatus(messageId);
    if (latest.status !== 'ok') return latest;
    const status = latest.messageStatus.toUpperCase();
    if (!['QUEUED', 'PENDING', 'PROCESSING'].includes(status)) return latest;
    if (attempt < attempts - 1) await delay(delayMs);
  }

  return latest;
}

export async function sendSentAccountNotification(input: {
  phone: string | null | undefined;
  founderName?: string | null;
  storeName?: string | null;
  message: string;
  actionUrl?: string | null;
  idempotencyKey?: string;
}) {
  return sendSentTemplate({
    kind: 'account_notification',
    to: [input.phone],
    idempotencyKey: input.idempotencyKey,
    parameters: {
      founderName: input.founderName?.trim() || 'Founder',
      storeName: input.storeName?.trim() || 'Souqna',
      message: input.message,
      actionUrl: input.actionUrl ?? env.NEXT_PUBLIC_SITE_URL,
    },
  });
}

export async function sendSentDeliveryNotification(input: {
  phone: string | null | undefined;
  storeName: string;
  order: Order;
  message?: string;
  idempotencyKey?: string;
}) {
  return sendSentTemplate({
    kind: 'delivery_notification',
    to: [input.phone],
    idempotencyKey: input.idempotencyKey,
    parameters: deliveryParameters({
      order: input.order,
      storeName: input.storeName,
      message: input.message,
    }),
  });
}

export async function sendSentPaymentStatusNotification(input: {
  storeName: string;
  order: Order;
  status: 'paid' | 'failed';
  idempotencyKey?: string;
}) {
  const isFailed = input.status === 'failed';
  return sendSentTemplate({
    kind: isFailed ? 'fraud_alert' : 'delivery_notification',
    to: [input.order.customerPhone],
    idempotencyKey: input.idempotencyKey,
    parameters: isFailed
      ? {
          customerName: input.order.customerName,
          storeName: input.storeName,
          alertTitle: 'Payment could not be completed',
          orderNumber: shortOrderId(input.order.id),
          message:
            'Your payment was not completed. If this was unexpected, please contact the store before trying again.',
          actionUrl: buyerOrderUrl(input.order),
        }
      : deliveryParameters({
          order: input.order,
          storeName: input.storeName,
          message: 'Payment received. Your order is now confirmed.',
        }),
  });
}

export function deliveryParameters(input: {
  order: Order;
  storeName: string;
  message?: string;
}): SentTemplateParameters {
  return {
    customerName: input.order.customerName,
    storeName: input.storeName,
    orderNumber: shortOrderId(input.order.id),
    orderStatus: input.order.orderStatus,
    paymentStatus: input.order.paymentStatus,
    total: formatOrderTotal(input.order),
    message: input.message ?? orderStatusMessage(input.order.orderStatus),
    actionUrl: buyerOrderUrl(input.order),
  };
}

export function shortOrderId(id: string): string {
  return `#${(id.split('-')[0] || id.slice(0, 8)).toUpperCase()}`;
}

function formatOrderTotal(order: Order): string {
  return `${order.currency} ${order.totalQar.toLocaleString('en-QA')}`;
}

function buyerOrderUrl(order: Order): string {
  const root = env.BRIEF_ROOT_DOMAIN || 'souqna.qa';
  return `https://${order.storefrontSlug}.${root}/checkout/thank-you/${order.id}`;
}

function orderStatusMessage(status: Order['orderStatus']): string {
  switch (status) {
    case 'confirmed':
      return 'Your order is confirmed.';
    case 'preparing':
      return 'Your order is being prepared.';
    case 'shipped':
      return 'Your order is on the way.';
    case 'delivered':
      return 'Your order has been delivered.';
    case 'cancelled':
      return 'Your order was cancelled. Contact the store if you have questions.';
    case 'pending':
    default:
      return 'Your order was received.';
  }
}

function cleanParameters(parameters: SentTemplateParameters): SentTemplateParameters {
  const out: SentTemplateParameters = {};
  for (const [key, value] of Object.entries(parameters)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) continue;
      out[key] = trimmed;
      continue;
    }
    out[key] = String(value);
  }
  return out;
}

export function sentTemplateParameters(
  kind: SentTemplateKind,
  parameters: SentTemplateParameters,
): SentTemplateParameters {
  const out = cleanParameters(parameters);
  const customerName = firstParam(out, ['customerName', 'founderName'], 'Customer');
  const storeName = firstParam(out, ['storeName'], 'Souqna');
  const subject = firstParam(
    out,
    ['subject', 'alertTitle', 'orderNumber', 'orderStatus'],
    'Souqna update',
  );
  const message = firstParam(out, ['message', 'paymentStatus'], subject);
  const actionUrl = firstParam(out, ['actionUrl'], env.NEXT_PUBLIC_SITE_URL || 'https://souqna.qa');
  const orderNumber = firstParam(out, ['orderNumber', 'subject'], subject);
  const total = firstParam(out, ['total'], 'QAR 0');

  switch (kind) {
    case 'marketing':
      setMissingParam(out, 'var_1', customerName);
      setMissingParam(out, 'var_2', storeName);
      setMissingParam(out, 'var_3', message);
      break;
    case 'customer_care':
      setMissingParam(out, 'var_1', customerName);
      setMissingParam(out, 'var_2', storeName);
      setMissingParam(out, 'var_3', subject);
      setMissingParam(out, 'var_4', message);
      setMissingParam(out, 'var_5', actionUrl);
      break;
    case 'fraud_alert':
      setMissingParam(out, 'var_1', customerName);
      setMissingParam(out, 'var_2', storeName);
      setMissingParam(out, 'var_3', subject);
      setMissingParam(out, 'var_4', message);
      break;
    case 'delivery_notification':
      setMissingParam(out, 'var_1', customerName);
      setMissingParam(out, 'var_2', storeName);
      setMissingParam(out, 'var_3', orderNumber);
      setMissingParam(out, 'var_4', firstParam(out, ['orderStatus'], 'updated'));
      setMissingParam(out, 'var_5', total);
      setMissingParam(out, 'var_6', actionUrl);
      break;
    case 'account_notification':
      setMissingParam(out, 'var_1', customerName);
      setMissingParam(out, 'var_2', storeName);
      setMissingParam(out, 'var_3', subject);
      setMissingParam(out, 'var_4', message);
      setMissingParam(out, 'var_5', actionUrl);
      break;
  }

  return out;
}

function firstParam(
  parameters: SentTemplateParameters,
  keys: string[],
  fallback: string,
): string {
  for (const key of keys) {
    const value = text(parameters[key]);
    if (value) return value;
  }
  return fallback;
}

function setMissingParam(parameters: SentTemplateParameters, key: string, value: string): void {
  if (text(parameters[key])) return;
  if (value.trim()) parameters[key] = value.trim();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sentErrorMessage(json: unknown, status: number): string {
  const messages = collectErrorMessages(json);
  const message = messages.join(' - ');
  return `Sent request failed (${status}): ${message || 'The provider rejected the message.'}`.slice(
    0,
    1000,
  );
}

function collectErrorMessages(value: unknown, seen = new Set<unknown>()): string[] {
  if (!value || seen.has(value)) return [];
  if (typeof value === 'string' || typeof value === 'number') {
    const item = text(value);
    return item ? [item] : [];
  }
  if (typeof value !== 'object') return [];
  seen.add(value);
  if (Array.isArray(value)) {
    return unique(value.flatMap((item) => collectErrorMessages(item, seen)));
  }
  const record = value as Record<string, unknown>;
  const direct = ['field', 'path', 'code', 'message', 'error', 'detail', 'details', 'description']
    .flatMap((key) => collectErrorMessages(record[key], seen));
  const nested = ['data', 'meta', 'errors', 'issues', 'validation', 'cause']
    .flatMap((key) => collectErrorMessages(record[key], seen));
  return unique([...direct, ...nested]);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).slice(0, 8);
}

function extractMessageId(json: unknown): string | null {
  const root = asRecord(json);
  const data = asRecord(root.data);
  return (
    text(root.id) ||
    text(root.message_id) ||
    text(data.id) ||
    text(data.message_id) ||
    text(asRecord(asArray(data.recipients)[0]).message_id) ||
    text(asRecord(asArray(data.recipients)[0]).id) ||
    text(asRecord(asArray(data.messages)[0]).id) ||
    null
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}
