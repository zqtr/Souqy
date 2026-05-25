'use server';

/**
 * Cloudflare custom-domain server actions.
 *
 *   connectCloudflare({ slug, token })
 *     Verifies a scoped Cloudflare API token, encrypts it with
 *     APPS_ENCRYPTION_KEY, and persists it on the storefront's
 *     `installed_apps` row (`app_id = 'cloudflare'`). Returns the list
 *     of zones the token can see so the dashboard can render the
 *     picker without a follow-up round-trip.
 *
 *   setupCloudflareDomain({ slug, zoneId, host })
 *     End-to-end automation. Decrypts the stored token, writes the
 *     correct DNS record (A for apex, CNAME for subdomain) into the
 *     chosen zone via `upsertDnsRecord`, then attaches the host on the
 *     Vercel project and polls verification for ~10s. On success the
 *     storefront row's `custom_domain_*` columns are updated through
 *     the existing `setCustomDomain` / `markCustomDomainVerified` helpers
 *     so the middleware lookup starts honouring the host immediately.
 *
 *   disconnectCloudflare({ slug })
 *     Removes the stored token. Deliberately does NOT detach any
 *     attached domain — a founder might want to keep the domain on
 *     manual DNS after revoking Cloudflare access.
 *
 * Plan gating: connect + setup require Pro+. Disconnect is always
 * allowed so a downgrade can clean up. Every action runs the standard
 * Clerk-auth + `assertStorefrontOwner` guard and writes an audit row.
 */

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { assertStorefrontOwner } from '@/lib/products';
import { recordAudit } from '@/lib/audit';
import { getPlan, planAtLeast } from '@/lib/billing';
import {
  setCustomDomain,
  markCustomDomainVerified,
} from '@/lib/brief';
import {
  addCustomDomain,
  getCustomDomainStatus,
  removeCustomDomain,
} from '@/lib/vercelDomains';
import { invalidateCustomDomainCache } from '@/lib/customDomainLookup';
import {
  installApp,
  getInstalledApp,
  uninstallApp,
} from '@/lib/apps/installed';
import { encryptToken, decryptToken } from '@/lib/apps/crypto';
import {
  listZones,
  upsertDnsRecord,
  verifyToken,
  type CloudflareZone,
} from '@/lib/apps/cloudflare';
import { env } from '@/lib/env';

const APP_ID = 'cloudflare';

export type CloudflareActionResult =
  | { status: 'success'; zones?: CloudflareZone[]; domain?: string; verified?: boolean }
  | { status: 'error'; message: string; code?: string };

/**
 * Hostname validation duplicated (in shape) from `customDomain.ts`. We
 * can't re-import that file's helper because `customDomain.ts` is a
 * `'use server'` module and only exports actions. Keeping this function
 * private and aligned with the upstream regex is the simplest path; if
 * either rule changes both should change together.
 */
const HOSTNAME_RE =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

function normalizeHost(raw: string): string | null {
  const trimmed = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+.*$/, '')
    .replace(/^www\./, '');
  if (!trimmed || !HOSTNAME_RE.test(trimmed)) return null;
  const ownedRoots = [env.BRIEF_ROOT_DOMAIN, env.BRIEF_FALLBACK_ROOT_DOMAIN].filter(Boolean);
  if (ownedRoots.some((root) => trimmed === root || trimmed.endsWith(`.${root}`))) {
    return null;
  }
  if (/^\d+$/.test(trimmed.split('.')[0]!)) return null;
  return trimmed;
}

/**
 * For a host on a given zone, return the record we want Cloudflare to
 * publish. Apex (host === zone) uses A → 76.76.21.21; everything else
 * uses CNAME → cname.vercel-dns.com. The `name` is what Cloudflare's
 * API expects: `@` for the apex of the zone, the bare subdomain label
 * (`shop`) when the host is one level below, or the fully-qualified
 * host when it's multi-level (`shop.eu.brand.com` on `brand.com`).
 */
function recordForHost(
  host: string,
  zoneName: string,
): { type: 'A' | 'CNAME'; name: string; content: string } {
  const lowerZone = zoneName.toLowerCase();
  const lowerHost = host.toLowerCase();
  if (lowerHost === lowerZone) {
    return { type: 'A', name: '@', content: '76.76.21.21' };
  }
  if (!lowerHost.endsWith(`.${lowerZone}`)) {
    // Host doesn't actually live under the chosen zone. Fall back to
    // the FQDN — Cloudflare will reject with 1004 and we surface the
    // friendly message in the action.
    return { type: 'CNAME', name: lowerHost, content: 'cname.vercel-dns.com' };
  }
  const label = lowerHost.slice(0, -1 * (`.${lowerZone}`.length));
  // Single-level subdomain → just the label. Nested → full FQDN.
  return {
    type: 'CNAME',
    name: label.includes('.') ? lowerHost : label,
    content: 'cname.vercel-dns.com',
  };
}

const ConnectSchema = z.object({
  slug: z.string().min(1),
  token: z.string().min(20).max(200),
});

