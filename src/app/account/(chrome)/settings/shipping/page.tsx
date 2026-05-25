import { PageHeader } from '@/components/admin/primitives';
import { ShippingSettingsForm } from '@/components/settings/OperationsSettings';
import { getShippingSettings } from '@/lib/adminSettings';
import { resolveSettingsContext } from '../_helpers';

export default async function ShippingPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const { storefront } = await resolveSettingsContext(sp, '/account/settings/shipping');
  const settings = await getShippingSettings(storefront.slug);

  return (
    <>
      <PageHeader
        eyebrow="Commerce · Shipping"
        title="Shipping & delivery"
        subtitle="Manage real flat-rate shipping profiles and checkout delivery totals for this storefront."
      />
      <ShippingSettingsForm slug={storefront.slug} initial={settings} />
    </>
  );
}
