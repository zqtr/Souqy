'use server';

import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { assertStorefrontOwner } from '@/lib/products';
import { getCustomer, listCustomers } from '@/lib/customers';
import { recordAudit } from '@/lib/audit';
import {
  waitForSentMessageStatus,
  sendSentTemplate,
  type SentChannel,
  type SentTemplateKind,
  type SentTemplateParameters,
} from '@/lib/sent';

const MessageTypeSchema = z.enum([
  'marketing',
  'customer_care',
  'fraud_alert',
  'delivery_notification',
  'account_notification',
]);

const Schema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  type: MessageTypeSchema,
  recipientMode: z.enum(['manual_phone', 'single_customer', 'marketing_audience']),
  customerId: z.coerce.number().int().positive().optional().nullable(),
  manualPhone: z.string().trim().max(40).optional().default(''),
  manualName: z.string().trim().max(120).optional().default(''),
  audience: z.enum(['consented_only', 'recent_30d']).optional().default('consented_only'),
  subject: z.string().trim().max(140).optional().default(''),
  message: z.string().trim().min(1).max(900),
  actionUrl: z.string().trim().url().optional().or(z.literal('').transform(() => undefined)),
  channel: z.enum(['auto', 'sms', 'whatsapp', 'rcs']).optional().default('auto'),
  sandbox: z.boolean().optional().default(false),
});

export type SendDashboardMessageInput = z.input<typeof Schema>;
export type SendDashboardMessageState =
  | { status: 'idle' }
  | {
      status: 'success';
      sent: number;
      skipped: number;
      messageId: string | null;
      sandbox: boolean;
      deliveryStatus?: string | null;
      deliveryChannel?: string | null;
    }
  | { status: 'error'; message: string };

export async function sendDashboardMessage(
  input: SendDashboardMessageInput,
): Promise<SendDashboardMessageState> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid message.' };
  }
  const data = parsed.data;
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in to send messages.' };
  const owner = await assertStorefrontOwner(data.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };

  if (data.recipientMode === 'marketing_audience' && data.type !== 'marketing') {
    return {
      status: 'error',
      message: 'Audience sends are available for marketing templates only.',
    };
  }

  const recipients = await resolveRecipients(data);
  if (recipients.status === 'error') return recipients;
  if (recipients.to.length === 0) {
    return { status: 'error', message: 'No recipients with a valid phone number.' };
  }

  const channel: SentChannel[] = data.channel === 'auto' ? ['whatsapp'] : [data.channel as SentChannel];
  const sent = await sendSentTemplate({
    kind: data.type,
    to: recipients.to,
    channel,
    sandbox: data.sandbox,
    parameters: buildDashboardParameters({
      type: data.type,
      storeName: owner.businessName,
      customerName: recipients.customerName,
      subject: data.subject,
      message: data.message,
      actionUrl: data.actionUrl,
    }),
  });

  if (sent.status === 'skipped') {
    return {
      status: 'error',
      message: sent.reason === 'missing_sent_api_key'
        ? 'Sent API key is not configured for this environment.'
        : `Message skipped: ${sent.reason.replace(/_/g, ' ')}.`,
    };
  }
  if (sent.status === 'error') {
    return { status: 'error', message: sent.reason };
  }

  const delivery =
    !data.sandbox && sent.messageId
      ? await waitForSentMessageStatus(sent.messageId, { attempts: 4, delayMs: 450 })
      : null;

  await recordAudit({
    storefrontSlug: data.storefrontSlug,
    clerkUserId: userId,
    action: 'messages.sentdm.send',
    summary: `Sent ${data.type.replace(/_/g, ' ')} message to ${sent.recipientCount} recipient(s)`,
    meta: {
      type: data.type,
      recipientMode: data.recipientMode,
      audience: data.recipientMode === 'marketing_audience' ? data.audience : null,
      sandbox: data.sandbox,
      channel: channel[0],
      messageId: sent.messageId,
      recipientCount: sent.recipientCount,
      deliveryStatus: delivery?.status === 'ok' ? delivery.messageStatus : null,
      deliveryChannel: delivery?.status === 'ok' ? delivery.channel : null,
    },
  });

  if (delivery?.status === 'error') {
    return {
      status: 'error',
      message: `Sent queued the message, but Souqna could not confirm delivery status: ${delivery.reason}`,
    };
  }
  if (delivery?.status === 'ok' && delivery.messageStatus.toUpperCase() === 'FAILED') {
    const reason = sentFailureReason(delivery.description);
    return {
      status: 'error',
      message: `Sent accepted the message but WhatsApp marked delivery as FAILED${
        delivery.channel ? ` on ${delivery.channel}` : ''
      }. Message ID: ${sent.messageId}. ${reason ?? 'Check Sent Activities for the provider reason.'}`,
    };
  }

  revalidatePath('/account/messages');
  return {
    status: 'success',
    sent: sent.recipientCount,
    skipped: recipients.skipped,
    messageId: sent.messageId,
    sandbox: data.sandbox,
    deliveryStatus: delivery?.status === 'ok' ? delivery.messageStatus : null,
    deliveryChannel: delivery?.status === 'ok' ? delivery.channel : channel[0],
  };
}

