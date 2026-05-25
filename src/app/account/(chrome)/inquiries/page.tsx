import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';
import { listInquiries, countInquiries } from '@/lib/inquiries';
import {
  PageHeader,
  Surface,
  EmptyState,
  StatusBadge,
} from '@/components/admin/primitives';
import { adminPhrase } from '@/components/admin/adminLocale';

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/inquiries');
  const locale = (await cookies()).get('NEXT_LOCALE')?.value;
  const t = (text: string) => adminPhrase(locale, text);

  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const storefronts = await getStorefrontsForUser(userId);
  if (storefronts.length === 0) {
    return (
      <>
        <PageHeader title={t('Inquiries')} subtitle={t('Set up a storefront to start receiving inquiries.')} />
        <EmptyState
          eyebrow={t('Get started')}
          title={t('Create your store first')}
          body={t("The Inquire button on your live storefront writes into this log. You'll see who asked, what they asked about, and how to reach them.")}
          action={{ label: t('Create your store'), href: '/begin' }}
        />
      </>
    );
  }
  const known = storefronts.map((s) => s.slug);
  const slug =
    requested && known.includes(requested) ? requested : storefronts[0]!.slug;

  const [inquiries, total] = await Promise.all([
    listInquiries(slug, { limit: 50 }),
    countInquiries(slug),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={t('Inquiries')}
        title={t('Inquiries')}
        subtitle={
          locale === 'ar'
            ? `${total.toLocaleString('ar-QA')} استفسار على ${storefronts.find((s) => s.slug === slug)?.businessName ?? slug}. غالباً يتم تحويلها إلى محادثات واتساب.`
            : `${total} inquir${total === 1 ? 'y' : 'ies'} on ${storefronts.find((s) => s.slug === slug)?.businessName ?? slug}. Most Doha founders convert these on WhatsApp.`
        }
      />

      {inquiries.length === 0 ? (
        <EmptyState
          eyebrow={t('No inquiries yet')}
          title={t("Your storefront hasn't been asked anything yet")}
          body={t('When a visitor taps the Inquire button on a product or contact block, it lands here with their preferred channel pre-selected. The visitor also becomes a customer record automatically.')}
          action={{
            label: t('Open your storefront'),
            href: `https://${slug}.souqna.qa`,
          }}
        />
      ) : (
        <Surface padding={0}>
          <ol
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {inquiries.map((q, i) => (
              <li
                key={q.id}
                style={{
                  padding: '16px 18px',
                  borderTop:
                    i === 0
                      ? 'none'
                      : '1px solid color-mix(in srgb, var(--ink-strong) 7%, transparent)',
                  display: 'flex',
                  gap: 16,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <header
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      marginBottom: 6,
                    }}
                  >
                    <Link
                      href={`/account/inquiries/${q.id}?store=${slug}`}
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: 'var(--ink-strong)',
                        textDecoration: 'none',
                      }}
                    >
                      {q.visitorName ?? q.visitorEmail ?? q.visitorPhone ?? t('Anonymous')}
                    </Link>
                    <StatusBadge tone={statusTone(q.status)}>{t(q.status)}</StatusBadge>
                    <StatusBadge tone="neutral">{q.preferredChannel}</StatusBadge>
                    {q.productTitle ? (
                      <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                        {t('about')} <em>{q.productTitle}</em>
                      </span>
                    ) : null}
                  </header>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13.5,
                      color: 'var(--ink-strong)',
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {q.message}
                  </p>
                  <footer
                    style={{
                      marginTop: 8,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--ink-muted)',
                      letterSpacing: '0.04em',
                      display: 'flex',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>{q.createdAt.toLocaleString('en-GB')}</span>
                    {q.visitorEmail ? <span>· {q.visitorEmail}</span> : null}
                    {q.visitorPhone ? <span>· {q.visitorPhone}</span> : null}
                  </footer>
                </div>
              </li>
            ))}
          </ol>
        </Surface>
      )}
    </>
  );
}

function statusTone(
  s: string,
): 'success' | 'warning' | 'critical' | 'info' | 'neutral' {
  if (s === 'responded') return 'success';
  if (s === 'new') return 'info';
  if (s === 'spam') return 'critical';
  return 'neutral';
}
