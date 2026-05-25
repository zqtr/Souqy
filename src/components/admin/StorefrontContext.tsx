'use client';

import { createContext, useContext, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { StorefrontSummary } from './storefrontSummary';
import { storefrontCapForPlan, type Plan } from '@/lib/plans';

export type { StorefrontSummary } from './storefrontSummary';

type StorefrontContextValue = {
  /** Every storefront the founder owns. Empty array for first-time users. */
  storefronts: StorefrontSummary[];
  /** The store the dashboard is currently scoped to. Null only when the
   *  founder has zero stores (the Home page guides them to /begin). */
  active: StorefrontSummary | null;
  /** The caller's billing tier — used by the StoreSwitcher to decide
   *  whether the "Create another store" affordance is unlocked or
   *  whether to show an upgrade chip instead. Defaults to `'free'` so
   *  the UI never crashes if a layout forgot to thread the value. */
  plan: Plan;
  planPeriodEnd: string | null;
  /** Convenience flag: true when the founder has hit (or exceeded)
   *  their plan's storefront cap. Computed once here so consumers
   *  don't each re-run the comparison. */
  atStorefrontCap: boolean;
};

const Ctx = createContext<StorefrontContextValue | null>(null);

export function StorefrontProvider({
  storefronts,
  activeSlug,
  plan = 'free',
  planPeriodEnd = null,
  children,
}: {
  storefronts: StorefrontSummary[];
  activeSlug: string | null;
  plan?: Plan;
  planPeriodEnd?: string | null;
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const urlSlug = searchParams?.get('store');
  const value = useMemo<StorefrontContextValue>(() => {
    const resolvedActiveSlug =
      urlSlug && storefronts.some((s) => s.slug === urlSlug) ? urlSlug : activeSlug;
    const active =
      storefronts.find((s) => s.slug === resolvedActiveSlug) ?? storefronts[0] ?? null;
    const cap = storefrontCapForPlan(plan);
    const atStorefrontCap = storefronts.length >= cap;
    return { storefronts, active, plan, planPeriodEnd, atStorefrontCap };
  }, [storefronts, activeSlug, plan, planPeriodEnd, urlSlug]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStorefronts(): StorefrontContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStorefronts must be used inside StorefrontProvider');
  return v;
}
