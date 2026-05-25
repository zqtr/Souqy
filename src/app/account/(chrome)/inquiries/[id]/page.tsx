import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';
import { getInquiry } from '@/lib/inquiries';
import { getCustomer } from '@/lib/customers';
import {
  PageHeader,
  Surface,
  StatusBadge,
} from '@/components/admin/primitives';
import { InquiryActions } from '@/components/admin/inquiries/InquiryActions';

export default async function InquiryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/inquiries');
  const { id } = await params;
  const inquiryId = Number.parseInt(id, 10);
  if (!Number.isFinite(inquiryId) || inquiryId <= 0) notFound();

  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const storefronts = await getStorefrontsForUser(userId);
  if (storefronts.length === 0) redirect('/account');
  const known = new Set(storefronts.map((s) => s.slug));
  const slug = requested && known.has(requested) ? requested : storefronts[0]!.slug;

  const inquiry = await getInquiry(slug, inquiryId);
  if (!inquiry) notFound();
  const customer = inquiry.customerId
    ? await getCustomer(slug, inquiry.customerId)
    : null;

  const visitor =
    inquiry.visitorName ?? inquiry.visitorEmail ?? inquiry.visitorPhone ?? 'Anonymous';
  const wa = inquiry.visitorPhone
    ? `https://wa.me/${inquiry.visitorPhone.replace(/[^\d]/g, '')}`
    : null;

  return (
    <>
      <PageHeader
        eyebrow="Inquiry"
        title={visitor}
        subtitle={
          inquiry.productTitle ? `About ${inquiry.productTitle}` : 'General inquiry'
        }
        secondaryActions={[
          { label: '← Inquiries', href: `/account/inquiries?store=${slug}` },
        ]}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 20,
          alignItems: 'flex-start',
        }}
        className="souqna-inquiry-grid"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Surface padding={20}>
            <header
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <StatusBadge tone={statusTone(inquiry.status)}>
                {inquiry.status}
              </StatusBadge>
              <StatusBadge tone="neutral">prefers {inquiry.preferredChannel}</StatusBadge>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--ink-muted)',
                  letterSpacing: '0.06em',
                }}
              >
                {inquiry.createdAt.toLocaleString('en-GB')}
              </span>
            </header>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                color: 'var(--ink-strong)',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {inquiry.message}
            </p>
            {inquiry.sourceUrl ? (
              <p
                style={{
                  margin: '14px 0 0',
                  fontSize: 12,
                  color: 'var(--ink-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                from {inquiry.sourceUrl}
              </p>
            ) : null}
          </Surface>

          <Surface padding={20}>
            <h2
              style={{
                margin: '0 0 12px',
                fontFamily: 'var(--font-serif, var(--font-sans))',
                fontWeight: 400,
                fontSize: 17,
                color: 'var(--ink-strong)',
              }}
            >
              Reach out
            </h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {inquiry.visitorEmail ? (
                <a
                  href={`mailto:${inquiry.visitorEmail}?subject=Re%3A%20Your%20inquiry%20on%20Souqna`}
                  style={ctaButton}
                >
                  Email {inquiry.visitorEmail}
                </a>
              ) : null}
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" style={ctaButton}>
                  WhatsApp {inquiry.visitorPhone}
                </a>
              ) : null}
              {inquiry.visitorPhone ? (
                <a href={`tel:${inquiry.visitorPhone}`} style={ctaButtonSecondary}>
                  Call {inquiry.visitorPhone}
                </a>
              ) : null}
              {!inquiry.visitorEmail && !inquiry.visitorPhone ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)' }}>
                  No contact details on this inquiry.
                </p>
              ) : null}
            </div>
          </Surface>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Surface padding={20}>
            <InquiryActions
              storefrontSlug={slug}
              inquiryId={inquiry.id}
              currentStatus={inquiry.status}
            />
          </Surface>

          <Surface padding={20}>
            <h2
              style={{
                margin: '0 0 12px',
                fontFamily: 'var(--font-serif, var(--font-sans))',
                fontWeight: 400,
                fontSize: 17,
                color: 'var(--ink-strong)',
              }}
            >
              Customer
            </h2>
            {customer ? (
              <>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-strong)' }}>
                  {[customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
                    customer.email ||
                    customer.phone}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-muted)' }}>
                  {customer.orderCount} order{customer.orderCount === 1 ? '' : 's'} ·{' '}
                  {customer.inquiryCount} inquir{customer.inquiryCount === 1 ? 'y' : 'ies'}
                </p>
                <Link
                  href={`/account/customers/${customer.id}?store=${slug}`}
                  style={{
                    marginTop: 10,
                    display: 'inline-block',
                    fontSize: 12.5,
                    color: 'var(--admin-accent)',
                    textDecoration: 'none',
                  }}
                >
                  Open customer →
                </Link>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)' }}>
                No customer record was created (no email or phone on the inquiry).
              </p>
            )}
          </Surface>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .souqna-inquiry-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

function statusTone(s: string): 'success' | 'warning' | 'critical' | 'info' | 'neutral' {
  if (s === 'responded') return 'success';
  if (s === 'new') return 'info';
  if (s === 'spam') return 'critical';
  return 'neutral';
}

const ctaButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '9px 14px',
  borderRadius: 8,
  background: 'var(--ink-strong)',
  color: 'var(--surface-bg)',
  fontSize: 13,
  fontWeight: 500,
  textDecoration: 'none',
};

const ctaButtonSecondary: React.CSSProperties = {
  ...ctaButton,
  background: 'transparent',
  color: 'var(--ink-strong)',
  border: '1px solid color-mix(in srgb, var(--ink-strong) 18%, transparent)',
};
