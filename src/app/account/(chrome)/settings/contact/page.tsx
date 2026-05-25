import { PageHeader } from '@/components/admin/primitives';
import { resolveSettingsContext } from '../_helpers';
import { ContactSettings } from '@/components/settings/ContactSettings';

export default async function ContactSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const { storefront } = await resolveSettingsContext(sp, '/account/settings/contact');
  return (
    <>
      <PageHeader
        eyebrow="Store · Contact"
        title="Contact details"
        subtitle="What customers see on your storefront and on order receipts."
      />
      <ContactSettings
        slug={storefront.slug}
        initial={{
          phone: storefront.phone,
          area: storefront.area,
          hours: storefront.hours,
          instagram: storefront.instagram,
          crNumber: storefront.crNumber,
        }}
      />
    </>
  );
}
