import { createHash } from 'node:crypto';
import { env } from '@/lib/env';
import { createInquiry } from '@/lib/inquiries';
import {
  sendSentAccountNotification,
  sendSentDeliveryNotification,
  sendSentPaymentStatusNotification,
  sendSentTemplate,
  type SentSendResult,
} from '@/lib/sent';
import type { Order as CheckoutOrder } from '@/lib/checkout-orders';
import type { Customer } from '@/lib/customers';
import type { Order as AdminOrder } from '@/lib/orders';
import { decryptToken } from './crypto';
import {
  DEFAULT_WHATSAPP_SETTINGS,
  SOUQNA_WHATSAPP_TEMPLATES,
  normaliseSettings,
  whatsappDigits,
  type WhatsAppSettings,
} from './whatsapp-settings';
import {
  getInstalledApp,
  getInstalledAppByProviderAccountField,
  setAppLastError,
  setAppLastSuccess,
} from './installed';

export {
  DEFAULT_WHATSAPP_SETTINGS,
  SOUQNA_WHATSAPP_TEMPLATES,
  normaliseSettings,
  whatsappDigits,
  type WhatsAppSettings,
};

export async function handleWhatsAppWebhook(body: unknown) {
  const events = parseWebhookMessages(body);
  let created = 0;
  for (const event of events) {
    const installed = await getInstalledAppByProviderAccountField(
      'whatsapp-business',
      'phoneNumberId',
      event.phoneNumberId,
    );
    if (!installed) continue;
    const settings = normaliseSettings(installed.settings);
    if (!settings.inboundCreatesInquiries) continue;
    try {
      await createInquiry(installed.storefrontSlug, {
        message: event.text || '[WhatsApp message]',
        visitorName: event.profileName,
        visitorPhone: event.from,
        visitorEmail: null,
        preferredChannel: 'whatsapp',
        sourceUrl: null,
        userAgent: 'meta-whatsapp-webhook',
        marketingConsent: false,
        meta: {
          source: 'whatsapp',
          providerMessageId: event.messageId,
          wabaPhoneNumberId: event.phoneNumberId,
          timestamp: event.timestamp,
        },
      });
      await setAppLastSuccess(installed.storefrontSlug, 'whatsapp-business');
      created += 1;
    } catch (err) {
      await setAppLastError(
        installed.storefrontSlug,
        'whatsapp-business',
        err instanceof Error ? err.message : 'WhatsApp inbound sync failed',
      ).catch(() => {});
    }
  }
  return { received: events.length, created };
}

