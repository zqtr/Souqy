import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { recordAudit } from '@/lib/audit';
import { recordEvent } from '@/lib/analytics';
import {
  createOrderRow,
  getOrderById,
  listOrdersForStorefront,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type OrderAddress,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from '@/lib/checkout-orders';
import { getPlan } from '@/lib/billing';
import { orderFeeSnapshot } from '@/lib/planEnforcement';
import { recordPlatformFeeForPaidOrder } from '@/lib/platformFees';
import {
  mobileError,
  mobileJson,
  mobileOptions,
  requireMobileStoreAccess,
  searchParam,
} from '@/lib/mobile/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(): Response {
  return mobileOptions();
}

const PAGE_SIZE = 50;

const AddressSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  area: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().min(1).max(120),
  country: z.string().trim().min(1).max(120),
  zip: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

const CreateSchema = z.object({
  store: z.string().trim().min(1).max(64),
  customer: z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(3).max(40),
    email: z.string().trim().email().max(180).optional().nullable(),
  }),
  address: AddressSchema.optional().nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS as unknown as [PaymentMethod, ...PaymentMethod[]]).default('cod'),
  paymentStatus: z.enum(PAYMENT_STATUSES as unknown as [PaymentStatus, ...PaymentStatus[]]).default('unpaid'),
  orderStatus: z.enum(ORDER_STATUSES as unknown as [OrderStatus, ...OrderStatus[]]).default('pending'),
  currency: z.string().trim().min(1).max(8).default('QAR'),
  shippingQar: z.number().int().nonnegative().max(999_999).default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(z.object({
    productId: z.string().uuid().optional().nullable(),
    title: z.string().trim().min(1).max(280),
    priceQar: z.number().int().nonnegative().max(99_999_999),
    quantity: z.number().int().positive().max(999),
  })).min(1).max(40),
});

export async function GET(req: Request): Promise<Response> {
  const slug = searchParam(req, 'store');
  const gate = await requireMobileStoreAccess(slug, 'orders.manage');
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const status = parseOne(
    url.searchParams.get('status'),
    ORDER_STATUSES,
  ) as OrderStatus | undefined;
  const paymentStatus = parseOne(
    url.searchParams.get('paymentStatus'),
    PAYMENT_STATUSES,
  ) as PaymentStatus | undefined;
  const page = Math.max(0, Number(url.searchParams.get('page') ?? 0) | 0);

  const data = await listOrdersForStorefront(gate.access.storefront.slug, {
    status,
    paymentStatus,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  return mobileJson({ ...data, page, pageSize: PAGE_SIZE });
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return mobileError(400, 'invalid_order', parsed.error.issues[0]?.message ?? 'Invalid order');
  }
  const gate = await requireMobileStoreAccess(parsed.data.store, 'orders.manage');
  if (!gate.ok) return gate.response;

  const data = parsed.data;
  const subtotalQar = data.items.reduce(
    (sum, item) => sum + item.priceQar * item.quantity,
    0,
  );
  const totalQar = subtotalQar + data.shippingQar;
  const ownerPlan = await getPlan(gate.access.storefront.clerkUserId);
  const feeSnapshot = orderFeeSnapshot(ownerPlan, totalQar, data.paymentMethod, {
    platformSkipCash: false,
  });

  const order = await createOrderRow({
    slug: gate.access.storefront.slug,
    customer: {
      name: data.customer.name,
      phone: data.customer.phone,
      email: data.customer.email ?? null,
    },
    address: data.address ? (data.address as OrderAddress) : null,
    paymentMethod: data.paymentMethod,
    currency: data.currency,
    subtotalQar,
    shippingQar: data.shippingQar,
    totalQar,
    ...feeSnapshot,
    acceptedPolicies: [],
    notes: data.notes ?? null,
    metadata: { source: 'mobile' },
    items: data.items.map((item) => ({
      productId: item.productId ?? null,
      titleSnapshot: item.title,
      priceQarSnapshot: item.priceQar,
      quantity: item.quantity,
    })),
  });

  if (data.orderStatus !== 'pending') {
    await db()`
      update checkout_orders
      set order_status = ${data.orderStatus}, payment_status = ${data.paymentStatus}, updated_at = now()
      where id = ${order.id}
    `;
  } else if (data.paymentStatus !== 'unpaid') {
    await db()`
      update checkout_orders
      set payment_status = ${data.paymentStatus}, updated_at = now()
      where id = ${order.id}
    `;
  }
  if (data.paymentStatus === 'marked_paid') {
    const updated = await getOrderById(order.id, gate.access.storefront.slug);
    if (updated) await recordPlatformFeeForPaidOrder(updated);
  }

  await recordAudit({
    storefrontSlug: gate.access.storefront.slug,
    clerkUserId: gate.user.userId,
    action: 'storefront.order.mobile_create',
    targetId: order.id,
    summary: `Created mobile order (${data.currency} ${totalQar})`,
    meta: { orderId: order.id, totalQar, itemCount: data.items.length },
  });
  await recordEvent({
    storefrontSlug: gate.access.storefront.slug,
    kind: 'order_placed',
    meta: { orderId: order.id, total: totalQar, source: 'mobile' },
  });
  revalidatePath('/account/orders');

  return mobileJson({ order: { ...order, orderStatus: data.orderStatus, paymentStatus: data.paymentStatus } }, { status: 201 });
}

function parseOne<T extends readonly string[]>(
  raw: string | null,
  allowed: T,
): T[number] | undefined {
  if (!raw) return undefined;
  return allowed.includes(raw) ? raw : undefined;
}
