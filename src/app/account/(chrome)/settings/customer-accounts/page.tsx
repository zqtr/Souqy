import { PageHeader } from '@/components/admin/primitives';
import { resolveSettingsContext } from '../_helpers';
import { CustomerAccountsSettings } from '@/components/settings/CustomerAccountsSettings';

export default async function CustomerAccountsPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const { storefront } = await resolveSettingsContext(sp, '/account/settings/customer-accounts');
  return (
    <>
      <PageHeader
        eyebrow="Customers · Accounts"
        title="Customer accounts"
        subtitle="Whether visitors can sign up for accounts on your storefront."
      />
      <CustomerAccountsSettings
        slug={storefront.slug}
        initial={{ mode: 'optional' }}
      />
    </>
  );
}