export async function sendWhatsAppOrderConfirmation(input: {
  storefrontSlug: string;
  businessName: string;
  order: CheckoutOrder;
}) {
  const souqnaOrder = await sendSouqnaOrderConfirmationTemplate(input);
  if (!shouldTryMerchantWhatsAppFallback(souqnaOrder)) {
    return souqnaOrder;
  }

  const installed = await getInstalledApp(input.storefrontSlug, 'whatsapp-business');
  if (!installed?.enabled) return { status: 'skipped' as const, reason: 'not_installed' };

  const settings = normaliseSettings(installed.settings);
  const phoneNumberId = text(installed.providerAccount.phoneNumberId);
  const token = decryptToken(installed.oauthAccessTokenCt);

  if (settings.outboundMode !== 'template') {
    return { status: 'skipped' as const, reason: 'manual_mode' };
  }
  if (!settings.inquiryTemplateName) {
    const message =
      'WhatsApp order tracking not sent: add an approved Meta template name in Apps > WhatsApp Business > Configure.';
    await setAppLastError(input.storefrontSlug, 'whatsapp-business', message);
    return { status: 'skipped' as const, reason: 'missing_template' };
  }
  if (!phoneNumberId || !token) {
    const message =
      'WhatsApp order tracking not sent: connected Meta account is missing a phone number or access token.';
    await setAppLastError(input.storefrontSlug, 'whatsapp-business', message);
    return { status: 'skipped' as const, reason: 'missing_meta_connection' };
  }

  const to = normaliseRecipientPhone(input.order.customerPhone);
  if (!to) {
    const message = 'WhatsApp order tracking not sent: customer phone is invalid.';
    await setAppLastError(input.storefrontSlug, 'whatsapp-business', message);
    return { status: 'skipped' as const, reason: 'invalid_customer_phone' };
  }

  const orderTemplate = orderConfirmationTemplate(settings);
  const res = await fetch(
    `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${encodeURIComponent(
      phoneNumberId,
    )}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: orderTemplate.name,
          language: { code: orderTemplate.language },
          components: buildOrderTemplateComponents(input),
        },
      }),
    },
  );

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = metaErrorMessage(json, res.status);
    await setAppLastError(input.storefrontSlug, 'whatsapp-business', message);
    return { status: 'error' as const, reason: message };
  }

  await setAppLastSuccess(input.storefrontSlug, 'whatsapp-business');
  return {
    status: 'sent' as const,
    messageId: text(asRecord(asArray(json.messages)[0]).id) || null,
  };
}

export async function sendWhatsAppAdminOrderConfirmation(input: {
  storefrontSlug: string;
  businessName: string;
  order: AdminOrder;
  customer: Customer;
}) {
  const params = adminOrderTemplateTextParams(input);
  const souqnaOrder = await sendSentTemplate({
    kind: 'delivery_notification',
    to: [input.customer.phone],
    idempotencyKey: `admin-order-confirmation-${input.order.id}`,
    parameters: {
      customerName: params[0] ?? 'Customer',
      storeName: input.businessName,
      orderNumber: params[2] ?? `#${input.order.orderNumber}`,
      orderStatus: input.order.status,
      paymentStatus: input.order.paymentStatus,
      total: params[3] ?? formatAdminOrderTotal(input.order),
      message: 'Your order was logged by the store. Contact the store if any details need to change.',
      actionUrl: `${env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/u, '')}/account/orders/${input.order.id}?store=${encodeURIComponent(
        input.storefrontSlug,
      )}`,
    },
  });
  if (!shouldTryMerchantWhatsAppFallback(souqnaOrder)) {
    return souqnaOrder;
  }

  const installed = await getInstalledApp(input.storefrontSlug, 'whatsapp-business');
  if (!installed?.enabled) return { status: 'skipped' as const, reason: 'not_installed' };

  const settings = normaliseSettings(installed.settings);
  if (settings.outboundMode !== 'template') {
    return { status: 'skipped' as const, reason: 'manual_mode' };
  }

  const phoneNumberId = text(installed.providerAccount.phoneNumberId);
  const token = decryptToken(installed.oauthAccessTokenCt);
  if (!phoneNumberId || !token) {
    const message =
      'WhatsApp order tracking not sent: connected Meta account is missing a phone number or access token.';
    await setAppLastError(input.storefrontSlug, 'whatsapp-business', message);
    return { status: 'skipped' as const, reason: 'missing_meta_connection' };
  }

  const to = normaliseRecipientPhone(input.customer.phone ?? '');
  if (!to) {
    const message = 'WhatsApp order tracking not sent: customer phone is invalid.';
    await setAppLastError(input.storefrontSlug, 'whatsapp-business', message);
    return { status: 'skipped' as const, reason: 'invalid_customer_phone' };
  }

  const orderTemplate = orderConfirmationTemplate(settings);
  const res = await fetch(
    `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${encodeURIComponent(
      phoneNumberId,
    )}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: orderTemplate.name,
          language: { code: orderTemplate.language },
          components: [
            {
              type: 'body',
              parameters: params.map((value) => ({ type: 'text', text: value })),
            },
          ],
        },
      }),
    },
  );

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = metaErrorMessage(json, res.status);
    await setAppLastError(input.storefrontSlug, 'whatsapp-business', message);
    return { status: 'error' as const, reason: message };
  }

  await setAppLastSuccess(input.storefrontSlug, 'whatsapp-business');
  return {
    status: 'sent' as const,
    messageId: text(asRecord(asArray(json.messages)[0]).id) || null,
  };
}

function adminOrderTemplateTextParams(input: {
  storefrontSlug: string;
  businessName: string;
  order: AdminOrder;
  customer: Customer;
}) {
  const customerName =
    [input.customer.firstName, input.customer.lastName].filter(Boolean).join(' ').trim() ||
    input.customer.phone ||
    'Customer';
  return [
    customerName,
    input.businessName,
    `#${input.order.orderNumber}`,
    formatAdminOrderTotal(input.order),
  ];
}

