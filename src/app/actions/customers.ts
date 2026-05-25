'use server';

import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { assertStorefrontOwner } from '@/lib/products';
import { upsertCustomer, deleteCustomer } from '@/lib/customers';
import { recordAudit } from '@/lib/audit';

/**
 * Customer create / update from the dashboard. We re-use the upsert
 * helper so manually-added customers can later be deduplicated when
 * the same person sends an inquiry.
 */
const Schema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
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
  tags: z.array(z.string().trim().max(48)).default([]),
  marketingConsent: z.boolean().default(false),
});

export type CustomerFormInput = z.input<typeof Schema>;
export type CustomerActionState =
  | { status: 'idle' }
  | { status: 'success'; id: number }
  | { status: 'error'; message: string };

export async function saveCustomer(
  input: CustomerFormInput,
): Promise<CustomerActionState> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid form' };
  }
  const data = parsed.data;
  if (!data.email && !data.phone && !data.firstName) {
    return {
      status: 'error',
      message: 'Add an email, phone, or name so we can identify the customer.',
    };
  }
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in to save customers.' };
  const owner = await assertStorefrontOwner(data.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };

  try {
    const cust = await upsertCustomer(data.storefrontSlug, {
      email: data.email ?? null,
      phone: data.phone ?? null,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      tags: data.tags,
      marketingConsent: data.marketingConsent,
    });
    await recordAudit({
      storefrontSlug: data.storefrontSlug,
      clerkUserId: userId,
      action: 'customer.upsert',
      targetId: String(cust.id),
      summary: `Saved customer ${cust.email ?? cust.phone ?? cust.firstName ?? cust.identifier}`,
    });
    revalidatePath('/account/customers');
    return { status: 'success', id: cust.id };
  } catch (err) {
    console.error('[saveCustomer] failed', err);
    return { status: 'error', message: 'Save failed. Try again.' };
  }
}

export async function removeCustomer(input: {
  storefrontSlug: string;
  id: number;
}): Promise<CustomerActionState | { status: 'success' }> {
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in to delete.' };
  const owner = await assertStorefrontOwner(input.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  const ok = await deleteCustomer(input.storefrontSlug, input.id);
  if (!ok) return { status: 'error', message: 'Customer not found.' };
  await recordAudit({
    storefrontSlug: input.storefrontSlug,
    clerkUserId: userId,
    action: 'customer.delete',
    targetId: String(input.id),
    summary: 'Deleted customer',
  });
  revalidatePath('/account/customers');
  return { status: 'success' };
}
