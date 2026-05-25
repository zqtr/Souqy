import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
const ownerMock = vi.hoisted(() => vi.fn());
const listCustomersMock = vi.hoisted(() => vi.fn());
const getCustomerMock = vi.hoisted(() => vi.fn());
const sendSentTemplateMock = vi.hoisted(() => vi.fn());
const waitForSentMessageStatusMock = vi.hoisted(() => vi.fn());
const recordAuditMock = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/products', () => ({
  assertStorefrontOwner: ownerMock,
}));

vi.mock('@/lib/customers', () => ({
  listCustomers: listCustomersMock,
  getCustomer: getCustomerMock,
}));

vi.mock('@/lib/sent', () => ({
  sendSentTemplate: sendSentTemplateMock,
  waitForSentMessageStatus: waitForSentMessageStatusMock,
}));

vi.mock('@/lib/audit', () => ({
  recordAudit: recordAuditMock,
}));

import { sendDashboardMessage } from '@/app/actions/messages';

describe('sendDashboardMessage', () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    ownerMock.mockResolvedValue({ businessName: 'Test Store' });
    listCustomersMock.mockReset();
    getCustomerMock.mockReset();
    sendSentTemplateMock.mockReset();
    waitForSentMessageStatusMock.mockReset();
    recordAuditMock.mockReset();
  });

  it('requires storefront ownership', async () => {
    ownerMock.mockResolvedValueOnce(null);

    await expect(
      sendDashboardMessage({
        storefrontSlug: 'test',
        type: 'customer_care',
        recipientMode: 'manual_phone',
        manualPhone: '55554444',
        message: 'Hello',
      }),
    ).resolves.toEqual({ status: 'error', message: 'Forbidden' });
    expect(sendSentTemplateMock).not.toHaveBeenCalled();
  });

  it('filters marketing audiences to opted-in phone customers', async () => {
    listCustomersMock.mockResolvedValueOnce([
      {
        phone: '55551111',
        marketingConsent: true,
        firstName: 'A',
        lastName: null,
        lastSeenAt: new Date(),
      },
      {
        phone: '55552222',
        marketingConsent: false,
        firstName: 'B',
        lastName: null,
        lastSeenAt: new Date(),
      },
      {
        phone: null,
        marketingConsent: true,
        firstName: 'C',
        lastName: null,
        lastSeenAt: new Date(),
      },
    ]);
    sendSentTemplateMock.mockResolvedValueOnce({
      status: 'sent',
      recipientCount: 1,
      messageId: 'msg_1',
      raw: {},
    });
    waitForSentMessageStatusMock.mockResolvedValueOnce({
      status: 'ok',
      messageStatus: 'SENT',
      channel: 'whatsapp',
      description: 'Message sent via WhatsApp',
      raw: {},
    });

    await expect(
      sendDashboardMessage({
        storefrontSlug: 'test',
        type: 'marketing',
        recipientMode: 'marketing_audience',
        audience: 'consented_only',
        subject: 'New drop',
        message: 'A new collection is ready.',
      }),
    ).resolves.toEqual({
      status: 'success',
      sent: 1,
      skipped: 2,
      messageId: 'msg_1',
      sandbox: false,
      deliveryStatus: 'SENT',
      deliveryChannel: 'whatsapp',
    });

    expect(sendSentTemplateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'marketing',
        to: ['55551111'],
        channel: ['whatsapp'],
        parameters: expect.objectContaining({
          storeName: 'Test Store',
          subject: 'New drop',
          message: 'A new collection is ready.',
        }),
      }),
    );
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'messages.sentdm.send',
        meta: expect.objectContaining({
          type: 'marketing',
          recipientCount: 1,
          deliveryStatus: 'SENT',
          deliveryChannel: 'whatsapp',
        }),
      }),
    );
  });

  it('reports Sent provider delivery failure after queueing', async () => {
    sendSentTemplateMock.mockResolvedValueOnce({
      status: 'sent',
      recipientCount: 1,
      messageId: 'msg_failed',
      raw: {},
    });
    waitForSentMessageStatusMock.mockResolvedValueOnce({
      status: 'ok',
      messageStatus: 'FAILED',
      channel: 'whatsapp',
      description: 'Message updated to FAILED',
      raw: {},
    });

    await expect(
      sendDashboardMessage({
        storefrontSlug: 'test',
        type: 'customer_care',
        recipientMode: 'manual_phone',
        manualPhone: '55554444',
        message: 'Hello',
      }),
    ).resolves.toEqual({
      status: 'error',
      message:
        'Sent accepted the message but WhatsApp marked delivery as FAILED on whatsapp. Message ID: msg_failed. Sent did not expose a deeper provider reason. Check Meta payment method, WhatsApp Business verification, sender phone health, whether the recipient can receive WhatsApp Business messages, and whether the approved template variables match the API payload.',
    });

    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          messageId: 'msg_failed',
          deliveryStatus: 'FAILED',
          deliveryChannel: 'whatsapp',
        }),
      }),
    );
  });

  it('uses a useful failed-delivery checklist when Sent exposes no reason', async () => {
    sendSentTemplateMock.mockResolvedValueOnce({
      status: 'sent',
      recipientCount: 1,
      messageId: 'msg_failed_no_reason',
      raw: {},
    });
    waitForSentMessageStatusMock.mockResolvedValueOnce({
      status: 'ok',
      messageStatus: 'FAILED',
      channel: 'whatsapp',
      description: null,
      raw: {},
    });

    await expect(
      sendDashboardMessage({
        storefrontSlug: 'test',
        type: 'customer_care',
        recipientMode: 'manual_phone',
        manualPhone: '55554444',
        message: 'Hello',
      }),
    ).resolves.toEqual({
      status: 'error',
      message:
        'Sent accepted the message but WhatsApp marked delivery as FAILED on whatsapp. Message ID: msg_failed_no_reason. Sent did not expose a deeper provider reason. Check Meta payment method, WhatsApp Business verification, sender phone health, whether the recipient can receive WhatsApp Business messages, and whether the approved template variables match the API payload.',
    });
  });

  it('does not allow non-marketing templates to send to an audience', async () => {
    await expect(
      sendDashboardMessage({
        storefrontSlug: 'test',
        type: 'fraud_alert',
        recipientMode: 'marketing_audience',
        message: 'Security alert',
      }),
    ).resolves.toEqual({
      status: 'error',
      message: 'Audience sends are available for marketing templates only.',
    });
    expect(sendSentTemplateMock).not.toHaveBeenCalled();
  });

  it('requires consent for marketing messages to saved customers', async () => {
    getCustomerMock.mockResolvedValueOnce({
      id: 8,
      phone: '55553333',
      marketingConsent: false,
      firstName: 'Maha',
      lastName: null,
    });

    await expect(
      sendDashboardMessage({
        storefrontSlug: 'test',
        type: 'marketing',
        recipientMode: 'single_customer',
        customerId: 8,
        subject: 'New drop',
        message: 'A new collection is ready.',
      }),
    ).resolves.toEqual({
      status: 'error',
      message: 'This customer has not opted in to marketing messages.',
    });
    expect(sendSentTemplateMock).not.toHaveBeenCalled();
  });
});
