import { getSubscriptionStatus, type SubscriptionStatus } from '@/app/actions/billing';
import { SubscriptionTrackerCard } from './SubscriptionTrackerCard';

/**
 * Server entry for the subscription tracker editorial card.
 *
 * Awaits `getSubscriptionStatus` server-side so the first paint is
 * fully populated (no client loading shimmer on the plan settings
 * page). The interactive bits — the Activity disclosure and the
 * cross-tab `souqna:subscription-changed` listener — live in the
 * client island below.
 *
 * On signed-out callers / status === 'none' the action returns the
 * sentinel `{ status: 'none', plan: 'free' }` and we render nothing.
 */
export async function SubscriptionTracker({ locale }: { locale: 'en' | 'ar' }) {
  let initial: SubscriptionStatus | null = null;
  try {
    initial = await getSubscriptionStatus();
  } catch {
    return null;
  }
  if (!initial || initial.status === 'none') return null;
  return <SubscriptionTrackerCard initial={initial} locale={locale} />;
}
