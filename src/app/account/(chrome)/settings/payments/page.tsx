import { PageHeader } from '@/components/admin/primitives';
import { cookies } from 'next/headers';
import { CheckoutSettings } from '@/components/settings/CheckoutSettings';
import {
  getStorefrontCheckoutSettings,
  getStorefrontPolicies,
  POLICY_KEYS,
  type PolicyKey,
} from '@/lib/storefrontSettings';
import { resolveSettingsContext } from '../_helpers';
import { adminPhrase } from '@/components/admin/adminLocale';

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const { storefront } = await resolveSettingsContext(sp, '/account/settings/payments');
  const locale = (await cookies()).get('NEXT_LOCALE')?.value;
  const t = (text: string) => adminPhrase(locale, text);

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
        eyebrow={t('Commerce · Payments')}
        title={t('Payments')}
        subtitle={t('Manage cash on delivery, bank transfer, and GCC online gateways. Provider credentials only appear after selecting a logo, and live providers verify before activation.')}
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
