import crypto from 'node:crypto';
import { db, hasDb } from './db';
import { env } from './env';

type HeadersLike = Headers | Record<string, string | string[] | undefined | null>;

export type SentWebhookEnvelope = {
  field: string | null;
  subType: string | null;
  timestamp: string | null;
  payload: Record<string, unknown>;
};

export type SentWebhookSignatureResult =
  | { ok: true; configured: true }
  | { ok: true; configured: false; reason: 'secret_not_configured' }
  | { ok: false; configured: true; reason: string };

export type SentMessageWebhookUpdate = {
  field: string | null;
  subType: string | null;
  timestamp: string | null;
  messageId: string | null;
  messageStatus: string | null;
  channel: string | null;
  description: string | null;
  payload: Record<string, unknown>;
};

export type SentWebhookHandleResult = {
  received: true;
  verified: boolean;
  field: string | null;
  subType: string | null;
  messageId: string | null;
  messageStatus: string | null;
  updated: number;
  skippedReason?: string;
};

export function parseSentWebhookEnvelope(rawBody: string): SentWebhookEnvelope {
  const parsed = JSON.parse(rawBody) as unknown;
  const root = asRecord(parsed);
  if (!root) {
    throw new SentWebhookPayloadError('Webhook body must be a JSON object.');
  }

  return {
    field: stringValue(root.field),
    subType: stringValue(root.sub_type) ?? stringValue(root.subType),
    timestamp: stringValue(root.timestamp),
    payload: asRecord(root.payload) ?? {},
  };
}

export function extractSentMessageUpdate(
  envelope: SentWebhookEnvelope,
): SentMessageWebhookUpdate {
  const payload = envelope.payload;
  const messageStatus =
    stringValue(payload.message_status) ??
    stringValue(payload.messageStatus) ??
    stringValue(payload.status);

  return {
    field: envelope.field,
    subType: envelope.subType,
    timestamp: envelope.timestamp,
    messageId:
      stringValue(payload.message_id) ??
      stringValue(payload.messageId) ??
      stringValue(payload.id),
    messageStatus: messageStatus ? messageStatus.toUpperCase() : null,
    channel: stringValue(payload.channel) ?? stringValue(payload.channel_attempted),
    description:
      stringValue(payload.description) ??
      stringValue(payload.reason) ??
      stringValue(payload.error_message) ??
      stringValue(payload.error) ??
      stringValue(payload.provider_error),
    payload,
  };
}

export function verifySentWebhookSignature(
  rawBody: string,
  headers: HeadersLike,
  secret = env.SENT_WEBHOOK_SIGNING_SECRET,
  nowMs = Date.now(),
): SentWebhookSignatureResult {
  if (!secret) {
    return { ok: true, configured: false, reason: 'secret_not_configured' };
  }

  const signature = getHeader(headers, 'x-webhook-signature');
  const webhookId = getHeader(headers, 'x-webhook-id');
  const timestamp = getHeader(headers, 'x-webhook-timestamp');
  if (!signature || !webhookId || !timestamp) {
    return { ok: false, configured: true, reason: 'missing_signature_headers' };
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return { ok: false, configured: true, reason: 'invalid_timestamp' };
  }
  if (Math.abs(nowMs - timestampSeconds * 1000) > 5 * 60 * 1000) {
    return { ok: false, configured: true, reason: 'stale_timestamp' };
  }

  const secretBody = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  const key = Buffer.from(secretBody, 'base64');
  if (key.length === 0) {
    return { ok: false, configured: true, reason: 'invalid_signing_secret' };
  }

  const signedContent = `${webhookId}.${timestamp}.${rawBody}`;
  const digest = crypto.createHmac('sha256', key).update(signedContent).digest('base64');
  const expected = `v1,${digest}`;
  const provided = signature
    .split(/\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);

  if (provided.some((part) => timingSafeEqual(part, expected))) {
    return { ok: true, configured: true };
  }

  return { ok: false, configured: true, reason: 'signature_mismatch' };
}

export async function handleSentWebhook(
  rawBody: string,
  headers: HeadersLike,
): Promise<SentWebhookHandleResult> {
  const signature = verifySentWebhookSignature(rawBody, headers);
  if (!signature.ok) {
    throw new SentWebhookAuthError(signature.reason);
  }

  const envelope = parseSentWebhookEnvelope(rawBody);
  const update = extractSentMessageUpdate(envelope);
  const dbUpdate = await applySentMessageUpdate(update, getHeader(headers, 'x-webhook-id'));

  return {
    received: true,
    verified: signature.configured,
    field: envelope.field,
    subType: envelope.subType,
    messageId: update.messageId,
    messageStatus: update.messageStatus,
    updated: dbUpdate.updated,
    skippedReason: dbUpdate.skippedReason,
  };
}

export class SentWebhookAuthError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'SentWebhookAuthError';
  }
}

export class SentWebhookPayloadError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'SentWebhookPayloadError';
  }
}

async function applySentMessageUpdate(
  update: SentMessageWebhookUpdate,
  webhookId: string | null,
): Promise<{ updated: number; skippedReason?: string }> {
  if (update.field && update.field !== 'message') {
    return { updated: 0, skippedReason: 'unsupported_field' };
  }
  if (!update.messageId) {
    return { updated: 0, skippedReason: 'missing_message_id' };
  }
  if (!hasDb()) {
    return { updated: 0, skippedReason: 'database_not_configured' };
  }

  const patch = removeUndefined({
    deliveryStatus: update.messageStatus ?? undefined,
    deliveryChannel: update.channel ?? undefined,
    deliveryDescription: update.description ?? undefined,
    sentWebhookEvent: update.subType ?? update.field ?? undefined,
    sentWebhookId: webhookId ?? undefined,
    sentWebhookTimestamp: update.timestamp ?? undefined,
    sentWebhookLastSeenAt: new Date().toISOString(),
    sentWebhookPayload: sanitizePayload(update.payload),
  });

  const rows = (await db()`
    update audit_log
    set meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb
    where meta->>'messageId' = ${update.messageId}
    returning id
  `) as unknown as Array<{ id: number }>;

  return { updated: rows.length };
}

function getHeader(headers: HeadersLike, name: string): string | null {
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name) ?? (headers as Headers).get(name.toLowerCase());
  }
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lower) continue;
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

function removeUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
}

function sanitizePayload(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (typeof value === 'string') return value.length > 300 ? `${value.slice(0, 300)}...` : value;
  if (typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizePayload(entry, depth + 1));
  }

  const source = value as Record<string, unknown>;
  const entries = Object.entries(source)
    .slice(0, 40)
    .map(([key, entry]) => {
      const lower = key.toLowerCase();
      if (
        lower.includes('phone') ||
        lower === 'to' ||
        lower === 'recipient' ||
        lower === 'recipients'
      ) {
        return [key, '[redacted]'] as const;
      }
      return [key, sanitizePayload(entry, depth + 1)] as const;
    });
  return Object.fromEntries(entries);
}
