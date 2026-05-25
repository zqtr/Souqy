import { PageHeader } from '@/components/admin/primitives';
import { resolveSettingsContext } from '../_helpers';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { cookies } from 'next/headers';
import { adminPhrase } from '@/components/admin/adminLocale';

export default async function GeneralSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const { storefront } = await resolveSettingsContext(sp, '/account/settings/general');
  const locale = (await cookies()).get('NEXT_LOCALE')?.value;
  const t = (text: string) => adminPhrase(locale, text);
  return (
    <>
      <PageHeader
        eyebrow={t('Store · General')}
        title={t('General')}
        subtitle={
          locale === 'ar'
            ? `هوية ${storefront.businessName}.`
            : `Identity for ${storefront.businessName}.`
        }
      />
      <GeneralSettings
        slug={storefront.slug}
        initial={{
          businessName: storefront.businessName,
          founderName: storefront.founderName,
          tagline: storefront.tagline,
        }}
      />
    </>
  );
}
