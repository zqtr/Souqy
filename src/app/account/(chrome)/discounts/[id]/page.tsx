import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';
import { getDiscount } from '@/lib/discounts';
import { PageHeader } from '@/components/admin/primitives';
import { DiscountForm } from '@/components/admin/discounts/DiscountForm';

export default async function DiscountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/discounts');
  const { id } = await params;
  const discountId = Number.parseInt(id, 10);
  if (!Number.isFinite(discountId) || discountId <= 0) notFound();

  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const storefronts = await getStorefrontsForUser(userId);
  if (storefronts.length === 0) redirect('/account');
  const known = new Set(storefronts.map((s) => s.slug));
  const slug = requested && known.has(requested) ? requested : storefronts[0]!.slug;

  const discount = await getDiscount(slug, discountId);
  if (!discount) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Discount"
        title={discount.code}
        subtitle={discount.title ?? 'Edit, schedule, or disable this code.'}
        secondaryActions={[{ label: '← Discounts', href: `/account/discounts?store=${slug}` }]}
      />
      <DiscountForm
        storefrontSlug={slug}
        mode="edit"
        initial={{
          id: discount.id,
          kind: discount.kind,
          code: discount.code,
          title: discount.title,
          valueType: discount.valueType,
          value: discount.value,
          appliesTo: discount.appliesTo,
          minimumSubtotal: discount.minimumSubtotal,
          usageLimit: discount.usageLimit,
          perCustomerLimit: discount.perCustomerLimit,
          status: discount.status,
          startsAt: discount.startsAt,
          endsAt: discount.endsAt,
        }}
      />
    </>
  );
}
