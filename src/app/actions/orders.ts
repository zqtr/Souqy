'use server';

import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { assertStorefrontOwner } from '@/lib/products';
import {
  getOrder,
  updateOrderStatus,
  type OrderStatus,
  type PaymentStatus,
} from '@/lib/orders';
import {
  createOrderRow,
  type OrderStatus as CheckoutOrderStatus,
  type PaymentStatus as CheckoutPaymentStatus,
} from '@/lib/checkout-orders';
import {
  getCustomer,
  upsertCustomer,
  bumpCustomerOrder,
} from '@/lib/customers';
import { recordAudit } from '@/lib/audit';
import { recordEvent } from '@/lib/analytics';
import { sendWhatsAppAdminOrderConfirmation } from '@/lib/apps/whatsapp';
import { sendSentDeliveryNotification } from '@/lib/sent';
import { getPlan } from '@/lib/billing';
import { orderFeeSnapshot } from '@/lib/planEnforcement';

/**
 * Manual order entry from the dashboard. Maps the form's flat shape to
 * the layered customers + orders + order_items writes:
 *
 *   1. upsert customer by email/phone
 *   2. insert order with items in one round-trip
 *   3. bump the customer's order count + total_spent
 *   4. log the audit entry + the order_placed analytics event
 *
 * Steps run sequentially (no postgres transaction across HTTP calls)
 * but each step is idempotent in the sense that retrying it returns the
 * same row. The customer upsert is the only step that's truly
 * idempotent end-to-end.
 */

const ItemSchema = z.object({
  productId: z.string().trim().max(64).optional().nullable(),
  productTitle: z.string().trim().min(1).max(280),
  variantLabel: z.string().trim().max(120).optional().nullable(),
  unitPrice: z.number().nonnegative().max(99_999_999),
  quantity: z.number().int().positive().max(9999),
});

const CreateSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  customer: z.object({
    firstName: z.string().trim().max(120).optional().nullable(),
    lastName: z.string().trim().max(120).optional().nullable(),
    email: z
      .string()
      .trim()
      .max(180)
      .email()
      .optional()
      .nullable()
      .or(z.literal('').transform(() => null)),
    phone: z.string().trim().max(40).optional().nullable(),
  }),
  items: z.array(ItemSchema).min(1).max(40),
  status: z
    .enum([
      'open',
      'draft',
      'paid',
      'partially_paid',
      'refunded',
      'partially_refunded',
      'cancelled',
      'archived',
    ])
    .default('open'),
  paymentStatus: z
    .enum(['pending', 'authorized', 'paid', 'refunded', 'voided', 'failed'])
    .default('pending'),
  fulfilmentStatus: z
    .enum(['unfulfilled', 'partial', 'fulfilled', 'restocked'])
    .default('unfulfilled'),
  currencyCode: z.string().trim().min(1).max(8).default('QAR'),
  shippingTotal: z.number().nonnegative().optional().default(0),
  discountTotal: z.number().nonnegative().optional().default(0),
  discountCode: z.string().trim().max(64).optional().nullable(),
  taxTotal: z.number().nonnegative().optional().default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export type CreateOrderInput = z.input<typeof CreateSchema>;
export type OrderActionState =
  | { status: 'idle' }
  | { status: 'success'; orderId: string | number; orderNumber: string | number }
  | { status: 'error'; message: string };

const ResendWhatsAppSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  orderId: z.coerce.number().int().positive(),
});

export type ResendWhatsAppState =
  | { status: 'success'; message: string; arMessage: string; messageId: string | null }
  | { status: 'error'; message: string; arMessage: string };

