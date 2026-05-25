import 'server-only';
import { currentUser } from '@clerk/nextjs/server';

export const SOUQNA_OPERATOR_EMAIL = 'ceo@souqna.qa';
const SOUQNA_OPERATOR_USER_IDS = new Set([
  'user_3DMoH2Wtf5oEbkmypEIAbfkzqJh',
]);

export function isSouqnaOperatorEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === SOUQNA_OPERATOR_EMAIL;
}

export function isSouqnaOperatorUserId(userId: string | null | undefined): boolean {
  return Boolean(userId && SOUQNA_OPERATOR_USER_IDS.has(userId));
}

export async function getSouqnaOperator() {
  const user = await currentUser().catch(() => null);
  const operatorEmail =
    user?.emailAddresses.find((address) => isSouqnaOperatorEmail(address.emailAddress))
      ?.emailAddress ?? null;
  const email =
    operatorEmail ?? user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? null;

  if (!user?.id || (!operatorEmail && !isSouqnaOperatorUserId(user.id))) {
    return null;
  }

  return { userId: user.id, email };
}

export async function assertSouqnaOperator() {
  const operator = await getSouqnaOperator();
  if (!operator) {
    throw new Error('Forbidden');
  }
  return operator;
}