async function resolveRecipients(
  data: z.infer<typeof Schema>,
): Promise<
  | { status: 'success'; to: string[]; skipped: number; customerName: string }
  | { status: 'error'; message: string }
> {
  if (data.recipientMode === 'manual_phone') {
    if (!data.manualPhone.trim()) return { status: 'error', message: 'Add a phone number.' };
    return {
      status: 'success',
      to: [data.manualPhone],
      skipped: 0,
      customerName: data.manualName || 'Customer',
    };
  }

  if (data.recipientMode === 'single_customer') {
    if (!data.customerId) return { status: 'error', message: 'Choose a customer.' };
    const customer = await getCustomer(data.storefrontSlug, data.customerId);
    if (!customer) return { status: 'error', message: 'Customer not found.' };
    if (!customer.phone) {
      return { status: 'error', message: 'This customer has no phone number.' };
    }
    if (data.type === 'marketing' && !customer.marketingConsent) {
      return {
        status: 'error',
        message: 'This customer has not opted in to marketing messages.',
      };
    }
    return {
      status: 'success',
      to: [customer.phone],
      skipped: 0,
      customerName: customerName(customer) || 'Customer',
    };
  }

  const customers = await listCustomers(data.storefrontSlug, { limit: 1000 });
  const cutoff30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const audience = customers.filter((customer) => {
    if (!customer.phone || !customer.marketingConsent) return false;
    if (data.audience === 'recent_30d') {
      return customer.lastSeenAt && customer.lastSeenAt.getTime() > cutoff30;
    }
    return true;
  });
  return {
    status: 'success',
    to: audience.map((customer) => customer.phone).filter((phone): phone is string => Boolean(phone)),
    skipped: customers.length - audience.length,
    customerName: 'Customer',
  };
}

function buildDashboardParameters(input: {
  type: SentTemplateKind;
  storeName: string;
  customerName: string;
  subject?: string;
  message: string;
  actionUrl?: string;
}): SentTemplateParameters {
  const base = {
    customerName: input.customerName,
    storeName: input.storeName,
    subject: input.subject ?? '',
    message: input.message,
    actionUrl: input.actionUrl ?? '',
  };
  if (input.type === 'fraud_alert') {
    return {
      ...base,
      alertTitle: input.subject || 'Security alert',
    };
  }
  if (input.type === 'delivery_notification') {
    return {
      ...base,
      orderNumber: input.subject || 'Order update',
      orderStatus: 'update',
      paymentStatus: 'update',
      total: '',
    };
  }
  if (input.type === 'account_notification') {
    return {
      ...base,
      founderName: input.customerName,
    };
  }
  return base;
}

function sentFailureReason(description: string | null | undefined): string {
  const generic =
    'Sent did not expose a deeper provider reason. Check Meta payment method, WhatsApp Business verification, sender phone health, whether the recipient can receive WhatsApp Business messages, and whether the approved template variables match the API payload.';
  if (!description) return generic;
  if (
    description.includes('Message updated to FAILED') ||
    description.includes('Message updated to QUEUED')
  ) {
    return generic;
  }
  return description;
}

function customerName(customer: Awaited<ReturnType<typeof getCustomer>>): string {
  if (!customer) return '';
  return [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
}
