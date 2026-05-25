import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';
import { getAppDescriptor } from '@/lib/apps/registry';
import { getInstalledApp } from '@/lib/apps/installed';
import { env } from '@/lib/env';
import { PageHeader, Surface } from '@/components/admin/primitives';
import { InstallPanel } from '@/components/admin/apps/InstallPanel';
import { AppMark } from '@/components/admin/apps/AppMark';

const apiKeyHelp: Record<string, { placeholder: string; helpUrl?: string }> = {
  giphy: {
    placeholder: 'Paste your token (eg. dG8eVHkYxhh0nZG3pP9q)',
    helpUrl: 'https://developers.giphy.com/dashboard/',
  },
  notion: {
    placeholder: 'secret_… (your Notion integration token)',
    helpUrl: 'https://www.notion.so/profile/integrations',
  },
  'google-sheets': {
    placeholder: 'Paste the entire service-account JSON key',
    helpUrl: 'https://cloud.google.com/iam/docs/service-accounts-create',
  },
};

export default async function AppDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ store?: string | string[]; error?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/apps');
  const { id } = await params;
  const desc = getAppDescriptor(id);
  if (!desc) notFound();

  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const error = Array.isArray(sp.error) ? sp.error[0] : sp.error;
  const storefronts = await getStorefrontsForUser(userId);
  if (storefronts.length === 0) redirect('/begin');
  const known = new Set(storefronts.map((s) => s.slug));
  const slug = requested && known.has(requested) ? requested : storefronts[0]!.slug;

  const installed = await getInstalledApp(slug, desc.id);
  if (installed) {
    redirect(`/account/apps/${desc.id}/configure?store=${slug}`);
  }

  const missingEnv = (desc.requiredEnv ?? []).filter((k) => {
    const v = process.env[k];
    return !v || v.trim().length === 0;
  });

  let setupRequired: string | null = null;
  // Apps that store credentials at rest need the marketplace vault key.
  // Souqna auto-derives a deterministic dev key from CLERK_SECRET_KEY when
  // missing, so this only matters in pristine prod environments.
  const needsVault =
    desc.authKind === 'api_key' ||
    desc.authKind === 'oauth' ||
    desc.id === 'aramex' ||
    desc.id === 'tiktok-pixel';
  if (needsVault && !env.APPS_ENCRYPTION_KEY) {
    setupRequired =
      'This Souqna environment isn\u2019t ready to store private connection tokens yet. Ask your operator to set the APPS_ENCRYPTION_KEY environment variable, then try again.';
  } else if (missingEnv.length > 0) {
    setupRequired = 'This integration isn\u2019t configured for your Souqna environment yet. Reach out to support and we\u2019ll switch it on.';
  }

  return (
    <>
      <PageHeader
        eyebrow={`Apps · ${desc.category}`}
        title={desc.name}
        subtitle={desc.tagline}
        secondaryActions={[{ label: '← Marketplace', href: `/account/apps?store=${slug}` }]}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 340px',
          gap: 20,
          alignItems: 'flex-start',
        }}
        className="souqna-app-grid"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error ? <OAuthErrorBanner code={error} /> : null}

          <Surface padding={20}>
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginBottom: 14,
              }}
            >
              <AppMark app={desc} size={64} />
              <div style={{ minWidth: 0 }}>
                <h2
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-serif, var(--font-sans))',
                    fontWeight: 400,
                    fontSize: 24,
                    color: 'var(--ink-strong)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {desc.name}
                </h2>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: 13,
                    color: 'var(--ink-muted)',
                  }}
                >
                  {desc.vendor} · {desc.category}
                </p>
              </div>
            </header>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                color: 'var(--ink-strong)',
                lineHeight: 1.65,
              }}
            >
              {desc.description}
            </p>
          </Surface>

          {desc.previews && desc.previews.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {desc.previews.map((p) => (
                <Surface key={p.src} padding={0}>
                  <div
                    style={{
                      borderRadius: 14,
                      overflow: 'hidden',
                      background:
                        'color-mix(in srgb, var(--ink-strong) 6%, transparent)',
                      borderBottom: '1px solid var(--surface-rule)',
                    }}
                  >
                    <img
                      src={p.src}
                      alt={p.caption}
                      style={{
                        display: 'block',
                        width: '100%',
                        height: 'auto',
                      }}
                    />
                  </div>
                  <p
                    style={{
                      margin: 0,
                      padding: '12px 16px',
                      fontSize: 12.5,
                      color: 'var(--ink-muted)',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {p.caption}
                  </p>
                </Surface>
              ))}
            </div>
          ) : null}
        </div>

        <InstallPanel
          storefrontSlug={slug}
          appId={desc.id}
          authKind={desc.authKind}
          headline={desc.connectCopy?.headline ?? 'Ready to install'}
          body={desc.connectCopy?.body ?? 'Install this app for this storefront.'}
          ctaLabel={desc.connectCopy?.ctaLabel ?? 'Install'}
          apiKeyHelp={apiKeyHelp[desc.id]}
          setupRequired={setupRequired}
          docs={desc.docs}
          postInstallHref={`/account/apps/${desc.id}/configure?store=${slug}`}
        />
      </div>

      <p
        style={{
          marginTop: 16,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.06em',
          color: 'var(--ink-muted)',
        }}
      >
        Installed only for this storefront. Uninstall anytime — your settings stay until you do.
      </p>

      <style>{`
        @media (max-width: 980px) {
          .souqna-app-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

function OAuthErrorBanner({ code }: { code: string }) {
  const message =
    {
      oauth_denied: 'Connection was cancelled by the provider. Try again when you are ready.',
      oauth_failed:
        'The provider could not complete this connection. Check the setup docs, then try again.',
      invalid_oauth_state:
        'This connection link expired or was already used. Start the connection again from Souqna.',
      oauth_config:
        'Souqna is missing provider setup for this connection. Add the required environment variables before retrying.',
      env: 'Souqna is missing provider credentials for this integration.',
      vault:
        'APPS_ENCRYPTION_KEY is missing, so Souqna cannot store provider tokens safely yet.',
      forbidden: 'This store does not belong to the signed-in account.',
      unavailable: 'This app is not available for connection right now.',
    }[code] ?? 'Connection failed. Try again from Souqna.';
  return (
    <Surface padding={16}>
      <div
        role="alert"
        style={{
          borderRadius: 10,
          border: '1px solid color-mix(in srgb, var(--color-maroon, #8b3a3a) 24%, transparent)',
          background:
            'color-mix(in srgb, var(--color-maroon, #8b3a3a) 9%, transparent)',
          color: 'var(--color-maroon, #8b3a3a)',
          padding: '10px 12px',
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        {message}
      </div>
    </Surface>
  );
}
