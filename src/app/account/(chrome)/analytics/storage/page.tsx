import { redirect } from 'next/navigation';

export default async function LegacyStorageRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const suffix = requested ? `?store=${encodeURIComponent(requested)}` : '';
  redirect(`/account/storage-library${suffix}`);
}
