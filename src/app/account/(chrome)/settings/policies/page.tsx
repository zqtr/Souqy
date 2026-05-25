import { PageHeader } from '@/components/admin/primitives';
import { resolveSettingsContext } from '../_helpers';
import { PoliciesSettings } from '@/components/settings/PoliciesSettings';
import { getStorefrontPolicies } from '@/lib/storefrontSettings';

export default async function PoliciesPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const { storefront } = await resolveSettingsContext(sp, '/account/settings/policies');
  const policies = await getStorefrontPolicies(storefront.slug);
  return (
    <>
      <PageHeader
        eyebrow="Customers · Policies"
        title="Store policies"
        subtitle="The four standard policies that appear in your storefront footer."
      />
      <PoliciesSettings
        slug={storefront.slug}
        initial={{
          terms: policies.terms ?? '',
          privacy: policies.privacy ?? '',
          refund: policies.refund ?? '',
          shipping: policies.shipping ?? '',
        }}
      />
    </>
  );
}
