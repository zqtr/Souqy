import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadSent(vars: Record<string, string | undefined> = {}) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) continue;
    vi.stubEnv(key, value);
  }
  return import('@/lib/sent');
}

describe('Sent.dm helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('keeps the confirmed Souqna template mapping', async () => {
    const sent = await loadSent();
    expect(sent.SENT_TEMPLATE_IDS).toEqual({
      marketing: '298977b3-2b1e-417f-b21a-01cb736f7e74',
      customer_care: '8681a1e0-70af-4960-8874-3668917bfdb6',
      fraud_alert: '8f800498-7173-4385-b6ba-dc3947e6ba7d',
      delivery_notification: '0507e170-a5f5-4cdd-8762-5da349c2851b',
      account_notification: '46ce102a-e54d-4ce0-a177-683133b0c551',
    });
  });

  it('normalizes Qatari and international phone numbers to E.164', async () => {
    const { normalizeSentPhone } = await loadSent();
    expect(normalizeSentPhone('5555 4444')).toBe('+97455554444');
    expect(normalizeSentPhone('97455554444')).toBe('+97455554444');
    expect(normalizeSentPhone('0097155554444')).toBe('+97155554444');
    expect(normalizeSentPhone('+1 (415) 555-1212')).toBe('+14155551212');
    expect(normalizeSentPhone('12')).toBeNull();
  });

  it('builds the Sent v3 message payload with template parameters', async () => {
    const { buildSentMessagePayload } = await loadSent();
    expect(
      buildSentMessagePayload({
        to: ['55554444', '55554444', null],
        templateId: '0507e170-a5f5-4cdd-8762-5da349c2851b',
        parameters: {
          customerName: 'Maha',
          empty: '',
          orderNumber: '#ABC',
        },
        channel: ['whatsapp'],
        sandbox: true,
      }),
    ).toEqual({
      to: ['+97455554444'],
      channel: ['whatsapp'],
      sandbox: true,
      template: {
        id: '0507e170-a5f5-4cdd-8762-5da349c2851b',
        parameters: {
          customerName: 'Maha',
          orderNumber: '#ABC',
        },
      },
    });
  });

  it('adds generic Sent template variable aliases before sending', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ data: { messages: [{ id: 'msg_123' }] } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { sendSentTemplate } = await loadSent({ SENT_API_KEY: 'test_key' });

    await expect(
      sendSentTemplate({
        kind: 'account_notification',
        to: ['55554444'],
        sandbox: true,
        parameters: {
          customerName: 'Maha',
          storeName: 'Test',
          subject: 'Welcome',
          message: 'Your store is ready.',
          actionUrl: 'https://souqna.qa/account',
        },
      }),
    ).resolves.toMatchObject({ status: 'sent', recipientCount: 1 });

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request).toMatchObject({
      to: ['+97455554444'],
      sandbox: true,
      template: {
        id: '46ce102a-e54d-4ce0-a177-683133b0c551',
        parameters: {
          customerName: 'Maha',
          storeName: 'Test',
          subject: 'Welcome',
          message: 'Your store is ready.',
          actionUrl: 'https://souqna.qa/account',
          var_1: 'Maha',
          var_2: 'Test',
          var_3: 'Welcome',
          var_4: 'Your store is ready.',
          var_5: 'https://souqna.qa/account',
        },
      },
    });
  });

  it('skips sends when the server API key is missing', async () => {
    const { sendSentTemplate } = await loadSent({ SENT_API_KEY: '' });
    await expect(
      sendSentTemplate({
        kind: 'account_notification',
        to: ['55554444'],
        parameters: { message: 'Hello' },
      }),
    ).resolves.toEqual({ status: 'skipped', reason: 'missing_sent_api_key' });
  });

  it('posts to the official Sent endpoint and surfaces provider errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Bad key' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { sendSentTemplate } = await loadSent({ SENT_API_KEY: 'test_key' });

    const result = await sendSentTemplate({
      kind: 'customer_care',
      to: ['55554444'],
      parameters: { customerName: 'Maha', message: 'We can help.' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.sent.dm/v3/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'test_key',
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(result).toEqual({
      status: 'error',
      statusCode: 401,
      reason: 'Sent request failed (401): Bad key',
    });
  });

  it('includes nested Sent validation details in error messages', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          message: 'A required field is missing',
          details: [{ field: 'template.parameters.var_2', message: 'required' }],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { sendSentTemplate } = await loadSent({ SENT_API_KEY: 'test_key' });

    const result = await sendSentTemplate({
      kind: 'marketing',
      to: ['55554444'],
      parameters: { message: 'Hello' },
    });

    expect(result).toEqual({
      status: 'error',
      statusCode: 400,
      reason:
        'Sent request failed (400): A required field is missing - template.parameters.var_2 - required',
    });
  });

  it('reads Sent message status without exposing recipient details', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: 'msg_1',
          phone: '+97455554444',
          channel: 'whatsapp',
          status: 'FAILED',
          events: [
            { status: 'QUEUED', description: 'Message queued for sending' },
            { status: 'FAILED', description: 'Message updated to FAILED' },
          ],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { getSentMessageStatus } = await loadSent({ SENT_API_KEY: 'test_key' });

    await expect(getSentMessageStatus('msg_1')).resolves.toMatchObject({
      status: 'ok',
      messageStatus: 'FAILED',
      channel: 'whatsapp',
      description: 'Message updated to FAILED',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.sent.dm/v3/messages/msg_1',
      expect.objectContaining({
        method: 'GET',
        headers: { 'x-api-key': 'test_key' },
      }),
    );
  });

  it('uses the event matching the final Sent status when events are newest-first', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: 'msg_1',
          channel: 'whatsapp',
          status: 'FAILED',
          events: [
            { status: 'FAILED', description: 'Message updated to FAILED' },
            { status: 'QUEUED', description: 'Message updated to QUEUED' },
          ],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { getSentMessageStatus } = await loadSent({ SENT_API_KEY: 'test_key' });

    await expect(getSentMessageStatus('msg_1')).resolves.toMatchObject({
      status: 'ok',
      messageStatus: 'FAILED',
      description: 'Message updated to FAILED',
    });
  });

  it('falls back to provider failure fields when Sent has no event description', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: 'msg_1',
          channel: 'whatsapp',
          status: 'FAILED',
          failure_reason: 'Template parameter mismatch',
          events: [{ status: 'FAILED' }],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { getSentMessageStatus } = await loadSent({ SENT_API_KEY: 'test_key' });

    await expect(getSentMessageStatus('msg_1')).resolves.toMatchObject({
      status: 'ok',
      messageStatus: 'FAILED',
      description: 'Template parameter mismatch',
    });
  });
});
