import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';

type SearchParams = Promise<{
  store?: string | string[];
}>;

export default async function SouqnasourcePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/apps');

  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const storefronts = await getStorefrontsForUser(userId);
  if (storefronts.length === 0) redirect('/begin');

  const known = new Set(storefronts.map((s) => s.slug));
  const slug = requested && known.has(requested) ? requested : storefronts[0]!.slug;
  redirect(`/account/apps?store=${encodeURIComponent(slug)}`);
}
