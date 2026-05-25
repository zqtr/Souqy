import { PageHeader } from '@/components/admin/primitives';
import { resolveSettingsContext } from '../_helpers';
import { CheckoutSettings } from '@/components/settings/CheckoutSettings';
import {
  getStorefrontCheckoutSettings,
  getStorefrontPolicies,
  POLICY_KEYS,
  type PolicyKey,
} from '@/lib/storefrontSettings';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const { storefront } = await resolveSettingsContext(sp, '/account/settings/checkout');

  const [checkout, policies] = await Promise.all([
    getStorefrontCheckoutSettings(storefront.slug),
    getStorefrontPolicies(storefront.slug),
  ]);

  const policiesPresent = POLICY_KEYS.reduce(
    (acc, key) => {
      const value = policies[key];
      acc[key] = typeof value === 'string' && value.trim().length > 0;
      return acc;
    },
    {} as Record<PolicyKey, boolean>,
  );

  return (
    <>
      <PageHeader
        eyebrow="Commerce · Checkout"
        title="Checkout"
        subtitle="Pick which payment methods buyers can use, what policies they must accept, and the basic order rules. The storefront cart respects these settings on every order."
      />
      <CheckoutSettings
        slug={storefront.slug}
        initial={checkout}
        policiesPresent={policiesPresent}
        skipCashEligible={Boolean(storefront.crNumber)}
        skipCashBlockedReason={storefront.crNumber ? 'Confirm CR ownership' : 'Add CR number'}
        crNumber={storefront.crNumber}
      />
    </>
  );
}
