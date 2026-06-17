'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import * as Sentry from '@sentry/nextjs';

import { db } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit';
import { getStorefront } from '@/lib/brief';
import { assertStorefrontOwner } from '@/lib/products';
import { bumpCustomerOrder, upsertCustomer } from '@/lib/customers';
import {
  getStorefrontCheckoutSettings,
  POLICY_KEYS,
  type PolicyKey,
} from '@/lib/storefrontSettings';
import { getShippingSettings, getTaxProfile } from '@/lib/adminSettings';
import {
  countCheckoutOrdersForUserMonth,
  createOrderRow,
  getOrderById,
  markOnlinePaymentSucceeded,
  setOrderStatus as setOrderStatusRow,
  setOrderPaymentStatus as setOrderPaymentStatusRow,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  type OrderAddress,
  type OrderStatus,
  type PaymentMethod,
} from '@/lib/checkout-orders';
import { getPlan } from '@/lib/billing';
import { checkoutOrderFeeSnapshot, monthlyOrderCapFailure } from '@/lib/planEnforcement';
import {
  claimDiscountUse,
  evaluateCheckoutDiscount,
  getDiscountByCode,
  normalizeDiscountCode,
  releaseDiscountUse,
  type CheckoutDiscountLine,
  type Discount,
} from '@/lib/discounts';
import {
  sendNewOrderToOwner,
  sendOrderConfirmationToBuyer,
  type PaymentInstructionBlock,
} from '@/lib/email/checkout-emails';
import { notifyMobileNewOrder } from '@/lib/mobile/push';
import { sendWhatsAppOrderConfirmation } from '@/lib/apps/whatsapp';
import {
  sendSentDeliveryNotification,
  sendSentPaymentStatusNotification,
} from '@/lib/sent';
import { pushOrderCreatedNotification } from '@/lib/notifications';
import { createSkipCashPayment, hasSkipCash, newSkipCashTransactionId } from '@/lib/skipcash';
import { getStorefrontSadadCredentials } from '@/lib/storefrontSadad';
import { recordPlatformFeeForPaidOrder } from '@/lib/platformFees';
import {
  DEFAULT_PRODUCT_HEIGHT_OPTIONS,
  isAllowedHeightOption,
  isAllowedProductSizeOption,
  normalizeCustomInputValue,
  normalizeCustomSizeValue,
  normalizeHeightInputLabel,
  normalizeHeightOptions,
  normalizeSizeOptions,
} from '@/lib/productOptions';

const ItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(99),
  variantLabel: z.string().trim().max(40).optional().nullable(),
  customInputs: z
    .object({
      height: z.string().trim().max(80).optional().nullable(),
      heightLabel: z.string().trim().max(40).optional().nullable(),
    })
    .optional()
    .default({}),
});

const AddressSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  area: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().min(1).max(120),
  country: z.string().trim().min(1).max(120),
  zip: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

const CustomerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(3).max(40),
  email: z
    .string()
    .trim()
    .email()
    .max(180)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

const BuyerConsentsSchema = z.object({
  terms: z.boolean().refine(Boolean, 'Accept the Terms of Service.'),
  privacy: z.boolean().refine(Boolean, 'Accept the Privacy Policy.'),
  refund: z.boolean().refine(Boolean, 'Accept the Refund Policy.'),
  cookies: z.boolean().refine(Boolean, 'Accept checkout cookies.'),
  marketing: z.boolean().refine(Boolean, 'Opt in to store messages.'),
});

const ALWAYS_REQUIRED_POLICY_KEYS = ['terms', 'privacy', 'refund'] as const satisfies readonly PolicyKey[];

const CreateOrderSchema = z.object({
  slug: z.string().trim().min(1).max(64),
  items: z.array(ItemSchema).min(1).max(40),
  customer: CustomerSchema,
  address: AddressSchema,
  paymentMethod: z.enum(PAYMENT_METHODS as unknown as [PaymentMethod, ...PaymentMethod[]]),
  discountCode: z
    .string()
    .trim()
    .max(64)
    .regex(/^[A-Za-z0-9_\-]+$/)
    .optional()
    .nullable(),
  acceptedPolicies: z
    .array(z.enum(POLICY_KEYS as unknown as [PolicyKey, ...PolicyKey[]]))
    .max(POLICY_KEYS.length),
  consents: BuyerConsentsSchema,
  notes: z.string().trim().max(2000).optional(),
});

export type CreateOrderInput = z.input<typeof CreateOrderSchema>;
export type CreateOrderResult =
  | { status: 'success'; orderId: string; redirectUrl?: string }
  | { status: 'error'; message: string; field?: string };

const PreviewDiscountSchema = z.object({
  slug: z.string().trim().min(1).max(64),
  code: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_\-]+$/),
  items: z.array(ItemSchema.pick({ productId: true, quantity: true })).min(1).max(40),
});