export async function connectCloudflare(
  input: z.input<typeof ConnectSchema>,
): Promise<CloudflareActionResult> {
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in to connect Cloudflare.' };

  const parsed = ConnectSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Invalid request.', code: 'invalid_input' };
  }
  const owner = await assertStorefrontOwner(parsed.data.slug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden', code: 'forbidden' };

  const plan = await getPlan(userId);
  if (!planAtLeast(plan, 'starter')) {
    return {
      status: 'error',
      message: 'Custom domains are available on Pro and above.',
      code: 'paywall',
    };
  }

  const verify = await verifyToken(parsed.data.token);
  if (!verify.ok) {
    return { status: 'error', message: verify.message, code: 'invalid_token' };
  }

  let ct: string;
  try {
    ct = encryptToken(parsed.data.token);
  } catch (err) {
    console.error('[connectCloudflare] encrypt failed', err);
    return {
      status: 'error',
      message:
        'APPS_ENCRYPTION_KEY is missing on the server. Set it before connecting Cloudflare.',
      code: 'no_encryption_key',
    };
  }

  await installApp(parsed.data.slug, {
    appId: APP_ID,
    installedBy: userId,
    accessTokenCt: ct,
    providerAccount: { source: 'api_token' },
  });

  await recordAudit({
    storefrontSlug: parsed.data.slug,
    clerkUserId: userId,
    action: 'storefront.domain.cloudflare_connect',
    targetId: parsed.data.slug,
    summary: 'Connected Cloudflare for custom domain DNS',
  });

  const zones = await listZones(parsed.data.token);
  revalidatePath('/account/settings/domain');
  return { status: 'success', zones };
}

const SetupSchema = z.object({
  slug: z.string().min(1),
  zoneId: z.string().min(1).max(64),
  host: z.string().min(3).max(253),
});

export async function setupCloudflareDomain(
  input: z.input<typeof SetupSchema>,
): Promise<CloudflareActionResult> {
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in to manage domains.' };

  const parsed = SetupSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Invalid request.', code: 'invalid_input' };
  }
  const owner = await assertStorefrontOwner(parsed.data.slug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden', code: 'forbidden' };

  const plan = await getPlan(userId);
  if (!planAtLeast(plan, 'starter')) {
    return {
      status: 'error',
      message: 'Custom domains are available on Pro and above.',
      code: 'paywall',
    };
  }

  const host = normalizeHost(parsed.data.host);
  if (!host) {
    return {
      status: 'error',
      message: 'That doesn’t look like a valid hostname.',
      code: 'invalid_host',
    };
  }

  const installed = await getInstalledApp(parsed.data.slug, APP_ID);
  if (!installed) {
    return {
      status: 'error',
      message: 'Cloudflare isn’t connected yet — connect it first.',
      code: 'not_connected',
    };
  }
  const token = decryptToken(installed.oauthAccessTokenCt);
  if (!token) {
    return {
      status: 'error',
      message: 'Stored Cloudflare token is unreadable. Reconnect Cloudflare and try again.',
      code: 'decrypt_failed',
    };
  }

  // Look up the zone name so we can pick A vs CNAME and craft the
  // correct `name` field. Doing this server-side (rather than trusting
  // a label posted from the client) keeps the action self-contained.
  const zones = await listZones(token);
  const zone = zones.find((z) => z.id === parsed.data.zoneId);
  if (!zone) {
    return {
      status: 'error',
      message: 'That Cloudflare zone is no longer accessible to this token.',
      code: 'unknown_zone',
    };
  }

  const record = recordForHost(host, zone.name);
  const dns = await upsertDnsRecord(token, zone.id, record);
  if (!dns.ok) {
    return { status: 'error', message: dns.message, code: dns.code };
  }

  // Now do the Vercel side. Re-uses the same plumbing as the manual
  // path so cert issuance + DB bookkeeping stay in one place.
  const attach = await addCustomDomain(host);
  if (!attach.ok) {
    return { status: 'error', message: attach.message, code: attach.code };
  }
  const updated = await setCustomDomain(parsed.data.slug, host);
  if (!updated) {
    await removeCustomDomain(host);
    return { status: 'error', message: 'Could not save the domain. Please try again.' };
  }
  invalidateCustomDomainCache(host);

  // Cloudflare DNS propagates within seconds inside Cloudflare's own
  // recursors, so a short poll usually catches the verified state on
  // the first attempt. Cap at ~10s so the action stays responsive.
  let verified = false;
  for (let i = 0; i < 5; i++) {
    const status = await getCustomDomainStatus(host);
    if (status.verified && status.hasCert) {
      verified = true;
      await markCustomDomainVerified(parsed.data.slug, host);
      invalidateCustomDomainCache(host);
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  await recordAudit({
    storefrontSlug: parsed.data.slug,
    clerkUserId: userId,
    action: 'storefront.domain.cloudflare_attach',
    targetId: parsed.data.slug,
    summary: `Auto-configured ${host} via Cloudflare`,
    meta: {
      domain: host,
      zoneId: zone.id,
      zoneName: zone.name,
      record,
      verified,
    },
  });

  revalidatePath('/account/settings/domain');
  return { status: 'success', domain: host, verified };
}

const DisconnectSchema = z.object({
  slug: z.string().min(1),
});

export async function disconnectCloudflare(
  input: z.input<typeof DisconnectSchema>,
): Promise<CloudflareActionResult> {
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in.' };

  const parsed = DisconnectSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Invalid request.', code: 'invalid_input' };
  }
  const owner = await assertStorefrontOwner(parsed.data.slug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden', code: 'forbidden' };

  await uninstallApp(parsed.data.slug, APP_ID);
  await recordAudit({
    storefrontSlug: parsed.data.slug,
    clerkUserId: userId,
    action: 'storefront.domain.cloudflare_disconnect',
    targetId: parsed.data.slug,
    summary: 'Disconnected Cloudflare from custom domain DNS',
  });

  revalidatePath('/account/settings/domain');
  return { status: 'success' };
}
