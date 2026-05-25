'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import {
  listUnreadAccountUpdates,
  markAccountUpdateReadForUser,
} from '@/lib/accountUpdates';
import { getPlan } from '@/lib/billing';

const UpdateIdSchema = z.string().uuid();

export async function getUnreadAccountUpdates() {
  const { userId } = await auth();
  if (!userId) return [];
  const plan = await getPlan(userId);
  return listUnreadAccountUpdates(userId, plan);
}

export async function markAccountUpdateRead(updateId: string): Promise<{ ok: boolean }> {
  const parsed = UpdateIdSchema.safeParse(updateId);
  if (!parsed.success) return { ok: false };
  const { userId } = await auth();
  if (!userId) return { ok: false };
  await markAccountUpdateReadForUser(userId, parsed.data);
  revalidatePath('/account');
  return { ok: true };
}