export type PreviewCheckoutDiscountResult =
  | {
      status: 'success';
      code: string;
      title: string | null;
      subtotalDiscountQar: number;
      shippingDiscountQar: number;
      totalDiscountQar: number;
    }
  | { status: 'error'; message: string; field?: string };

export async function previewCheckoutDiscount(
  input: z.input<typeof PreviewDiscountSchema>,
): Promise<PreviewCheckoutDiscountResult> {
  const parsed = PreviewDiscountSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      status: 'error',
      message: issue?.message ?? 'Invalid promo code.',
      field: issue?.path.join('.'),
    };
  }

  const data = parsed.data;
  const settings = await getStorefrontCheckoutSettings(data.slug);
  const discount = await getDiscountByCode(data.slug, data.code);
  if (!discount) {
    return { status: 'error', message: 'Enter a valid promo code.', field: 'discountCode' };
  }

  const { subtotalQar, lines } = await buildCheckoutDiscountLines(data.slug, data.items);
  const evaluation = evaluateCheckoutDiscount({
    discount,
    subtotalQar,
    shippingQar: settings.shippingFlatQar ?? 0,
    lines,
  });
  if (evaluation.status === 'error') {
    return { status: 'error', message: evaluation.message, field: 'discountCode' };
  }

  return {
    status: 'success',
    code: evaluation.discount.code,
    title: evaluation.discount.title,
    subtotalDiscountQar: evaluation.subtotalDiscountQar,
    shippingDiscountQar: evaluation.shippingDiscountQar,
    totalDiscountQar: evaluation.totalDiscountQar,
  };
}

