import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { UserProfile } from '@clerk/nextjs';
import {
  PageHeader,
  Surface,
} from '@/components/admin/primitives';
import { getStorefrontsForUser } from '@/lib/brief';

/**
 * Your account — Clerk-managed profile + a Souqna-owned summary
 * (storefront count, member-since). Embeds Clerk's UserProfile so the
 * founder edits email, password, and connected accounts in place
 * instead of being kicked over to clerk.com.
 */
export default async function AccountPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/settings/account');
  const [user, storefronts] = await Promise.all([
    currentUser(),
    getStorefrontsForUser(userId),
  ]);
  const liveCount = storefronts.filter((s) => s.isPublished).length;
  const memberSince = user?.createdAt ? new Date(user.createdAt) : null;

  return (
    <>
      <PageHeader
        eyebrow="Platform · Account"
        title="Your account"
        subtitle="Sign-in details, security, and connected accounts."
      />

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 16,
        }}
      >
        <Surface padding={20}>
          <h3
            style={{
              margin: '0 0 12px',
              fontFamily: 'var(--font-serif, var(--font-sans))',
              fontWeight: 400,
              fontSize: 17,
              color: 'var(--ink-strong)',
            }}
          >
            Souqna summary
          </h3>
          <dl
            style={{
              margin: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            <KV label="Member since" value={memberSince ? memberSince.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—'} />
            <KV label="Storefronts" value={String(storefronts.length)} />
            <KV label="Live storefronts" value={String(liveCount)} />
          </dl>
        </Surface>

        <Surface padding={0}>
          <UserProfile
            routing="hash"
            appearance={{
              elements: {
                rootBox: { width: '100%' },
                card: {
                  boxShadow: 'none',
                  border: 'none',
                  background: 'transparent',
                  width: '100%',
                },
                navbar: { display: 'none' },
                pageScrollBox: { padding: '12px 18px 24px' },
              },
            }}
          />
        </Surface>
      </section>
    </>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: '4px 0 0',
          fontSize: 16,
          color: 'var(--ink-strong)',
          fontFamily: 'var(--font-serif, var(--font-sans))',
        }}
      >
        {value}
      </dd>
    </div>
  );
}
