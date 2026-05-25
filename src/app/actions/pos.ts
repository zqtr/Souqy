'use server';

import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { assertStorefrontOwner } from '@/lib/products';
import { getRegister, saveRegister, type PosRegister } from '@/lib/pos';
import { createOrder, type OrderItemInput } from '@/lib/orders';
import { recordAudit } from '@/lib/audit';
import { recordEvent } from '@/lib/analytics';

/**
 * POS register lifecycle.
 *
 *   1. `saveOnboarding` — finalises the wizard (location + cash float
 *      + optional PIN), flips `configured = true` so subsequent visits
 *      go straight to the till.
 *   2. `updateRegister` — partial settings update from the in-app
 *      Settings drawer.
 *   3. `chargeCashSale` — closes a cash sale at the counter. Records
 *      the order, audit entry, and analytics event in one shot.
 *
 * All three guard on store ownership via `assertStorefrontOwner` so
 * staff/PIN access can't escalate to other founders' stores.
 */

const OnboardingSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  locationName: z.string().trim().min(1).max(120),
  cashFloat: z.number().nonnegative().max(1_000_000).default(0),
  pin: z
    .string()
    .trim()
    .max(8)
    .regex(/^\d{0,8}$/, 'PIN must be digits only')
    .default(''),
  receiptFooter: z.string().trim().max(280).optional().nullable(),
});

export type PosActionState =
  | { status: 'idle' }
  | { status: 'success'; register?: PosRegister; orderId?: number; orderNumber?: number }
  | { status: 'error'; message: string };

export async function saveOnboarding(
  input: z.input<typeof OnboardingSchema>,
): Promise<PosActionState> {
  const parsed = OnboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid setup' };
  }
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in first.' };
  const owner = await assertStorefrontOwner(parsed.data.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };

  try {
    const register = await saveRegister(parsed.data.storefrontSlug, {
      configured: true,
      locationName: parsed.data.locationName,
      cashFloat: parsed.data.cashFloat,
      pin: parsed.data.pin,
      receiptFooter:
        parsed.data.receiptFooter && parsed.data.receiptFooter.trim().length > 0
          ? parsed.data.receiptFooter
          : 'Shukran. ◈',
    });
    await recordAudit({
      storefrontSlug: parsed.data.storefrontSlug,
      clerkUserId: userId,
      action: 'pos.configure',
      summary: `POS register set up at "${register.locationName}"`,
      meta: { cashFloat: register.cashFloat },
    });
    revalidatePath('/account/pos', 'layout');
    return { status: 'success', register };
  } catch (err) {
    console.error('[pos/saveOnboarding] failed', err);
    return { status: 'error', message: 'Save failed. Try again.' };
  }
}

const ResetSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
});

export async function resetRegister(
  input: z.input<typeof ResetSchema>,
): Promise<PosActionState> {
  const parsed = ResetSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in first.' };
  const owner = await assertStorefrontOwner(parsed.data.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };

  await saveRegister(parsed.data.storefrontSlug, {
    configured: false,
    locationName: '',
    pin: '',
    cashFloat: 0,
  });
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: userId,
    action: 'pos.reset',
    summary: 'POS register reset to onboarding',
  });
  revalidatePath('/account/pos', 'layout');
  return { status: 'success' };
}

const CashSaleItemSchema = z.object({
  productId: z.string().trim().max(64).optional().nullable(),
  productTitle: z.string().trim().min(1).max(280),
  unitPrice: z.number().nonnegative().max(99_999_999),
  quantity: z.number().int().positive().max(999),
});

const CashSaleSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  items: z.array(CashSaleItemSchema).min(1).max(60),
  cashTendered: z.number().nonnegative().max(99_999_999),
  notes: z.string().trim().max(280).optional().nullable(),
});

export async function chargeCashSale(
  input: z.input<typeof CashSaleSchema>,
): Promise<PosActionState> {
  const parsed = CashSaleSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid sale' };
  }
  const data = parsed.data;
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in first.' };
  const owner = await assertStorefrontOwner(data.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };

  const register = await getRegister(data.storefrontSlug);
  if (!register.configured) {
    return { status: 'error', message: 'Set up the register first.' };
  }

  const subtotal = data.items.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
  if (data.cashTendered + 0.0001 < subtotal) {
    return { status: 'error', message: 'Cash tendered is less than total.' };
  }

  try {
    const items: OrderItemInput[] = data.items.map((it) => ({
      productId: it.productId ?? null,
      productTitle: it.productTitle,
      variantLabel: null,
      unitPrice: it.unitPrice,
      quantity: it.quantity,
    }));

    const order = await createOrder(data.storefrontSlug, {
      customerId: null,
      status: 'paid',
      paymentStatus: 'paid',
      fulfilmentStatus: 'fulfilled',
      currencyCode: register.currencyCode,
      items,
      shippingTotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      notes: data.notes ?? null,
      channel: 'pos',
    });

    await recordAudit({
      storefrontSlug: data.storefrontSlug,
      clerkUserId: userId,
      action: 'pos.cash_sale',
      targetId: String(order.id),
      summary: `Cash sale #${order.orderNumber} · ${register.currencyCode} ${order.total.toFixed(2)} (tendered ${data.cashTendered.toFixed(2)})`,
      meta: {
        orderNumber: order.orderNumber,
        cashTendered: data.cashTendered,
        location: register.locationName,
      },
    });
    await recordEvent({
      storefrontSlug: data.storefrontSlug,
      kind: 'order_placed',
      meta: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        channel: 'pos',
      },
    });

    revalidatePath('/account/pos', 'layout');
    revalidatePath('/account', 'layout');
    return {
      status: 'success',
      orderId: order.id,
      orderNumber: order.orderNumber,
    };
  } catch (err) {
    console.error('[pos/chargeCashSale] failed', err);
    return { status: 'error', message: 'Charge failed. Try again.' };
  }
}
