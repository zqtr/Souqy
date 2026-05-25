import { PageHeader } from '@/components/admin/primitives';
import { resolveSettingsContext } from '../_helpers';
import { NotificationsSettings } from '@/components/settings/NotificationsSettings';

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const { storefront } = await resolveSettingsContext(sp, '/account/settings/notifications');
  return (
    <>
      <PageHeader
        eyebrow="Customers · Notifications"
        title="Store notifications"
        subtitle="Pick which Souqna events should ping you across your account, phone, and mobile app."
      />
      <NotificationsSettings slug={storefront.slug} initial={{}} />
    </>
  );
}
