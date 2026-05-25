import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';
import { countCustomers, listCustomers } from '@/lib/customers';
import {
  PageHeader,
  EmptyState,
  Surface,
  StatusBadge,
} from '@/components/admin/primitives';
import { BroadcastModal } from '@/components/admin/marketing/BroadcastModal';
import { adminPhrase } from '@/components/admin/adminLocale';

export default async function MarketingPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[]; new?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/marketing');
  const locale = (await cookies()).get('NEXT_LOCALE')?.value;
  const t = (text: string) => adminPhrase(locale, text);

  const sp = (await searchParams) ?? {};
  const pick = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const requested = pick(sp.store);
  const isNew = pick(sp.new) === '1' || pick(sp.new) === 'true';
  const storefronts = await getStorefrontsForUser(userId);
  if (storefronts.length === 0) {
    return (
      <>
        <PageHeader title={t('Marketing')} subtitle={t('Set up a storefront to start running campaigns.')} />
        <EmptyState
          eyebrow={t('Get started')}
          title={t('Create your store first')}
          body={t('Marketing campaigns send to customers tied to a specific storefront. Set yours up to unlock email broadcasts and audience filters.')}
          action={{ label: t('Create your store'), href: '/begin' }}
        />
      </>
    );
  }
  const known = storefronts.map((s) => s.slug);
  const slug =
    requested && known.includes(requested) ? requested : storefronts[0]!.slug;
  const audience = await countCustomers(slug);
  // Detailed audience counts only loaded when the modal is mounted, so the
  // listing page stays cheap when nobody is composing.
  const audienceCounts = isNew
    ? await (async () => {
        const customers = await listCustomers(slug, { limit: 1000 });
        const cutoff30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
        return {
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
      })()
    : null;

  return (
    <>
      <PageHeader
        eyebrow={t('Marketing')}
        title={t('Campaigns')}
        subtitle={
          locale === 'ar'
            ? `يمكنك الوصول إلى ${audience.toLocaleString('ar-QA')} عميل على ${storefronts.find((s) => s.slug === slug)?.businessName ?? slug}.`
            : `Reach ${audience} customer${audience === 1 ? '' : 's'} on ${storefronts.find((s) => s.slug === slug)?.businessName ?? slug}.`
        }
        primaryAction={{
          label: t('Compose broadcast'),
          href: `/account/marketing?store=${slug}&new=1`,
        }}
      />

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Surface padding={18}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <StatusBadge tone="success">{t('Email')}</StatusBadge>
            <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{t('via Resend')}</span>
          </div>
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif, var(--font-sans))',
              fontWeight: 400,
              fontSize: 17,
              color: 'var(--ink-strong)',
            }}
          >
            {t('One-off broadcasts')}
          </h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-muted)' }}>
            {t('Pick an audience, write the message, send it. Souqna handles the unsubscribe link and the deliverability.')}
          </p>
        </Surface>
        <Surface padding={18}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <StatusBadge tone="info">{t('Coming soon')}</StatusBadge>
          </div>
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif, var(--font-sans))',
              fontWeight: 400,
              fontSize: 17,
              color: 'var(--ink-strong)',
            }}
          >
            {t('WhatsApp blasts')}
          </h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-muted)' }}>
            {t('Wire your WhatsApp Business number from the Apps page to send template messages to opted-in customers.')}
          </p>
        </Surface>
        <Surface padding={18}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <StatusBadge tone="info">{t('Coming soon')}</StatusBadge>
          </div>
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif, var(--font-sans))',
              fontWeight: 400,
              fontSize: 17,
              color: 'var(--ink-strong)',
            }}
          >
            {t('Automations')}
          </h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-muted)' }}>
            {t('Trigger emails on inquiry, abandoned cart, post-purchase, and birthday — once Klaviyo or Mailchimp is connected.')}
          </p>
        </Surface>
      </section>

      <EmptyState
        eyebrow={t('No campaigns yet')}
        title={t('Start your first broadcast')}
        body={t('Compose a thank-you to your last 50 customers, announce a new collection, or share a holiday hours update. Every send is logged so you can revisit performance later.')}
        action={{
          label: t('Compose broadcast'),
          href: `/account/marketing?store=${slug}&new=1`,
        }}
      />

      {isNew && audienceCounts ? (
        <BroadcastModal
          open
          storefrontSlug={slug}
          audience={audienceCounts}
          closeHref={`/account/marketing?store=${slug}`}
        />
      ) : null}
    </>
  );
}
