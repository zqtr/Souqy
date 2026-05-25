'use server';

import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { assertStorefrontOwner } from '@/lib/products';
import { getOrder } from '@/lib/orders';
import {
  createAramexShipment,
  trackShipment as trackAramex,
} from '@/lib/apps/aramex';
import { recordAudit } from '@/lib/audit';
import type { Shipment } from '@/lib/shipments';

/**
 * Server actions for Aramex shipment creation + tracking refresh.
 * Live in their own module (separate from `apps.ts`) because they
 * need to import the heavier order/shipment helpers and shouldn't
 * pull those into every other plugin's path.
 */

export type AramexActionState =
  | { status: 'idle' }
  | { status: 'success'; shipment?: Shipment; statusText?: string }
  | { status: 'error'; message: string };

const CreateSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  orderId: z.number().int().positive(),
  destination: z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(4).max(40),
    email: z.string().trim().max(200),
    line1: z.string().trim().min(1).max(200),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().min(1).max(120),
    countryCode: z.string().trim().length(2),
    postCode: z.string().trim().max(40).optional(),
  }),
  productType: z.string().trim().max(8).optional(),
  weightKg: z.number().positive().max(1000).optional(),
  dimensionsCm: z
    .object({
      length: z.number().positive().max(10_000),
      width: z.number().positive().max(10_000),
      height: z.number().positive().max(10_000),
    })
    .optional(),
});

export async function createShipmentAction(
  input: z.input<typeof CreateSchema>,
): Promise<AramexActionState> {
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid request' };
  }
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in.' };
  const owner = await assertStorefrontOwner(parsed.data.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  const order = await getOrder(parsed.data.storefrontSlug, parsed.data.orderId);
  if (!order) return { status: 'error', message: 'Order not found.' };

  try {
    const shipment = await createAramexShipment(parsed.data.storefrontSlug, {
      order,
      destination: {
        ...parsed.data.destination,
        countryCode: parsed.data.destination.countryCode.toUpperCase(),
      },
      ...(parsed.data.productType !== undefined ? { productType: parsed.data.productType } : {}),
      ...(parsed.data.weightKg !== undefined ? { weightKg: parsed.data.weightKg } : {}),
      ...(parsed.data.dimensionsCm !== undefined ? { dimensionsCm: parsed.data.dimensionsCm } : {}),
    });
    await recordAudit({
      storefrontSlug: parsed.data.storefrontSlug,
      clerkUserId: userId,
      action: 'shipment.create',
      targetId: String(order.id),
      summary: `Aramex shipment ${shipment.awb}`,
    });
    revalidatePath(`/account/orders/${order.id}`);
    return { status: 'success', shipment };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Could not create shipment.',
    };
  }
}

const RefreshSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  awb: z.string().trim().min(4).max(40),
});

export async function refreshTrackingAction(
  input: z.input<typeof RefreshSchema>,
): Promise<AramexActionState> {
  const parsed = RefreshSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in.' };
  const owner = await assertStorefrontOwner(parsed.data.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  try {
    const update = await trackAramex(parsed.data.storefrontSlug, parsed.data.awb);
    if (!update) return { status: 'error', message: 'No update available yet.' };
    revalidatePath(`/account/orders`);
    return { status: 'success', statusText: update.status };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Could not refresh tracking.',
    };
  }
}
