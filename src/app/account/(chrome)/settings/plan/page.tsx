import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/admin/primitives';
import { getPlan } from '@/lib/billing';
import { SubscriptionTracker } from '@/components/billing/SubscriptionTracker';
import { PlanCompare } from './PlanCompare';

/**
 * Plan page — 4-tier comparison strip with monthly / annual billing
 * toggle. The toggle defaults to "annual" so the headline price the
 * founder sees first is the discounted rate (35% off, applied uniformly
 * by `priceFor`); a one-tap switch back to monthly stays on the same
 * page.
 *
 * Server entry only fetches the caller's current plan and hands off to
 * the `PlanCompare` client island that renders the cards + toggle. The
 * actual numbers all flow from `PLAN_LIMITS` in `src/lib/plans.ts`, so
 * pricing changes only need to touch one file.
 */
export default async function PlanPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/settings/plan');
  const plan = await getPlan(userId);

  return (
    <>
      <PageHeader
        eyebrow="Store · Plan"
        title="Plan"
        subtitle="Pick the tier that matches the way you build."
      />
      <div style={{ marginBottom: 24 }}>
        <SubscriptionTracker locale="en" />
      </div>
      <PlanCompare currentPlan={plan} />
    </>
  );
}