export async function createOrderFromForm(
  input: CreateOrderInput,
): Promise<OrderActionState> {
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid order' };
  }
  const data = parsed.data;
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in to log orders.' };
  const owner = await assertStorefrontOwner(data.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };

  if (
    !data.customer.email &&
    !data.customer.phone &&
    !data.customer.firstName
  ) {
    return {
      status: 'error',
      message: 'Add a customer email, phone, or name before logging the order.',
    };
  }

  try {
    const cust = await upsertCustomer(data.storefrontSlug, {
      email: data.customer.email ?? null,
      phone: data.customer.phone ?? null,
      firstName: data.customer.firstName ?? null,
      lastName: data.customer.lastName ?? null,
      tags: ['order'],
      marketingConsent: false,
    });

    const subtotalQar = roundQar(
      data.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    );
    const discountQar = Math.min(roundQar(data.discountTotal), subtotalQar);
    const shippingQar = roundQar(data.shippingTotal);
    const taxQar = roundQar(data.taxTotal);
    const adjustedSubtotalQar = Math.max(subtotalQar - discountQar, 0);
    const totalQar = Math.max(adjustedSubtotalQar + shippingQar + taxQar, 0);
    const checkoutStatus = manualCheckoutStatuses(data.status, data.paymentStatus);
    const plan = await getPlan(userId);
    const feeSnapshot = orderFeeSnapshot(plan, totalQar, 'cod');
    const customerName = manualCustomerName(data.customer);

    const items = data.items.map((it) => ({
      productId: it.productId ?? null,
      titleSnapshot: it.productTitle,
      variantLabel: it.variantLabel ?? null,
      customInputs: null,
      priceQarSnapshot: roundQar(it.unitPrice),
      quantity: it.quantity,
    }));

    const order = await createOrderRow({
      slug: data.storefrontSlug,
      customer: {
        name: customerName,
        phone: data.customer.phone ?? '',
        email: data.customer.email ?? null,
      },
      address: null,
      paymentMethod: 'cod',
      paymentStatus: checkoutStatus.paymentStatus,
      orderStatus: checkoutStatus.orderStatus,
      currency: data.currencyCode,
      subtotalQar: adjustedSubtotalQar,
      shippingQar,
      taxQar,
      totalQar,
      ...feeSnapshot,
      acceptedPolicies: [],
      notes: data.notes ?? null,
      metadata: {
        source: 'manual_order',
        customerId: cust.id,
        legacyStatus: data.status,
        legacyPaymentStatus: data.paymentStatus,
        legacyFulfilmentStatus: data.fulfilmentStatus,
        discountQar,
        discountCode: data.discountCode ?? null,
        rawSubtotalQar: subtotalQar,
      },
      items,
    });

    if (data.status !== 'draft' && data.status !== 'cancelled') {
      await bumpCustomerOrder(data.storefrontSlug, cust.id, order.totalQar);
    }

    await recordAudit({
      storefrontSlug: data.storefrontSlug,
      clerkUserId: userId,
      action: 'order.create',
      targetId: String(order.id),
      summary: `Logged manual order ${order.id.slice(0, 8).toUpperCase()} (${order.currency} ${order.totalQar})`,
      meta: { orderId: order.id, items: items.length, source: 'manual_order' },
    });
    await recordEvent({
      storefrontSlug: data.storefrontSlug,
      kind: 'order_placed',
      meta: {
        orderId: order.id,
        total: order.totalQar,
        source: 'manual_order',
      },
    });
    if (data.status !== 'draft' && data.status !== 'cancelled' && data.customer.phone) {
      void sendSentDeliveryNotification({
        phone: data.customer.phone,
        storeName: owner.businessName,
        order,
        message: 'Your order was logged by the store. Contact the store if any details need to change.',
        idempotencyKey: `manual-order-${order.id}`,
      }).catch((err) => {
        console.warn('[createOrderFromForm] Sent notification failed', err);
      });
    }
    revalidatePath('/account', 'layout');
    return {
      status: 'success',
      orderId: order.id,
      orderNumber: order.id.slice(0, 8).toUpperCase(),
    };
  } catch (err) {
    console.error('[createOrderFromForm] failed', err);
    return { status: 'error', message: 'Save failed. Try again.' };
  }
}

function roundQar(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function manualCustomerName(customer: z.infer<typeof CreateSchema>['customer']): string {
  const name = [customer.firstName, customer.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return name || customer.email?.trim() || customer.phone?.trim() || 'Manual customer';
}

function manualCheckoutStatuses(
  status: OrderStatus,
  paymentStatus: PaymentStatus,
): { orderStatus: CheckoutOrderStatus; paymentStatus: CheckoutPaymentStatus } {
  const checkoutPaymentStatus: CheckoutPaymentStatus =
    paymentStatus === 'paid'
      ? 'marked_paid'
      : paymentStatus === 'refunded'
        ? 'refunded'
        : paymentStatus === 'failed'
          ? 'payment_failed'
          : 'unpaid';
  const checkoutOrderStatus: CheckoutOrderStatus =
    status === 'cancelled' ||
    status === 'archived' ||
    status === 'refunded' ||
    status === 'partially_refunded'
      ? 'cancelled'
      : status === 'paid' || status === 'partially_paid'
        ? 'confirmed'
        : 'pending';
  return { orderStatus: checkoutOrderStatus, paymentStatus: checkoutPaymentStatus };
}

const StatusUpdateSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  orderId: z.number().int().positive(),
  status: z.enum([
    'open',
    'draft',
    'paid',
    'partially_paid',
    'refunded',
    'partially_refunded',
    'cancelled',
    'archived',
  ]),
});

