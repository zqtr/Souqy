import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';
import { listCustomers } from '@/lib/customers';
import { PageHeader } from '@/components/admin/primitives';
import { BroadcastComposer } from '@/components/admin/marketing/BroadcastComposer';

export default async function NewBroadcastPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/marketing/new');
  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const storefronts = await getStorefrontsForUser(userId);
  if (storefronts.length === 0) redirect('/begin');
  const known = storefronts.map((s) => s.slug);
  const slug =
    requested && known.includes(requested) ? requested : storefronts[0]!.slug;

  const customers = await listCustomers(slug, { limit: 1000 });
  const cutoff30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const audience = {
    all: customers.filter((c) => c.email).length,
    consented: customers.filter((c) => c.email && c.marketingConsent).length,
    recent: customers.filter(
      (c) =>
        c.email &&
        c.marketingConsent &&
        c.lastSeenAt &&
        c.lastSeenAt.getTime() > cutoff30,
    ).length,
  };

  return (
    <>
      <PageHeader
        eyebrow="Marketing · Broadcast"
        title="Compose broadcast"
        subtitle="One-shot email to a curated audience. Sent via Resend; we add the Souqna footer and unsubscribe note automatically."
        secondaryActions={[
          { label: '← Marketing', href: `/account/marketing?store=${slug}` },
        ]}
      />
      <BroadcastComposer storefrontSlug={slug} audience={audience} />
    </>
  );
}
