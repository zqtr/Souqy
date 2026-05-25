import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';
import { getAllProducts } from '@/lib/products';
import { getRegister } from '@/lib/pos';
import { PageHeader, EmptyState } from '@/components/admin/primitives';
import { PosOnboardingWizard } from '@/components/admin/pos/PosOnboardingWizard';
import { PosTerminal } from '@/components/admin/pos/PosTerminal';

/**
 * Souqna POS — point-of-sale terminal for cash-at-the-counter sales.
 *
 * Two surfaces share this route:
 *
 *   - First visit (or after `Reset register`): a 3-step onboarding
 *     wizard that explains POS, captures the location/cash float/PIN,
 *     then flips the register to "configured".
 *
 *   - Subsequent visits: the POS terminal — product grid on the left,
 *     basket on the right, "charge cash" closes the sale and writes a
 *     paid order with channel='pos'.
 */
export default async function PosPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/pos');

  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;

  const storefronts = await getStorefrontsForUser(userId).catch((err) => {
    console.error('[admin/pos] getStorefrontsForUser failed', err);
    return [] as Awaited<ReturnType<typeof getStorefrontsForUser>>;
  });

  if (storefronts.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Point of sale"
          title="Open a register, take cash on the spot."
          subtitle="Souqna POS turns any laptop or tablet into a cash till — perfect for souq pop-ups, market days, and event activations."
        />
        <EmptyState
          eyebrow="Set up your store first"
          title="No storefront yet"
          body="Create a storefront so the POS knows what products to show and where to record sales."
          action={{ label: 'Create your store', href: '/begin' }}
        />
      </>
    );
  }

  const known = storefronts.map((s) => s.slug);
  const activeSlug =
    requested && known.includes(requested) ? requested : storefronts[0]!.slug;
  const active = storefronts.find((s) => s.slug === activeSlug)!;

  const [register, products] = await Promise.all([
    getRegister(activeSlug).catch((err) => {
      console.error('[admin/pos] getRegister failed', err);
      return null;
    }),
    getAllProducts(activeSlug).catch((err) => {
      console.error('[admin/pos] getAllProducts failed', err);
      return [] as Awaited<ReturnType<typeof getAllProducts>>;
    }),
  ]);

  const safeRegister = register ?? {
    configured: false,
    locationName: '',
    pin: '',
    cashFloat: 0,
    currencyCode: 'QAR',
    pricesIncludeTax: true,
    receiptFooter: 'Shukran. ◈',
  };

  if (!safeRegister.configured) {
    return (
      <PosOnboardingWizard
        storefrontSlug={activeSlug}
        businessName={active.businessName}
      />
    );
  }

  return (
    <PosTerminal
      storefrontSlug={activeSlug}
      businessName={active.businessName}
      register={safeRegister}
      products={products
        .filter((p) => p.status !== 'draft')
        .map((p) => ({
          id: p.id,
          title: p.title,
          priceQar: p.priceQar,
          imageUrl: p.imageUrl,
          category: p.category,
          status: p.status,
        }))}
    />
  );
}
