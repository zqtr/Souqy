import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';
import { PageHeader } from '@/components/admin/primitives';
import { CustomerForm } from '@/components/admin/customers/CustomerForm';

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/customers/new');

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
        eyebrow="Customers · New"
        title="Add customer"
        subtitle="Hand-key a contact you've spoken to off-storefront. They'll be deduplicated automatically if they later send an inquiry from the live site."
        secondaryActions={[{ label: '← Customers', href: `/account/customers?store=${slug}` }]}
      />
      <CustomerForm storefrontSlug={slug} mode="create" />
    </>
  );
}
