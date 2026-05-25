import { PageHeader } from '@/components/admin/primitives';
import { MarketSettingsForm } from '@/components/settings/OperationsSettings';
import { getMarketSettings } from '@/lib/adminSettings';
import { resolveSettingsContext } from '../_helpers';

export default async function MarketsPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const { storefront } = await resolveSettingsContext(sp, '/account/settings/markets');
  const markets = await getMarketSettings(storefront.slug);

  return (
    <>
      <PageHeader
        eyebrow="Platform · Markets"
        title="Markets"
        subtitle="Control the currencies, languages, and selling regions available to this storefront."
      />
      <MarketSettingsForm slug={storefront.slug} initial={markets} />
    </>
  );
}