function buildOrderTemplateComponents(input: {
  storefrontSlug: string;
  businessName: string;
  order: CheckoutOrder;
}) {
  return [
    {
      type: 'body',
      parameters: orderTemplateTextParams(input).map((value) => ({
        type: 'text',
        text: value,
      })),
    },
  ];
}

function orderTemplateTextParams(input: {
  storefrontSlug: string;
  businessName: string;
  order: CheckoutOrder;
}) {
  return [
    input.order.customerName,
    input.businessName,
    shortOrderId(input.order.id),
    formatOrderTotal(input.order),
  ];
}

async function sendSouqnaOrderConfirmationTemplate(input: {
  storefrontSlug: string;
  businessName: string;
  order: CheckoutOrder;
}) {
  return sendSentDeliveryNotification({
    phone: input.order.customerPhone,
    storeName: input.businessName,
    order: input.order,
    idempotencyKey: `order-confirmation-${input.order.id}`,
  });
}

export async function sendSouqnaAccountCreatedTemplate(input: {
  phone: string | null | undefined;
  founderName: string;
}) {
  return sendSentAccountNotification({
    phone: input.phone,
    founderName: input.founderName,
    message: 'Your Souqna account is ready. Important store and order updates will come here.',
    actionUrl: env.NEXT_PUBLIC_SITE_URL,
    idempotencyKey: `account-created-${input.phone ?? input.founderName}`,
  });
}

export async function sendSouqnaStoreCreatedTemplate(input: {
  phone: string | null | undefined;
  founderName: string;
  businessName: string;
  dashboardUrl: string;
}) {
  return sendSentAccountNotification({
    phone: input.phone,
    founderName: input.founderName,
    storeName: input.businessName,
    message: `${input.businessName} is ready on Souqna. Open your dashboard to add products and share the store.`,
    actionUrl: input.dashboardUrl,
    idempotencyKey: `store-created-${input.businessName}-${input.phone ?? ''}`,
  });
}

export async function sendSouqnaFirstOrderTemplate(input: {
  phone: string | null | undefined;
  founderName: string;
  businessName: string;
  order: CheckoutOrder;
}) {
  return sendSentAccountNotification({
    phone: input.phone,
    founderName: input.founderName,
    storeName: input.businessName,
    message: `${input.businessName} received its first order: ${shortOrderId(
      input.order.id,
    )} for ${formatOrderTotal(input.order)}.`,
    actionUrl: `${env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/u, '')}/account/orders?store=${encodeURIComponent(
      input.order.storefrontSlug,
    )}`,
    idempotencyKey: `first-order-${input.order.id}`,
  });
}

export async function sendSouqnaPaymentStatusTemplate(input: {
  businessName: string;
  order: CheckoutOrder;
  status: 'paid' | 'failed';
}) {
  return sendSentPaymentStatusNotification({
    storeName: input.businessName,
    order: input.order,
    status: input.status,
    idempotencyKey: `payment-${input.status}-${input.order.id}`,
  });
}

function shouldTryMerchantWhatsAppFallback(result: SentSendResult) {
  if (result.status === 'sent') return false;
  if (result.status === 'skipped') {
    return result.reason === 'missing_sent_api_key' || result.reason === 'missing_sent_template_id';
  }
  return true;
}

