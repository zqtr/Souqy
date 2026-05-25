import { auth } from '@clerk/nextjs/server';
import {
  PageHeader,
} from '@/components/admin/primitives';
import { resolveSettingsContext } from '../_helpers';
import { CustomDomainPanel } from '@/components/settings/CustomDomainPanel';
import { PrimaryDomainPanel } from '@/components/settings/PrimaryDomainPanel';
import { getPlan, planAtLeast } from '@/lib/billing';
import { env } from '@/lib/env';
import { getCustomDomainStatus } from '@/lib/vercelDomains';
import { markCustomDomainVerified } from '@/lib/brief';
import { getInstalledApp } from '@/lib/apps/installed';
import { decryptToken } from '@/lib/apps/crypto';
import { listZones, type CloudflareZone } from '@/lib/apps/cloudflare';

export default async function DomainPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const { storefront } = await resolveSettingsContext(sp, '/account/settings/domain');
  const subdomain = `${storefront.slug}.${env.BRIEF_ROOT_DOMAIN}`;
  const backupDomain =
    env.BRIEF_FALLBACK_ROOT_DOMAIN && env.BRIEF_FALLBACK_ROOT_DOMAIN !== env.BRIEF_ROOT_DOMAIN
      ? `${storefront.slug}.${env.BRIEF_FALLBACK_ROOT_DOMAIN}`
      : null;

  const { userId } = await auth();
  const plan = userId ? await getPlan(userId) : 'free';
  const canManage = planAtLeast(plan, 'starter');

  // For an attached-but-not-yet-verified domain, fetch the live state
  // so the dashboard renders accurate DNS records on first paint.
  let dns = storefront.customDomain
    ? [
        storefront.customDomain.split('.').length === 2
          ? { type: 'A' as const, name: '@', value: '76.76.21.21' }
          : {
              type: 'CNAME' as const,
              name: storefront.customDomain.split('.')[0]!,
              value: 'cname.vercel-dns.com',
            },
      ]
    : [];
  let verified = Boolean(storefront.customDomainVerifiedAt);
  if (storefront.customDomain && canManage) {
    try {
      const status = await getCustomDomainStatus(storefront.customDomain);
      dns = status.recommendedDns;
      if (status.verified && status.hasCert) {
        verified = true;
        if (!storefront.customDomainVerifiedAt) {
          await markCustomDomainVerified(storefront.slug, storefront.customDomain);
        }
      }
    } catch {
      // best-effort — fall back to the cached row state
    }
  }

  // Cloudflare auto-setup state. Decrypts the stored token only on the
  // server, fetches the zone list once so the picker renders without a
  // round-trip from the client. Skipped entirely when the founder isn't
  // on a Pro+ plan — the panel hides the auto-setup affordance anyway.
  let cloudflareConnected = false;
  let cloudflareZones: CloudflareZone[] = [];
  if (canManage) {
    try {
      const installed = await getInstalledApp(storefront.slug, 'cloudflare');
      if (installed) {
        const token = decryptToken(installed.oauthAccessTokenCt);
        if (token) {
          cloudflareConnected = true;
          cloudflareZones = await listZones(token);
        }
      }
    } catch {
      // best-effort — the panel handles "connected with no zones"
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Store · Domain"
        title="Domain"
        subtitle="Your storefront's web address."
      />

      <PrimaryDomainPanel
        slug={storefront.slug}
        primaryDomain={subdomain}
        backupDomain={backupDomain}
        status={storefront.subdomainStatus}
        error={storefront.subdomainError}
      />

      <CustomDomainPanel
        slug={storefront.slug}
        initialDomain={storefront.customDomain}
        initialVerified={verified}
        initialDns={dns}
        canManage={canManage}
        cloudflareConnected={cloudflareConnected}
        cloudflareZones={cloudflareZones}
      />
    </>
  );
}
