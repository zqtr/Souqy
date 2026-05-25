import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';
import { PageHeader } from '@/components/admin/primitives';
import { DiscountForm } from '@/components/admin/discounts/DiscountForm';

export default async function NewDiscountPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/discounts/new');
  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const storefronts = await getStorefrontsForUser(userId);
  if (storefronts.length === 0) redirect('/begin');
  const known = storefronts.map((s) => s.slug);
  const slug =
    requested && known.includes(requested) ? requested : storefronts[0]!.slug;

  return (
    <>
      <PageHeader
        eyebrow="Discounts · New"
        title="Create discount"
        subtitle="Promo codes apply against subtotal in the order entry screen."
        secondaryActions={[{ label: '← Discounts', href: `/account/discounts?store=${slug}` }]}
      />
      <DiscountForm storefrontSlug={slug} mode="create" />
    </>
  );
}
