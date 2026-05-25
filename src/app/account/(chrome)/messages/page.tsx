import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';
import { listCustomers } from '@/lib/customers';
import { EmptyState, PageHeader } from '@/components/admin/primitives';
import { SentMessagesComposer } from '@/components/admin/messages/SentMessagesComposer';

export default async function MessagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/messages');
  const locale = (await cookies()).get('NEXT_LOCALE')?.value;
  const isAr = locale === 'ar';
  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const storefronts = await getStorefrontsForUser(userId);

  if (storefronts.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Messages"
          arEyebrow="الرسائل"
          title={isAr ? 'الرسائل' : 'Messages'}
          arTitle="الرسائل"
          subtitle={
            isAr
              ? 'أنشئ متجرا لتبدأ إرسال رسائل Souqna عبر Sent.dm.'
              : 'Create a storefront to start sending Souqna messages through Sent.dm.'
          }
        />
        <EmptyState
          eyebrow="Get started"
          arEyebrow="ابدأ"
          title="Create your store first"
          arTitle="أنشئ متجرك أولا"
          body="Messages are scoped per storefront so customer lists, orders, and audit history stay organized."
          arBody="ترتبط الرسائل بكل متجر حتى تبقى قوائم العملاء والطلبات وسجل النشاط منظمة."
          action={{ label: 'Create your store', arLabel: 'أنشئ متجرك', href: '/begin' }}
        />
      </>
    );
  }

  const known = storefronts.map((storefront) => storefront.slug);
  const slug = requested && known.includes(requested) ? requested : storefronts[0]!.slug;
  const storefront = storefronts.find((store) => store.slug === slug) ?? storefronts[0]!;
  const customers = await listCustomers(slug, { limit: 1000 });
  const cutoff30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const audienceCounts = {
    consented: customers.filter((customer) => customer.phone && customer.marketingConsent).length,
    recent: customers.filter(
      (customer) =>
        customer.phone &&
        customer.marketingConsent &&
        customer.lastSeenAt &&
        customer.lastSeenAt.getTime() > cutoff30,
    ).length,
  };

  return (
    <>
      <PageHeader
        eyebrow="Messages"
        arEyebrow="الرسائل"
        title={isAr ? 'رسائل Souqna' : 'Souqna Messages'}
        arTitle="رسائل سوقنا"
        subtitle={
          isAr
            ? `أرسل رسائل تسويق وخدمة وتنبيهات للمتجر ${storefront.businessName}.`
            : `Send marketing, care, account, delivery, and security messages for ${storefront.businessName}.`
        }
      />
      <SentMessagesComposer
        storefrontSlug={slug}
        storeName={storefront.businessName}
        audienceCounts={audienceCounts}
        customers={customers.map((customer) => ({
          id: customer.id,
          name:
            [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() ||
            customer.email ||
            customer.phone ||
            `Customer ${customer.id}`,
          phone: customer.phone,
          marketingConsent: customer.marketingConsent,
          lastSeenAt: customer.lastSeenAt?.toISOString() ?? null,
        }))}
      />
    </>
  );
}
