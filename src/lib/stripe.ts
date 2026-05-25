import 'server-only';
import Stripe from 'stripe';
import { env } from './env';
import type { BillingCycle, Plan } from './plans';

/**
 * Stripe is the chosen self-serve checkout provider for Souqna. We
 * picked it over Vercel Marketplace billing because the Marketplace
 * SKU is designed for selling Vercel-platform integrations to Vercel
 * users — Souqna sells direct to Qatar founders in QAR, which Stripe
 * supports natively (Qatar settlement currency, MENA card acquiring),
 * and which Marketplace billing does not.
 *
 * One client, lazy initialised so a missing key doesn't crash imports
 * — gating logic must keep working even when checkout isn't configured
 * (local dev, preview deploys without billing keys, etc).
 */
let cached: Stripe | null = null;

export function stripeClient(): Stripe | null {
  if (cached) return cached;
  const key = env.STRIPE_SECRET_KEY;
  if (!key) return null;
  cached = new Stripe(key, {
    typescript: true,
    appInfo: { name: 'Souqna', url: 'https://souqna.qa' },
  });
  return cached;
}

export function hasStripe(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

/**
 * Resolves the configured Stripe Price ID for a given (plan, cycle).
 * Returns `null` for `free` (nothing to charge) or when the env var
 * for the requested SKU is unset (local dev). Internal IDs match the
 * `Plan` literal in `src/lib/plans.ts`.
 */
export function priceIdFor(plan: Plan, cycle: BillingCycle): string | null {
  if (plan === 'free') return null;
  const ids: Record<Exclude<Plan, 'free'>, Record<BillingCycle, string | undefined>> = {
    starter: {
      monthly: env.STRIPE_PRICE_STARTER_MONTHLY,
      annual: env.STRIPE_PRICE_STARTER_ANNUAL,
    },
    pro: {
      monthly: env.STRIPE_PRICE_PRO_MONTHLY,
      annual: env.STRIPE_PRICE_PRO_ANNUAL,
    },
    atelier: {
      monthly: env.STRIPE_PRICE_ATELIER_MONTHLY,
      annual: env.STRIPE_PRICE_ATELIER_ANNUAL,
    },
  };
  return ids[plan][cycle] ?? null;
}

/**
 * Reverse lookup — Stripe Price ID → (plan, cycle). Used by the
 * webhook to map a subscription back to our internal tier without
 * hitting Stripe again. Returns `null` for unrecognised price IDs
 * (e.g. a legacy SKU we've since rotated out of env).
 */
export function planFromPriceId(
  priceId: string,
): { plan: Exclude<Plan, 'free'>; cycle: BillingCycle } | null {
  const map: Array<[string | undefined, Exclude<Plan, 'free'>, BillingCycle]> = [
    [env.STRIPE_PRICE_STARTER_MONTHLY, 'starter', 'monthly'],
    [env.STRIPE_PRICE_STARTER_ANNUAL, 'starter', 'annual'],
    [env.STRIPE_PRICE_PRO_MONTHLY, 'pro', 'monthly'],
    [env.STRIPE_PRICE_PRO_ANNUAL, 'pro', 'annual'],
    [env.STRIPE_PRICE_ATELIER_MONTHLY, 'atelier', 'monthly'],
    [env.STRIPE_PRICE_ATELIER_ANNUAL, 'atelier', 'annual'],
  ];
  for (const [id, plan, cycle] of map) {
    if (id && id === priceId) return { plan, cycle };
  }
  return null;
}
