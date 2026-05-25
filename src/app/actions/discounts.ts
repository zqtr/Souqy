'use server';

import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { assertStorefrontOwner } from '@/lib/products';
import {
  createDiscount,
  updateDiscount,
  deleteDiscount,
  type DiscountWriteInput,
} from '@/lib/discounts';
import { recordAudit } from '@/lib/audit';
import {
  UPGRADE_GROWTH_TOOLS_COPY,
  getPlan,
  planUnlocksDiscounts,
} from '@/lib/billing';

const Schema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  id: z.number().int().positive().optional(),
  kind: z.enum(['code', 'automatic']).default('code'),
  code: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_\-]+$/, {
    message: 'Use only letters, numbers, dashes, and underscores.',
  }),
  title: z.string().trim().max(120).optional().nullable(),
  valueType: z.enum(['percentage', 'fixed_amount', 'free_shipping']),
  value: z.number().nonnegative().max(99999),
  appliesTo: z.enum(['all', 'products', 'categories']).default('all'),
  appliesToIds: z.array(z.string().trim().max(120)).default([]),
  minimumSubtotal: z.number().nonnegative().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  perCustomerLimit: z.number().int().positive().optional().nullable(),
  status: z.enum(['active', 'scheduled', 'expired', 'disabled']).default('active'),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

export type DiscountFormInput = z.input<typeof Schema>;
export type DiscountActionState =
  | { status: 'idle' }
  | { status: 'success'; id: number; code: string }
  | { status: 'error'; message: string; field?: string };

export async function saveDiscount(
  input: DiscountFormInput,
): Promise<DiscountActionState> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    const f = parsed.error.issues[0];
    return {
      status: 'error',
      message: f?.message ?? 'Invalid form',
      field: f?.path[0] as string | undefined,
    };
  }
  const data = parsed.data;
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in to save discounts.' };
  const owner = await assertStorefrontOwner(data.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  const plan = await getPlan(owner.clerkUserId);
  if (!planUnlocksDiscounts(plan)) {
    return { status: 'error', message: `${UPGRADE_GROWTH_TOOLS_COPY}.`, field: 'code' };
  }

  const write: DiscountWriteInput = {
    kind: data.kind,
    code: data.code.toUpperCase(),
    title: data.title ?? null,
    valueType: data.valueType,
    value: data.value,
    appliesTo: data.appliesTo,
    appliesToIds: data.appliesToIds,
    minimumSubtotal: data.minimumSubtotal ?? null,
    usageLimit: data.usageLimit ?? null,
    perCustomerLimit: data.perCustomerLimit ?? null,
    status: data.status,
    startsAt: data.startsAt ? new Date(data.startsAt) : null,
    endsAt: data.endsAt ? new Date(data.endsAt) : null,
  };

  try {
    if (data.id) {
      const row = await updateDiscount(data.storefrontSlug, data.id, write);
      if (!row) return { status: 'error', message: 'Discount not found.' };
      await recordAudit({
        storefrontSlug: data.storefrontSlug,
        clerkUserId: userId,
        action: 'discount.update',
        targetId: String(row.id),
        summary: `Updated discount ${row.code}`,
      });
      revalidatePath('/account/discounts');
      return { status: 'success', id: row.id, code: row.code };
    } else {
      const row = await createDiscount(data.storefrontSlug, write);
      await recordAudit({
        storefrontSlug: data.storefrontSlug,
        clerkUserId: userId,
        action: 'discount.create',
        targetId: String(row.id),
        summary: `Created discount ${row.code}`,
      });
      revalidatePath('/account/discounts');
      return { status: 'success', id: row.id, code: row.code };
    }
  } catch (err) {
    console.error('[saveDiscount] failed', err);
    if (err instanceof Error && err.message.includes('duplicate key')) {
      return {
        status: 'error',
        message: 'A discount with that code already exists.',
        field: 'code',
      };
    }
    return { status: 'error', message: 'Save failed. Try again.' };
  }
}

export async function removeDiscount(input: {
  storefrontSlug: string;
  id: number;
}): Promise<DiscountActionState | { status: 'success' }> {
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in to delete.' };
  const owner = await assertStorefrontOwner(input.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  const ok = await deleteDiscount(input.storefrontSlug, input.id);
  if (!ok) return { status: 'error', message: 'Discount not found.' };
  await recordAudit({
    storefrontSlug: input.storefrontSlug,
    clerkUserId: userId,
    action: 'discount.delete',
    targetId: String(input.id),
    summary: `Deleted discount`,
  });
  revalidatePath('/account/discounts');
  return { status: 'success' };
}
