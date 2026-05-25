'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { assertSouqnaOperator } from '@/lib/souqna-operator';
import {
  markCheckoutPayoutPaid,
  markPlatformFeeCollected,
  waivePlatformFee,
} from '@/lib/platformFees';

const IdSchema = z.string().uuid();

export async function markSouqnaPayoutPaid(payoutId: string) {
  const parsed = IdSchema.safeParse(payoutId);
  if (!parsed.success) return { status: 'error' as const, message: 'Invalid payout.' };
  const operator = await assertSouqnaOperator();
  const ok = await markCheckoutPayoutPaid(parsed.data, operator.userId);
  revalidatePath('/account/souqna');
  return ok
    ? { status: 'success' as const }
    : { status: 'error' as const, message: 'Payout not found.' };
}

export async function markSouqnaFeeCollected(feeId: string) {
  const parsed = IdSchema.safeParse(feeId);
  if (!parsed.success) return { status: 'error' as const, message: 'Invalid fee.' };
  await assertSouqnaOperator();
  const ok = await markPlatformFeeCollected(parsed.data);
  revalidatePath('/account/souqna');
  return ok
    ? { status: 'success' as const }
    : { status: 'error' as const, message: 'Fee not found.' };
}

export async function waiveSouqnaFee(feeId: string) {
  const parsed = IdSchema.safeParse(feeId);
  if (!parsed.success) return { status: 'error' as const, message: 'Invalid fee.' };
  await assertSouqnaOperator();
  const ok = await waivePlatformFee(parsed.data);
  revalidatePath('/account/souqna');
  return ok
    ? { status: 'success' as const }
    : { status: 'error' as const, message: 'Fee not found.' };
}
