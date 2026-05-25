import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';
import { getAllProducts } from '@/lib/products';
import { PageHeader } from '@/components/admin/primitives';
import { OrderCreateForm } from '@/components/admin/orders/OrderCreateForm';

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/orders/new');

  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const storefronts = await getStorefrontsForUser(userId);
  if (storefronts.length === 0) redirect('/begin');
  const known = storefronts.map((s) => s.slug);
  const slug =
    requested && known.includes(requested) ? requested : storefronts[0]!.slug;

  const products = await getAllProducts(slug);

  return (
    <>
      <PageHeader
        eyebrow="Orders · New"
        title="Create order"
        subtitle={`Log a new order on ${storefronts.find((s) => s.slug === slug)?.businessName ?? slug}.`}
        secondaryActions={[{ label: '← Orders', href: `/account/orders?store=${slug}` }]}
      />
      <OrderCreateForm
        storefrontSlug={slug}
        products={products.map((p) => ({
          id: p.id,
          title: p.title,
          priceQar: p.priceQar,
        }))}
      />
    </>
  );
}
