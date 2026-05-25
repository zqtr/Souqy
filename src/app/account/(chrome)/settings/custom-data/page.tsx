import { PageHeader } from '@/components/admin/primitives';
import { CustomDataManager } from '@/components/settings/OperationsSettings';
import { listMetaobjects } from '@/lib/adminSettings';
import { resolveSettingsContext } from '../_helpers';

export default async function CustomDataPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const { storefront } = await resolveSettingsContext(sp, '/account/settings/custom-data');
  const records = await listMetaobjects(storefront.slug);

  return (
    <>
      <PageHeader
        eyebrow="Platform · Custom data"
        title="Custom data"
        subtitle="Create reusable FAQs, testimonials, specs, and press-logo records using the existing metaobjects store."
      />
      <CustomDataManager slug={storefront.slug} records={records} />
    </>
  );
}
