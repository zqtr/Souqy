import { PageHeader } from '@/components/admin/primitives';
import { TaxSettingsForm } from '@/components/settings/OperationsSettings';
import { getTaxProfile } from '@/lib/adminSettings';
import { resolveSettingsContext } from '../_helpers';

export default async function TaxesPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const { storefront } = await resolveSettingsContext(sp, '/account/settings/taxes');
  const tax = await getTaxProfile(storefront.slug);

  return (
    <>
      <PageHeader
        eyebrow="Commerce · Taxes"
        title="Taxes & duties"
        subtitle="Set a durable tax profile for checkout and manual orders. Qatar stores can keep this disabled; cross-border stores can turn it on."
      />
      <TaxSettingsForm slug={storefront.slug} initial={tax} />
    </>
  );
}