export async function setOrderStatus(
  input: z.input<typeof StatusUpdateSchema>,
): Promise<OrderActionState> {
  const parsed = StatusUpdateSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in to update orders.' };
  const owner = await assertStorefrontOwner(parsed.data.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  const order = await updateOrderStatus(
    parsed.data.storefrontSlug,
    parsed.data.orderId,
    parsed.data.status as OrderStatus,
  );
  if (!order) return { status: 'error', message: 'Order not found' };
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: userId,
    action: `order.${parsed.data.status}`,
    targetId: String(order.id),
    summary: `Order #${order.orderNumber} → ${parsed.data.status}`,
  });
  revalidatePath('/account', 'layout');
  return { status: 'success', orderId: order.id, orderNumber: order.orderNumber };
}

export async function resendOrderWhatsAppConfirmation(
  storefrontSlug: string,
  orderId: number | string,
): Promise<ResendWhatsAppState> {
  const parsed = ResendWhatsAppSchema.safeParse({ storefrontSlug, orderId });
  if (!parsed.success) {
    const reason = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`)
      .join(', ');
    return {
      status: 'error',
      message: `Could not resend the WhatsApp message: ${reason}.`,
      arMessage: 'تعذر إعادة إرسال رسالة واتساب لأن بيانات الطلب غير مكتملة.',
    };
  }

  const { userId } = await auth();
  if (!userId) {
    return {
      status: 'error',
      message: 'Sign in to resend the WhatsApp message.',
      arMessage: 'سجّل الدخول لإعادة إرسال رسالة واتساب.',
    };
  }

  const owner = await assertStorefrontOwner(parsed.data.storefrontSlug, userId);
  if (!owner) {
    return {
      status: 'error',
      message: 'You do not have access to this order.',
      arMessage: 'لا تملك صلاحية الوصول إلى هذا الطلب.',
    };
  }

  const order = await getOrder(parsed.data.storefrontSlug, parsed.data.orderId);
  if (!order) {
    return {
      status: 'error',
      message: 'Order not found.',
      arMessage: 'لم يتم العثور على الطلب.',
    };
  }
  if (!order.customerId) {
    return {
      status: 'error',
      message: 'This order has no customer attached.',
      arMessage: 'هذا الطلب غير مرتبط بعميل.',
    };
  }

  const customer = await getCustomer(parsed.data.storefrontSlug, order.customerId);
  if (!customer?.phone) {
    return {
      status: 'error',
      message: 'Add a customer phone number before resending.',
      arMessage: 'أضف رقم جوال العميل قبل إعادة الإرسال.',
    };
  }

  const whatsapp = await sendWhatsAppAdminOrderConfirmation({
    storefrontSlug: parsed.data.storefrontSlug,
    businessName: owner.businessName,
    order,
    customer,
  });

  if (whatsapp.status !== 'sent') {
    const reason =
      whatsapp.status === 'skipped'
        ? whatsapp.reason.replace(/_/g, ' ')
        : whatsapp.reason;
    return {
      status: 'error',
      message: `WhatsApp message was not sent: ${reason}.`,
      arMessage: 'لم يتم إرسال رسالة واتساب. راجع إعدادات واتساب ورقم العميل.',
    };
  }

  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: userId,
    action: 'order.whatsapp_resend',
    targetId: String(order.id),
    summary: `Resent WhatsApp confirmation for order #${order.orderNumber}`,
    meta: { messageId: whatsapp.messageId },
  });

  return {
    status: 'success',
    message: `WhatsApp message sent for order #${order.orderNumber}.`,
    arMessage: `تم إرسال رسالة واتساب للطلب #${order.orderNumber}.`,
    messageId: whatsapp.messageId,
  };
}