/**
 * Public checkout — runs unauthenticated (the buyer is anonymous).
 *
 * The contract:
 *
 *  1. zod-validate input.
 *  2. Rate-limit by IP (`checkout:create:<ip>`).
 *  3. Resolve the storefront + checkout settings; reject if missing /
 *     expired / payment method / policies are inconsistent with config.
 *  4. Recompute money server-side from `products.price_qar` — never
 *     trust client-supplied prices.
 *  5. Insert order + items via `createOrderRow`.
 *  6. Fire-and-forget owner + buyer email; mailer failures do NOT roll
 *     back the order — they're reported to Sentry.
 *  7. Audit (no PII), revalidate `/account/orders`.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const parsed = CreateOrderSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      status: 'error',
      message: issue?.message ?? 'Invalid order',
      field: issue?.path.join('.'),
    };
  }
  const data = parsed.data;

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? 'unknown';
  if (!rateLimit(`checkout:create:${ip}`, 6, 60_000).ok) {
    return { status: 'error', message: 'Too many attempts. Try again in a minute.' };
  }

  const storefront = await getStorefront(data.slug);
  if (!storefront) {
    return { status: 'error', message: 'Storefront not available.' };
  }

  const settings = await getStorefrontCheckoutSettings(data.slug);
  const ownerPlan = await getPlan(storefront.clerkUserId);
  const monthlyOrders = await countCheckoutOrdersForUserMonth(storefront.clerkUserId);
  const orderCapError = monthlyOrderCapFailure(ownerPlan, monthlyOrders);
  if (orderCapError) {
    return orderCapError;
  }

  if (!settings.paymentMethods.includes(data.paymentMethod)) {
    return {
      status: 'error',
      message: 'This payment method is not accepted.',
      field: 'paymentMethod',
    };
  }
  for (const required of settings.requiredPolicies) {
    if (!data.acceptedPolicies.includes(required)) {
      return {
        status: 'error',
        message: 'Please accept all required store policies.',
        field: 'acceptedPolicies',
      };
    }
  }
  for (const required of ALWAYS_REQUIRED_POLICY_KEYS) {
    if (!data.acceptedPolicies.includes(required) || data.consents[required] !== true) {
      return {
        status: 'error',
        message: 'Please accept the Terms, Privacy Policy, and Refund Policy.',
        field: 'acceptedPolicies',
      };
    }
  }
  if (!data.consents.cookies || !data.consents.marketing) {
    return {
      status: 'error',
      message: 'Please accept checkout cookies and opt in to store messages.',
      field: 'acceptedPolicies',
    };
  }
  if (data.paymentMethod === 'bank_transfer' && !settings.bankDetails) {
    return {
      status: 'error',
      message: 'Bank transfer is not configured for this store.',
      field: 'paymentMethod',
    };
  }
  if (data.paymentMethod === 'pay_link' && !settings.payLink) {
    return {
      status: 'error',
      message: 'Online payment link is not configured for this store.',
      field: 'paymentMethod',
    };
  }
  if (data.paymentMethod === 'skipcash' && !settings.skipCash?.enabled) {
    return {
      status: 'error',
      message: 'SkipCash is not enabled for this store.',
      field: 'paymentMethod',
    };
  }
  if (data.paymentMethod === 'skipcash' && !hasSkipCash()) {
    return {
      status: 'error',
      message: 'Online checkout is not configured yet.',
      field: 'paymentMethod',
    };
  }
  if (data.paymentMethod === 'sadad' && !settings.sadad?.enabled) {
    return {
      status: 'error',
      message: 'SADAD is not available until merchant credentials are saved.',
      field: 'paymentMethod',
    };
  }

  const productIds = data.items.map((it) => it.productId);
  type ProductRow = {
    id: string;
    title: string;
    price_qar: string | null;
    pricing_mode: 'one_time' | 'monthly_payment';
    monthly_price_qar: string | null;
    category_ids?: string[] | null;
    size_options?: unknown;
    allow_custom_size?: boolean | null;
    requires_height_input?: boolean | null;
    height_input_label?: string | null;
    height_options?: unknown;
    status: 'active' | 'draft' | 'sold_out';
  };
  const productRows = (await db()`
    select
      id, title, price_qar, pricing_mode, monthly_price_qar, size_options,
      allow_custom_size, requires_height_input, height_input_label, height_options, status,
      (
        select coalesce(array_agg(pc.category_id::text), '{}'::text[])
        from product_categories pc
        where pc.product_id = products.id
      ) as category_ids
    from products
    where storefront_slug = ${data.slug}
      and id = any(${productIds as unknown as string}::uuid[])
  `) as unknown as ProductRow[];
  const byId = new Map(productRows.map((p) => [p.id, p]));

  for (const it of data.items) {
    const p = byId.get(it.productId);
    if (!p) {
      return {
        status: 'error',
        message: 'One of the items in your cart is no longer available.',
        field: 'items',
      };
    }
    if (p.status !== 'active') {
      return {
        status: 'error',
        message: `"${p.title}" is no longer available.`,
        field: 'items',
      };
    }
    const sizeOptions = normalizeSizeOptions(p.size_options);
    if (!isAllowedProductSizeOption(sizeOptions, it.variantLabel, p.allow_custom_size === true)) {
      return {
        status: 'error',
        message:
          sizeOptions.length > 0
            ? p.allow_custom_size === true
              ? `Choose or enter a size for "${p.title}".`
              : `Choose a size for "${p.title}".`
            : `"${p.title}" does not use size options.`,
        field: 'items',
      };
    }
    const normalizedHeightOptions = normalizeHeightOptions(p.height_options);
    const heightOptions =
      p.requires_height_input === true && normalizedHeightOptions.length === 0
        ? DEFAULT_PRODUCT_HEIGHT_OPTIONS
        : normalizedHeightOptions;
    if (
      p.requires_height_input === true &&
      !isAllowedHeightOption(heightOptions, it.customInputs.height)
    ) {
      const label = normalizeHeightInputLabel(p.height_input_label) ?? 'height';
      return {
        status: 'error',
        message: `Choose ${label} for "${p.title}".`,
        field: 'items',
      };
    }
    const hasPrice =
      p.pricing_mode === 'monthly_payment' ? p.monthly_price_qar !== null : p.price_qar !== null;
    if (!hasPrice) {
      return {
        status: 'error',
        message: `"${p.title}" has no price set.`,
        field: 'items',
      };
    }
  }

  let subtotalQar = 0;
  let hasMonthlyPaymentItem = false;
  const discountLines: CheckoutDiscountLine[] = [];
  const itemRows = data.items.map((it) => {
    const product = byId.get(it.productId);
    if (!product) {
      throw new Error('product missing after validation');
    }
    const monthly = product.pricing_mode === 'monthly_payment';
    hasMonthlyPaymentItem ||= monthly;
    const rawUnit = monthly ? product.monthly_price_qar : product.price_qar;
    if (rawUnit === null) throw new Error('product missing price after validation');
    const unit = Math.round(Number(rawUnit));
    const lineTotal = unit * it.quantity;
    subtotalQar += lineTotal;
    discountLines.push({
      productId: product.id,
      lineTotalQar: lineTotal,
      categoryIds: product.category_ids ?? [],
    });
    const customInputs: Record<string, string> =
      product.requires_height_input === true
        ? {
            height: normalizeCustomInputValue(it.customInputs.height) ?? '',
            heightLabel: normalizeHeightInputLabel(product.height_input_label) ?? 'Height',
          }
        : {};
    return {
      productId: product.id,
      titleSnapshot: product.title,
      variantLabel:
        normalizeSizeOptions(product.size_options).length > 0 || product.allow_custom_size === true
          ? normalizeCustomSizeValue(it.variantLabel)
          : null,
      customInputs,
      priceQarSnapshot: unit,
      quantity: it.quantity,
    };
  });

  const { shippingQar: baseShippingQar } = await calculateCheckoutTotals({
    slug: data.slug,
    subtotalQar,
    fallbackShippingQar: settings.shippingFlatQar ?? 0,
    address: data.address,
  });

  if (settings.minOrderQar !== null && subtotalQar < settings.minOrderQar) {
    return {
      status: 'error',
      message: `Minimum order is ${settings.currency} ${settings.minOrderQar}.`,
      field: 'items',
    };
  }

  if (hasMonthlyPaymentItem && data.paymentMethod !== 'skipcash') {
    return {
      status: 'error',
      message: 'Monthly-payment products must be paid online with SkipCash.',
      field: 'paymentMethod',
    };
  }

  let discount: Discount | null = null;
  let subtotalDiscountQar = 0;
  let shippingDiscountQar = 0;
  let totalDiscountQar = 0;
  let discountClaimed = false;
  const requestedDiscountCode = data.discountCode ? normalizeDiscountCode(data.discountCode) : null;
  if (requestedDiscountCode) {
    discount = await getDiscountByCode(data.slug, requestedDiscountCode);
    if (!discount) {
      return { status: 'error', message: 'Enter a valid promo code.', field: 'discountCode' };
    }
    const evaluation = evaluateCheckoutDiscount({
      discount,
      subtotalQar,
      shippingQar: baseShippingQar,
      lines: discountLines,
    });
    if (evaluation.status === 'error') {
      return { status: 'error', message: evaluation.message, field: 'discountCode' };
    }
    if (
      discount.perCustomerLimit !== null &&
      (await countCustomerDiscountUses({
        slug: data.slug,
        discountId: discount.id,
        phone: data.customer.phone,
        email: data.customer.email ?? null,
      })) >= discount.perCustomerLimit
    ) {
      return {
        status: 'error',
        message: 'This code has already been used by this customer.',
        field: 'discountCode',
      };
    }
    discountClaimed = await claimDiscountUse(data.slug, discount.id);
    if (!discountClaimed) {
      return {
        status: 'error',
        message: 'This code has reached its usage limit.',
        field: 'discountCode',
      };
    }
    subtotalDiscountQar = evaluation.subtotalDiscountQar;
    shippingDiscountQar = evaluation.shippingDiscountQar;
    totalDiscountQar = evaluation.totalDiscountQar;
  }

  const discountedSubtotalQar = Math.max(subtotalQar - subtotalDiscountQar, 0);
  const discountedShippingQar = Math.max(baseShippingQar - shippingDiscountQar, 0);
  const { shippingQar, taxQar, totalQar: feeBaseQar } = await calculateCheckoutTotals({
    slug: data.slug,
    subtotalQar: discountedSubtotalQar,
    fallbackShippingQar: discountedShippingQar,
    overrideShippingQar: discountedShippingQar,
    address: data.address,
  });

  const feeSnapshot = checkoutOrderFeeSnapshot(ownerPlan, feeBaseQar, data.paymentMethod);
  const { buyerTotalQar: totalQar, feeBaseQar: feeBaseSnapshotQar, ...orderFeeFields } = feeSnapshot;

  const skipCashTransactionId =
    data.paymentMethod === 'skipcash' ? newSkipCashTransactionId() : null;
  const consentMetadata = {
    buyerConsents: {
      terms: data.consents.terms,
      privacy: data.consents.privacy,
      refund: data.consents.refund,
      cookies: data.consents.cookies,
      marketing: data.consents.marketing,
      acceptedAt: new Date().toISOString(),
      source: 'checkout',
    },
  };
  const discountMetadata =
    discount && totalDiscountQar > 0
      ? {
          discount: {
            id: discount.id,
            code: discount.code,
            title: discount.title,
            valueType: discount.valueType,
            subtotalDiscountQar,
            shippingDiscountQar,
            totalDiscountQar,
            rawSubtotalQar: subtotalQar,
            rawShippingQar: baseShippingQar,
          },
        }
      : {};
  let order;
  try {
    order = await createOrderRow({
      slug: data.slug,
      customer: {
        name: data.customer.name,
        phone: data.customer.phone,
        email: data.customer.email ?? null,
      },
      address: data.address as OrderAddress,
      paymentMethod: data.paymentMethod,
      currency: settings.currency,
      subtotalQar: discountedSubtotalQar,
      shippingQar,
      taxQar,
      totalQar,
      ...orderFeeFields,
      acceptedPolicies: data.acceptedPolicies,
      notes: data.notes ?? null,
      metadata: skipCashTransactionId
          ? {
            paymentProvider: 'skipcash',
            skipcashTransactionId: skipCashTransactionId,
            monthlyPaymentOrder: hasMonthlyPaymentItem,
            feeBaseQar: feeBaseSnapshotQar,
            platformFeeAddedToCheckout: orderFeeFields.platformFeeQar > 0,
            ...consentMetadata,
            ...discountMetadata,
          }
        : data.paymentMethod === 'sadad'
          ? {
              paymentProvider: 'sadad',
              sadadOrderId: null,
              feeBaseQar: feeBaseSnapshotQar,
              platformFeeAddedToCheckout: orderFeeFields.platformFeeQar > 0,
              ...consentMetadata,
              ...discountMetadata,
            }
          : hasMonthlyPaymentItem
            ? {
                monthlyPaymentOrder: true,
                feeBaseQar: feeBaseSnapshotQar,
                platformFeeAddedToCheckout: orderFeeFields.platformFeeQar > 0,
                ...consentMetadata,
                ...discountMetadata,
              }
            : {
                feeBaseQar: feeBaseSnapshotQar,
                platformFeeAddedToCheckout: orderFeeFields.platformFeeQar > 0,
                ...consentMetadata,
                ...discountMetadata,
              },
      items: itemRows,
    });
  } catch (err) {
    if (discountClaimed && discount) {
      await releaseDiscountUse(data.slug, discount.id);
    }
    Sentry.captureException(err, {
      tags: { area: 'checkout', slug: data.slug },
    });
    return { status: 'error', message: 'Could not place order. Please try again.' };
  }

  await syncCheckoutCustomer({
    slug: data.slug,
    customerName: data.customer.name,
    phone: data.customer.phone,
    email: data.customer.email ?? null,
    marketingConsent: data.consents.marketing,
    cookieConsent: data.consents.cookies,
    orderId: order.id,
    totalQar,
  });

  let redirectUrl: string | undefined;
  if (data.paymentMethod === 'skipcash') {
    try {
      if (!skipCashTransactionId) {
        return {
          status: 'error',
          message:
            'SkipCash could not start the payment. Please choose another method or try again.',
          field: 'paymentMethod',
        };
      }
      const [firstName, ...lastParts] = data.customer.name.split(/\s+/);
      const payment = await createSkipCashPayment({
        amountQar: totalQar,
        firstName: firstName || data.customer.name,
        lastName: lastParts.join(' ') || 'Customer',
        email: data.customer.email ?? `${order.id}@souqna.qa`,
        phone: data.customer.phone,
        transactionId: skipCashTransactionId,
        custom1: order.id,
      });
      redirectUrl = payment.payUrl;
    } catch (err) {
      Sentry.captureException(err, {
        tags: { area: 'checkout-skipcash', slug: data.slug },
      });
      return {
        status: 'error',
        message: 'SkipCash could not start the payment. Please choose another method or try again.',
        field: 'paymentMethod',
      };
    }
  }
  if (data.paymentMethod === 'sadad') {
    const credentials = await getStorefrontSadadCredentials(data.slug);
    if (!credentials) {
      return {
        status: 'error',
        message: 'SADAD credentials are not configured for this store.',
        field: 'paymentMethod',
      };
    }
    redirectUrl = `/api/checkout/sadad-redirect?slug=${encodeURIComponent(data.slug)}&orderId=${encodeURIComponent(order.id)}`;
  }

  const instructions = buildPaymentInstructions(data.paymentMethod, settings);

  if (data.paymentMethod !== 'skipcash' && data.paymentMethod !== 'sadad') {
    // Fire-and-forget mailer. Order is already persisted — failures here
    // surface in Sentry but never roll back the buyer's checkout.
    void (async () => {
      try {
        const ownerEmail = storefront.contactEmail;
        if (ownerEmail) {
          const owner = await sendNewOrderToOwner({
            ownerEmail,
            slug: data.slug,
            order,
            paymentInstructions: instructions,
          });
          if (!owner.ok) {
            Sentry.captureMessage('checkout owner email failed', {
              level: 'warning',
              tags: { area: 'checkout', slug: data.slug, provider: owner.provider },
            });
          }
        }
        await notifyMobileNewOrder({
          storefrontSlug: data.slug,
          businessName: storefront.businessName,
          order,
        });
        await pushOrderCreatedNotification({
          userId: storefront.clerkUserId,
          founderName: storefront.founderName,
          businessName: storefront.businessName,
          slug: data.slug,
          order,
        });
        const whatsapp = await sendWhatsAppOrderConfirmation({
          storefrontSlug: data.slug,
          businessName: storefront.businessName,
          order,
        });
        if (whatsapp.status === 'error') {
          Sentry.captureMessage('checkout WhatsApp order confirmation failed', {
            level: 'warning',
            tags: { area: 'checkout', slug: data.slug, channel: 'whatsapp' },
            extra: { reason: whatsapp.reason },
          });
        }
        const buyerEmail = data.customer.email ?? null;
        if (buyerEmail) {
          const buyer = await sendOrderConfirmationToBuyer({
            buyerEmail,
            slug: data.slug,
            order,
            paymentInstructions: instructions,
          });
          if (!buyer.ok) {
            Sentry.captureMessage('checkout buyer email failed', {
              level: 'warning',
              tags: { area: 'checkout', slug: data.slug, provider: buyer.provider },
            });
          }
        }
      } catch (err) {
        Sentry.captureException(err, {
          tags: { area: 'checkout-mailer', slug: data.slug },
        });
      }
    })();
  }

  await recordAudit({
    storefrontSlug: data.slug,
    clerkUserId: storefront.clerkUserId,
    action: 'storefront.order.create',
    targetId: order.id,
    summary: `New order via ${labelMethod(data.paymentMethod)} (${settings.currency} ${totalQar})`,
    meta: {
      orderId: order.id,
      paymentMethod: data.paymentMethod,
      totalQar,
      itemCount: itemRows.length,
    },
  });

  revalidatePath('/account/orders');
  return { status: 'success', orderId: order.id, redirectUrl };
}

async function syncCheckoutCustomer(input: {
  slug: string;
  customerName: string;
  phone: string;
  email: string | null;
  marketingConsent: boolean;
  cookieConsent: boolean;
  orderId: string;
  totalQar: number;
}) {
  try {
    const { firstName, lastName } = splitCustomerName(input.customerName);
    const customer = await upsertCustomer(input.slug, {
      email: input.email,
      phone: input.phone,
      firstName,
      lastName,
      tags: ['checkout', 'order', input.marketingConsent ? 'message-opt-in' : 'order-updates'],
      marketingConsent: input.marketingConsent,
      meta: {
        source: 'checkout',
        lastCheckoutOrderId: input.orderId,
        cookieConsent: input.cookieConsent,
        messageOptIn: input.marketingConsent,
      },
    });
    await bumpCustomerOrder(input.slug, customer.id, input.totalQar);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: 'checkout-customer-sync', slug: input.slug },
      extra: { orderId: input.orderId },
    });
  }
}

function splitCustomerName(name: string): { firstName: string | null; lastName: string | null } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  const [first, ...rest] = parts;
  return {
    firstName: first ?? null,
    lastName: rest.length > 0 ? rest.join(' ') : null,
  };
}

const OwnerActionSchema = z.object({
  slug: z.string().trim().min(1).max(64),
  orderId: z.string().uuid(),
});

const StatusSchema = OwnerActionSchema.extend({
  status: z.enum(ORDER_STATUSES as unknown as [OrderStatus, ...OrderStatus[]]),
});

export type OwnerOrderResult = { status: 'success' } | { status: 'error'; message: string };

async function gateOwner(
  slug: string,
): Promise<{ ok: true; userId: string } | { ok: false; result: OwnerOrderResult }> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, result: { status: 'error', message: 'Sign in to manage orders.' } };
  }
  const owner = await assertStorefrontOwner(slug, userId);
  if (!owner) {
    return { ok: false, result: { status: 'error', message: 'Forbidden' } };
  }
  return { ok: true, userId };
}

export async function updateOrderStatus(
  input: z.input<typeof StatusSchema>,
): Promise<OwnerOrderResult> {
  const parsed = StatusSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Invalid request' };
  }
  const data = parsed.data;
  const gate = await gateOwner(data.slug);
  if (!gate.ok) return gate.result;

  const before = await getOrderById(data.orderId, data.slug);
  const updated = await setOrderStatusRow(data.orderId, data.slug, data.status);
  if (!updated) return { status: 'error', message: 'Order not found' };

  await recordAudit({
    storefrontSlug: data.slug,
    clerkUserId: gate.userId,
    action: `storefront.order.status.${data.status}`,
    targetId: data.orderId,
    summary: `Order status → ${data.status}`,
    meta: { orderId: data.orderId, status: data.status },
  });
  if (before?.orderStatus !== data.status && isBuyerFacingStatus(data.status)) {
    void sendBuyerStatusMessage(data.slug, updated, data.status);
  }
  revalidatePath('/account/orders');
  revalidatePath(`/account/orders/${data.orderId}`);
  return { status: 'success' };
}

export async function markOrderPaid(
  input: z.input<typeof OwnerActionSchema>,
): Promise<OwnerOrderResult> {
  const parsed = OwnerActionSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const data = parsed.data;
  const gate = await gateOwner(data.slug);
  if (!gate.ok) return gate.result;

  const order = await getOrderById(data.orderId, data.slug);
  const updated =
    order?.paymentMethod === 'skipcash' || order?.paymentMethod === 'sadad'
      ? await markOnlinePaymentSucceeded(data.orderId, data.slug)
      : await setOrderPaymentStatusRow(data.orderId, data.slug, 'marked_paid');
  if (!updated) return { status: 'error', message: 'Order not found' };
  await recordPlatformFeeForPaidOrder(updated);
  if (order?.paymentStatus !== 'marked_paid') {
    void sendBuyerPaymentMessage(data.slug, updated, 'paid');
  }

  await recordAudit({
    storefrontSlug: data.slug,
    clerkUserId: gate.userId,
    action: 'storefront.order.payment.marked_paid',
    targetId: data.orderId,
    summary: 'Order marked as paid',
    meta: { orderId: data.orderId },
  });
  revalidatePath('/account/orders');
  revalidatePath(`/account/orders/${data.orderId}`);
  return { status: 'success' };
}

function isBuyerFacingStatus(status: OrderStatus): boolean {
  return (
    status === 'confirmed' ||
    status === 'preparing' ||
    status === 'shipped' ||
    status === 'delivered' ||
    status === 'cancelled'
  );
}

async function sendBuyerStatusMessage(
  slug: string,
  order: Awaited<ReturnType<typeof getOrderById>>,
  status: OrderStatus,
) {
  if (!order) return;
  try {
    const storefront = await getStorefront(slug);
    if (!storefront) return;
    const result = await sendSentDeliveryNotification({
      phone: order.customerPhone,
      storeName: storefront.businessName,
      order,
      message: statusMessage(status),
      idempotencyKey: `order-status-${status}-${order.id}`,
    });
    if (result.status === 'error') {
      Sentry.captureMessage('order status Sent notification failed', {
        level: 'warning',
        tags: { area: 'checkout-status', slug, status },
        extra: { reason: result.reason },
      });
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'checkout-status-message', slug, status } });
  }
}

async function sendBuyerPaymentMessage(
  slug: string,
  order: Awaited<ReturnType<typeof getOrderById>>,
  status: 'paid' | 'failed',
) {
  if (!order) return;
  try {
    const storefront = await getStorefront(slug);
    if (!storefront) return;
    const result = await sendSentPaymentStatusNotification({
      storeName: storefront.businessName,
      order,
      status,
      idempotencyKey: `payment-${status}-${order.id}`,
    });
    if (result.status === 'error') {
      Sentry.captureMessage('order payment Sent notification failed', {
        level: 'warning',
        tags: { area: 'checkout-payment', slug, status },
        extra: { reason: result.reason },
      });
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'checkout-payment-message', slug, status } });
  }
}

function statusMessage(status: OrderStatus): string {
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

export async function markOrderRefunded(
  input: z.input<typeof OwnerActionSchema>,
): Promise<OwnerOrderResult> {
  const parsed = OwnerActionSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const data = parsed.data;
  const gate = await gateOwner(data.slug);
  if (!gate.ok) return gate.result;

  const updated = await setOrderPaymentStatusRow(data.orderId, data.slug, 'refunded');
  if (!updated) return { status: 'error', message: 'Order not found' };

  await recordAudit({
    storefrontSlug: data.slug,
    clerkUserId: gate.userId,
    action: 'storefront.order.payment.refunded',
    targetId: data.orderId,
    summary: 'Order refunded',
    meta: { orderId: data.orderId },
  });
  revalidatePath('/account/orders');
  revalidatePath(`/account/orders/${data.orderId}`);
  return { status: 'success' };
}

function labelMethod(method: PaymentMethod): string {
  switch (method) {
    case 'cod':
      return 'cash on delivery';
    case 'bank_transfer':
      return 'bank transfer';
    case 'skipcash':
      return 'SkipCash';
    case 'sadad':
      return 'SADAD';
    case 'pay_link':
      return 'pay link';
  }
}

async function buildCheckoutDiscountLines(
  slug: string,
  items: Array<{ productId: string; quantity: number }>,
): Promise<{ subtotalQar: number; lines: CheckoutDiscountLine[] }> {
  const productIds = items.map((item) => item.productId);
  if (productIds.length === 0) return { subtotalQar: 0, lines: [] };

  const rows = (await db()`
    select
      id,
      price_qar,
      pricing_mode,
      monthly_price_qar,
      (
        select coalesce(array_agg(pc.category_id::text), '{}'::text[])
        from product_categories pc
        where pc.product_id = products.id
      ) as category_ids
    from products
    where storefront_slug = ${slug}
      and status = 'active'
      and id = any(${productIds as unknown as string}::uuid[])
  `) as unknown as Array<{
    id: string;
    price_qar: string | null;
    pricing_mode: 'one_time' | 'monthly_payment';
    monthly_price_qar: string | null;
    category_ids: string[] | null;
  }>;

  const byId = new Map(rows.map((row) => [row.id, row]));
  let subtotalQar = 0;
  const lines: CheckoutDiscountLine[] = [];
  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product) continue;
    const rawUnit =
      product.pricing_mode === 'monthly_payment' ? product.monthly_price_qar : product.price_qar;
    if (rawUnit === null) continue;
    const lineTotalQar = Math.max(0, Math.round(Number(rawUnit))) * item.quantity;
    subtotalQar += lineTotalQar;
    lines.push({
      productId: product.id,
      lineTotalQar,
      categoryIds: product.category_ids ?? [],
    });
  }

  return { subtotalQar, lines };
}

async function countCustomerDiscountUses({
  slug,
  discountId,
  phone,
  email,
}: {
  slug: string;
  discountId: number;
  phone: string;
  email: string | null;
}): Promise<number> {
  const rows = (await db()`
    select count(*)::int as n
    from checkout_orders
    where storefront_slug = ${slug}
      and order_status <> 'cancelled'
      and metadata->'discount'->>'id' = ${String(discountId)}
      and (
        customer_phone = ${phone}
        or (${email}::text is not null and customer_email = ${email})
      )
  `) as unknown as { n: number }[];
  return Number(rows[0]?.n ?? 0);
}

async function calculateCheckoutTotals({
  slug,
  subtotalQar,
  fallbackShippingQar,
  overrideShippingQar,
  address,
}: {
  slug: string;
  subtotalQar: number;
  fallbackShippingQar: number;
  overrideShippingQar?: number;
  address: z.infer<typeof AddressSchema>;
}): Promise<{ shippingQar: number; taxQar: number; totalQar: number }> {
  let shippingQar = overrideShippingQar ?? fallbackShippingQar;

  if (overrideShippingQar === undefined) {
    try {
      const shipping = await getShippingSettings(slug);
      if (shipping.profile?.enabled) {
        const country = normalizeCountryCode(address.country);
        const city = address.city.trim().toLowerCase();
        const matchingRate =
          shipping.rates.find(
            (rate) =>
              rate.enabled &&
              rate.countryCode.toUpperCase() === country &&
              (!rate.city || rate.city.trim().toLowerCase() === city) &&
              (rate.minSubtotalQar === null || subtotalQar >= rate.minSubtotalQar) &&
              (rate.maxSubtotalQar === null || subtotalQar <= rate.maxSubtotalQar),
          ) ??
          shipping.rates.find(
            (rate) =>
              rate.enabled &&
              rate.countryCode.toUpperCase() === country &&
              (rate.minSubtotalQar === null || subtotalQar >= rate.minSubtotalQar) &&
              (rate.maxSubtotalQar === null || subtotalQar <= rate.maxSubtotalQar),
          ) ??
          shipping.rates.find((rate) => rate.enabled);

        if (matchingRate) {
          shippingQar = matchingRate.amountQar;
        }
        if (
          shipping.profile.freeShippingMinQar !== null &&
          subtotalQar >= shipping.profile.freeShippingMinQar
        ) {
          shippingQar = 0;
        }
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { area: 'checkout-shipping', slug } });
    }
  }

  let taxQar = 0;
  let totalQar = subtotalQar + shippingQar;
  try {
    const tax = await getTaxProfile(slug);
    if (tax?.enabled && tax.rateBps > 0) {
      const taxableBase = subtotalQar + (tax.appliesToShipping ? shippingQar : 0);
      taxQar = tax.includedInPrices
        ? Math.round((taxableBase * tax.rateBps) / (10000 + tax.rateBps))
        : Math.round((taxableBase * tax.rateBps) / 10000);
      totalQar = subtotalQar + shippingQar + (tax.includedInPrices ? 0 : taxQar);
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'checkout-tax', slug } });
  }

  return { shippingQar, taxQar, totalQar };
}

function normalizeCountryCode(country: string): string {
  const value = country.trim().toUpperCase();
  if (value === 'QATAR') return 'QA';
  if (value === 'SAUDI ARABIA' || value === 'KSA') return 'SA';
  if (value === 'UNITED ARAB EMIRATES' || value === 'UAE') return 'AE';
  if (value === 'KUWAIT') return 'KW';
  if (value === 'BAHRAIN') return 'BH';
  if (value === 'OMAN') return 'OM';
  return value.slice(0, 3);
}

function buildPaymentInstructions(
  method: PaymentMethod,
  settings: Awaited<ReturnType<typeof getStorefrontCheckoutSettings>>,
): PaymentInstructionBlock | null {
  if (method === 'cod') {
    return {
      heading: 'Cash on delivery',
      body: 'Please have the exact amount ready when the courier arrives.',
    };
  }
  if (method === 'bank_transfer' && settings.bankDetails) {
    const b = settings.bankDetails;
    const lines = [
      `Account name: ${b.accountName}`,
      `Bank: ${b.bankName}`,
      `IBAN: ${b.iban}`,
      b.swift ? `SWIFT: ${b.swift}` : '',
      b.notes ? b.notes : '',
    ].filter((line) => line.length > 0);
    return {
      heading: 'Bank transfer details',
      body: lines.join('\n'),
    };
  }
  if (method === 'pay_link' && settings.payLink) {
    return {
      heading: 'Pay online',
      body: `${settings.payLink.label}: ${settings.payLink.url}`,
    };
  }
  if (method === 'skipcash') {
    return {
      heading: 'SkipCash online payment',
      body: 'You will be redirected to SkipCash to complete the payment securely.',
    };
  }
  if (method === 'sadad') {
    return {
      heading: 'SADAD online payment',
      body: 'You will be redirected to SADAD to complete the payment securely.',
    };
  }
  return null;
}
