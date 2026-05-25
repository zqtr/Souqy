'use server';

/**
 * Custom-domain server actions.
 *
 *   attachCustomDomain(slug, host)
 *     Plan-gated to Pro+. Validates the hostname, registers it on the
 *     Vercel project, and writes it onto the storefront row. Idempotent
 *     re-attach is allowed (founder retries without first detaching).
 *
 *   detachCustomDomain(slug)
 *     Removes the hostname from Vercel and clears all three columns on
 *     the storefront row. Safe to call when nothing is attached.
 *
 *   verifyCustomDomain(slug)
 *     Re-polls Vercel for verification + cert state. Stamps
 *     `custom_domain_verified_at` once the cert is live so the
 *     middleware lookup starts honouring the host. Returns the snapshot
 *     so the dashboard can re-render without a separate fetch.
 *
 * All three:
 *   - require an authenticated Clerk session,
 *   - assert the caller owns `slug`,
 *   - record an audit row,
 *   - revalidate the settings page so the founder sees the change.
 *
 * Plan gating:
 *   `attach` and `verify` require `pro` or above. `detach` is
 *   always allowed so a downgrade can clean up gracefully.
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
  getStorefront,
} from '@/lib/brief';
import {
  addCustomDomain,
  removeCustomDomain,
  getCustomDomainStatus,
  type CustomDomainStatus,
} from '@/lib/vercelDomains';
import { invalidateCustomDomainCache } from '@/lib/customDomainLookup';
import { env } from '@/lib/env';

export type CustomDomainResult =
  | {
      status: 'success';
      domain: string | null;
      verified: boolean;
      vercel: CustomDomainStatus | null;
    }
  | { status: 'error'; message: string; code?: string };

/**
 * Reject inputs that obviously can't become real hostnames before we
 * spend a Vercel API call on them. The 253-char limit and label rules
 * follow RFC 1035; the explicit `.souqna.qa` block prevents a founder
 * from "attaching" what is already their free subdomain (and from
 * grabbing someone else's by accident).
 */
const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

function normalizeHost(raw: string): string | null {
  const trimmed = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+.*$/, '')
    .replace(/^www\./, '');
  if (!trimmed || !HOSTNAME_RE.test(trimmed)) return null;
  // Founders shouldn't claim something on our root domain — that path
  // is owned by the wildcard subdomain pipeline.
  const ownedRoots = [env.BRIEF_ROOT_DOMAIN, env.BRIEF_FALLBACK_ROOT_DOMAIN].filter(Boolean);
  if (ownedRoots.some((root) => trimmed === root || trimmed.endsWith(`.${root}`))) {
    return null;
  }
  // No multi-segment ports / IPs / pure-numeric labels.
  if (/^\d+$/.test(trimmed.split('.')[0]!)) return null;
  return trimmed;
}

const attachSchema = z.object({
  slug: z.string().min(1),
  domain: z.string().min(3).max(253),
});

export async function attachCustomDomain(input: {
  slug: string;
  domain: string;
}): Promise<CustomDomainResult> {
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in to manage domains.' };

  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Invalid input.', code: 'invalid_input' };
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

  const host = normalizeHost(parsed.data.domain);
  if (!host) {
    return {
      status: 'error',
      message: 'That doesn’t look like a valid hostname.',
      code: 'invalid_host',
    };
  }

  const attach = await addCustomDomain(host);
  if (!attach.ok) {
    return { status: 'error', message: attach.message, code: attach.code };
  }

  const updated = await setCustomDomain(parsed.data.slug, host);
  if (!updated) {
    // Vercel registered it but the row update failed — roll back the
    // Vercel side so we don't leak a hostname attached to no storefront.
    await removeCustomDomain(host);
    return { status: 'error', message: 'Could not save the domain. Please try again.' };
  }

  invalidateCustomDomainCache(host);
  await recordAudit({
    storefrontSlug: parsed.data.slug,
    clerkUserId: userId,
    action: 'storefront.domain.attach',
    targetId: parsed.data.slug,
    summary: `Attached custom domain ${host}`,
    meta: { domain: host, vercelStatus: attach.status },
  });

  // Probe verification state immediately so the dashboard renders the
  // accurate "pending DNS" / "verified" badge on the same response.
  let vercel: CustomDomainStatus | null = null;
  try {
    vercel = await getCustomDomainStatus(host);
    if (vercel.verified && vercel.hasCert) {
      await markCustomDomainVerified(parsed.data.slug, host);
    }
  } catch {
    // Best-effort — the founder can hit "Verify" again from the UI.
  }

  revalidatePath('/account/settings/domain');
  return {
    status: 'success',
    domain: host,
    verified: Boolean(vercel?.verified && vercel.hasCert),
    vercel,
  };
}

export async function detachCustomDomain(input: {
  slug: string;
}): Promise<CustomDomainResult> {
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in to manage domains.' };

  const owner = await assertStorefrontOwner(input.slug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden', code: 'forbidden' };

  const previous = owner.customDomain;
  if (previous) {
    await removeCustomDomain(previous);
    invalidateCustomDomainCache(previous);
  }
  await setCustomDomain(input.slug, null);

  await recordAudit({
    storefrontSlug: input.slug,
    clerkUserId: userId,
    action: 'storefront.domain.detach',
    targetId: input.slug,
    summary: previous ? `Removed custom domain ${previous}` : 'Cleared custom domain',
    meta: { previous },
  });

  revalidatePath('/account/settings/domain');
  return { status: 'success', domain: null, verified: false, vercel: null };
}

export async function verifyCustomDomain(input: {
  slug: string;
}): Promise<CustomDomainResult> {
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in to manage domains.' };

  const owner = await assertStorefrontOwner(input.slug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden', code: 'forbidden' };

  const plan = await getPlan(userId);
  if (!planAtLeast(plan, 'starter')) {
    return {
      status: 'error',
      message: 'Custom domains are available on Pro and above.',
      code: 'paywall',
    };
  }

  const sf = await getStorefront(input.slug);
  const host = sf?.customDomain ?? null;
  if (!host) {
    return { status: 'error', message: 'No domain attached.', code: 'no_domain' };
  }

  const vercel = await getCustomDomainStatus(host);
  if (vercel.verified && vercel.hasCert) {
    await markCustomDomainVerified(input.slug, host);
    invalidateCustomDomainCache(host);
  }

  revalidatePath('/account/settings/domain');
  return {
    status: 'success',
    domain: host,
    verified: Boolean(vercel.verified && vercel.hasCert),
    vercel,
  };
}
