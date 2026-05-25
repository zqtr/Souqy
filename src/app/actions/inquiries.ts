'use server';

import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { assertStorefrontOwner } from '@/lib/products';
import { updateInquiryStatus, type InquiryStatus } from '@/lib/inquiries';
import { recordAudit } from '@/lib/audit';

const Schema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  id: z.number().int().positive(),
  status: z.enum(['new', 'responded', 'closed', 'spam']),
});

export type InquiryActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string };

export async function setInquiryStatus(
  input: z.input<typeof Schema>,
): Promise<InquiryActionState> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in.' };
  const owner = await assertStorefrontOwner(parsed.data.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  const row = await updateInquiryStatus(
    parsed.data.storefrontSlug,
    parsed.data.id,
    parsed.data.status as InquiryStatus,
  );
  if (!row) return { status: 'error', message: 'Inquiry not found' };
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: userId,
    action: `inquiry.${parsed.data.status}`,
    targetId: String(row.id),
    summary: `Inquiry → ${parsed.data.status}`,
  });
  revalidatePath('/account/inquiries');
  return { status: 'success' };
}
