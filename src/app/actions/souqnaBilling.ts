'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  getPlan,
  PLAN_LIMITS,
  PLANS,
  recordPlanHistory,
  setPlan,
  type Plan,
} from '@/lib/billing';
import { logEvent } from '@/lib/events';
import { assertSouqnaOperator } from '@/lib/souqna-operator';

const GrantSchema = z.object({
  clerkUserId: z.string().trim().min(1).max(128),
  plan: z.enum(PLANS),
});

export type SouqnaBillingActionState =
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

export async function grantSouqnaUserPlan(
  input: z.input<typeof GrantSchema>,
): Promise<SouqnaBillingActionState> {
  const parsed = GrantSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid plan grant' };

  const operator = await assertSouqnaOperator();
  const targetPlan: Plan = parsed.data.plan;

  try {
    const before = await getPlan(parsed.data.clerkUserId);
    await setPlan(parsed.data.clerkUserId, targetPlan, {
      source: 'souqna_operator',
      operatorUserId: operator.userId,
      operatorEmail: operator.email,
    });
    await recordPlanHistory({
      clerkUserId: parsed.data.clerkUserId,
      fromPlan: before,
      toPlan: targetPlan,
      cycle: null,
      source: 'admin_grant',
      meta: {
        surface: 'account_souqna',
        operatorUserId: operator.userId,
        operatorEmail: operator.email,
      },
    });
    await logEvent({
      kind: 'billing.granted',
      funnel: 'storefront',
      userId: parsed.data.clerkUserId,
      props: {
        plan: targetPlan,
        label: PLAN_LIMITS[targetPlan].label,
        source: 'souqna_operator',
        operatorUserId: operator.userId,
      },
    });
    revalidatePath('/account');
    revalidatePath('/account/souqna');
    return {
      status: 'success',
      message: `Granted ${PLAN_LIMITS[targetPlan].label} to ${parsed.data.clerkUserId}`,
    };
  } catch (err) {
    console.error('[grantSouqnaUserPlan] failed', err);
    return { status: 'error', message: 'Grant failed' };
  }
}
