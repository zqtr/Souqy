import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQueryMock = vi.hoisted(() => vi.fn());
const hasDbMock = vi.hoisted(() => vi.fn(() => true));

vi.mock('@/lib/db', () => ({
  db: () => dbQueryMock,
  hasDb: hasDbMock,
}));

vi.mock('@/lib/env', () => ({
  env: {
    SENT_WEBHOOK_SIGNING_SECRET: undefined,
  },
}));

import {
  extractSentMessageUpdate,
  handleSentWebhook,
  parseSentWebhookEnvelope,
  verifySentWebhookSignature,
} from '@/lib/sentWebhook';

describe('Sent webhook helpers', () => {
  beforeEach(() => {
    dbQueryMock.mockReset();
    hasDbMock.mockReset();
    hasDbMock.mockReturnValue(true);
  });

  it('parses message status webhook payloads', () => {
    const raw = JSON.stringify({
      field: 'message',
      sub_type: 'message.failed',
      timestamp: '2026-05-24T06:18:27.000Z',
      payload: {
        message_id: 'msg_123',
        message_status: 'FAILED',
        channel: 'whatsapp',
        description: 'Message updated to FAILED',
      },
    });

    const envelope = parseSentWebhookEnvelope(raw);
    expect(extractSentMessageUpdate(envelope)).toMatchObject({
      field: 'message',
      subType: 'message.failed',
      messageId: 'msg_123',
      messageStatus: 'FAILED',
      channel: 'whatsapp',
      description: 'Message updated to FAILED',
    });
  });

  it('verifies Sent HMAC signatures with whsec secrets', () => {
    const raw = JSON.stringify({ field: 'message', payload: { message_id: 'msg_123' } });
    const secretBody = Buffer.from('souqna-webhook-test-key').toString('base64');
    const secret = `whsec_${secretBody}`;
    const webhookId = 'wh_123';
    const timestamp = '1779586469';
    const digest = crypto
      .createHmac('sha256', Buffer.from(secretBody, 'base64'))
      .update(`${webhookId}.${timestamp}.${raw}`)
      .digest('base64');

    expect(
      verifySentWebhookSignature(
        raw,
        {
          'x-webhook-id': webhookId,
          'x-webhook-timestamp': timestamp,
          'x-webhook-signature': `v1,${digest}`,
        },
        secret,
        Number(timestamp) * 1000,
      ),
    ).toEqual({ ok: true, configured: true });
  });

  it('rejects stale or mismatched Sent signatures', () => {
    const raw = JSON.stringify({ field: 'message', payload: { message_id: 'msg_123' } });
    const secret = `whsec_${Buffer.from('souqna-webhook-test-key').toString('base64')}`;

    expect(
      verifySentWebhookSignature(
        raw,
        {
          'x-webhook-id': 'wh_123',
          'x-webhook-timestamp': '1779586469',
          'x-webhook-signature': 'v1,not-right',
        },
        secret,
        1779586469000,
      ),
    ).toEqual({ ok: false, configured: true, reason: 'signature_mismatch' });

    expect(
      verifySentWebhookSignature(
        raw,
        {
          'x-webhook-id': 'wh_123',
          'x-webhook-timestamp': '1779586469',
          'x-webhook-signature': 'v1,not-right',
        },
        secret,
        1779586469000 + 10 * 60 * 1000,
      ),
    ).toEqual({ ok: false, configured: true, reason: 'stale_timestamp' });
  });

  it('updates matching message audit metadata without requiring a secret during setup', async () => {
    dbQueryMock.mockResolvedValueOnce([{ id: 7 }]);
    const raw = JSON.stringify({
      field: 'message',
      sub_type: 'message.delivered',
      timestamp: '2026-05-24T06:20:00.000Z',
      payload: {
        message_id: 'msg_123',
        message_status: 'DELIVERED',
        channel: 'whatsapp',
        phone: '+97455554444',
      },
    });

    await expect(handleSentWebhook(raw, new Headers())).resolves.toMatchObject({
      received: true,
      verified: false,
      messageId: 'msg_123',
      messageStatus: 'DELIVERED',
      updated: 1,
    });

    const patch = JSON.parse(String(dbQueryMock.mock.calls[0]?.[1])) as Record<string, unknown>;
    expect(patch).toMatchObject({
      deliveryStatus: 'DELIVERED',
      deliveryChannel: 'whatsapp',
      sentWebhookEvent: 'message.delivered',
    });
    expect(patch.sentWebhookPayload).toMatchObject({ phone: '[redacted]' });
  });
});