function orderConfirmationTemplate(settings: WhatsAppSettings) {
  if (
    !settings.inquiryTemplateName ||
    settings.inquiryTemplateName === 'order_tracking_ar'
  ) {
    return SOUQNA_WHATSAPP_TEMPLATES.orderConfirmation;
  }
  return {
    name: settings.inquiryTemplateName,
    language:
      settings.inquiryTemplateName === SOUQNA_WHATSAPP_TEMPLATES.orderConfirmation.name
        ? SOUQNA_WHATSAPP_TEMPLATES.orderConfirmation.language
        : settings.templateLanguage,
  };
}

function normaliseRecipientPhone(phone: string) {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 8) return `974${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return '';
}

function shortOrderId(id: string) {
  return id.split('-')[0] || id.slice(0, 8);
}

function formatOrderTotal(order: CheckoutOrder) {
  return `${order.currency} ${order.totalQar.toLocaleString('en-QA')}`;
}

function formatAdminOrderTotal(order: AdminOrder) {
  return `${order.currencyCode} ${order.total.toLocaleString('en-QA')}`;
}

function metaErrorMessage(json: Record<string, unknown>, status: number) {
  const error = asRecord(json.error);
  const message = text(error.message);
  const code = text(error.code);
  const subcode = text(error.error_subcode);
  const suffix = [code ? `code ${code}` : '', subcode ? `subcode ${subcode}` : '']
    .filter(Boolean)
    .join(', ');
  return `WhatsApp order confirmation failed (${status})${
    suffix ? ` ${suffix}` : ''
  }: ${message || 'Meta rejected the message.'}`.slice(0, 1000);
}

function parseWebhookMessages(body: unknown) {
  const root = asRecord(body);
  const entries = Array.isArray(root.entry) ? root.entry : [];
  const events: Array<{
    phoneNumberId: string;
    messageId: string;
    from: string;
    profileName: string | null;
    text: string;
    timestamp: string | null;
  }> = [];

  for (const entry of entries) {
    const changes = asArray(asRecord(entry).changes);
    for (const change of changes) {
      const value = asRecord(asRecord(change).value);
      const metadata = asRecord(value.metadata);
      const phoneNumberId = text(metadata.phone_number_id);
      if (!phoneNumberId) continue;
      const contactByWaId = new Map<string, string>();
      for (const contact of asArray(value.contacts)) {
        const c = asRecord(contact);
        const waId = text(c.wa_id);
        const profileName = text(asRecord(c.profile).name);
        if (waId && profileName) contactByWaId.set(waId, profileName);
      }
      for (const message of asArray(value.messages)) {
        const m = asRecord(message);
        const from = text(m.from);
        const messageId = text(m.id) || fallbackMessageId(phoneNumberId, from, m);
        if (!from || !messageId) continue;
        events.push({
          phoneNumberId,
          messageId,
          from,
          profileName: contactByWaId.get(from) ?? null,
          text: messageText(m),
          timestamp: text(m.timestamp) || null,
        });
      }
    }
  }
  return events;
}

function messageText(message: Record<string, unknown>) {
  const type = text(message.type);
  if (type === 'text') return text(asRecord(message.text).body);
  if (type === 'button') return text(asRecord(message.button).text);
  if (type === 'interactive') {
    const interactive = asRecord(message.interactive);
    return (
      text(asRecord(interactive.button_reply).title) ||
      text(asRecord(interactive.list_reply).title) ||
      '[WhatsApp interactive message]'
    );
  }
  return type ? `[WhatsApp ${type} message]` : '[WhatsApp message]';
}

function fallbackMessageId(
  phoneNumberId: string,
  from: string,
  message: Record<string, unknown>,
) {
  return createHash('sha256')
    .update(`${phoneNumberId}:${from}:${JSON.stringify(message)}`)
    .digest('hex');
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
