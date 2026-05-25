import { unstable_noStore as noStore } from 'next/cache';
import { db } from './db';
import { getStorefront } from './brief';

/**
 * Data layer for the M2 Settings panels: store policies and checkout
 * settings. Both live as columns on `briefs` (see migration 016) and
 * are mapped onto the wide `Storefront` type by `fromRow` in
 * `brief.ts`. The accessors here are typed projections that delegate
 * to `getStorefront` so they share its per-request `cache()`.
 *
 * The `CheckoutSettings` type is intentionally distinct from
 * `Storefront` because checkout will likely be normalised into its
 * own table (per-channel checkout, A/B variants, multi-currency)
 * later — UI consumers should depend on this narrow shape rather
 * than read straight off `Storefront.checkout`.
 */

export type StorefrontPolicies = {
  terms: string | null;
  privacy: string | null;
  refund: string | null;
  shipping: string | null;
};

export type PolicyKey = keyof StorefrontPolicies;
export const POLICY_KEYS = ['terms', 'privacy', 'refund', 'shipping'] as const satisfies readonly PolicyKey[];

export type PaymentMethod = 'cod' | 'bank_transfer' | 'skipcash' | 'sadad' | 'pay_link';
export const PAYMENT_METHODS = [
  'cod',
  'bank_transfer',
  'skipcash',
  'sadad',
  'pay_link',
] as const satisfies readonly PaymentMethod[];
export const CONFIGURABLE_PAYMENT_METHODS = [
  'cod',
  'bank_transfer',
  'skipcash',
  'sadad',
] as const satisfies readonly PaymentMethod[];

export type BankDetails = {
  accountName: string;
  iban: string;
  bankName: string;
  swift?: string | null;
  notes?: string | null;
};

export type PayLink = {
  url: string;
  label: string;
};

export type SkipCashSettings = {
  hasCredentials: boolean;
  clientIdHint: string | null;
  enabled: boolean;
  crConfirmedAt: string | null;
};

export type SadadSettings = {
  hasCredentials: boolean;
  merchantIdHint: string | null;
  websiteHint: string | null;
  verifiedMode: 'live' | 'sandbox' | null;
  verifiedAt: string | null;
  enabled: boolean;
};

export type CheckoutSettings = {
  paymentMethods: PaymentMethod[];
  bankDetails: BankDetails | null;
  payLink: PayLink | null;
  skipCash: SkipCashSettings | null;
  sadad: SadadSettings | null;
  requiredPolicies: PolicyKey[];
  currency: string;
  minOrderQar: number | null;
  shippingFlatQar: number | null;
};

export const EMPTY_POLICIES: StorefrontPolicies = {
  terms: null,
  privacy: null,
  refund: null,
  shipping: null,
};

export const DEFAULT_CHECKOUT_SETTINGS: CheckoutSettings = {
  paymentMethods: ['cod', 'bank_transfer'],
  bankDetails: null,
  payLink: null,
  skipCash: null,
  sadad: null,
  requiredPolicies: ['terms', 'privacy', 'refund'],
  currency: 'QAR',
  minOrderQar: null,
  shippingFlatQar: null,
};

/**
 * Both accessors delegate to `getStorefront` so they share the
 * per-request `cache()` with every other code path that already loaded
 * the row (settings layout, builder, public page). The dedicated
 * fields live as plain columns on `briefs` and are mapped in
 * `fromRow`, so this is just a typed projection.
 */
export async function getStorefrontPolicies(slug: string): Promise<StorefrontPolicies> {
  noStore();
  const sf = await getStorefront(slug);
  if (!sf) return { ...EMPTY_POLICIES };
  return sf.policies;
}

export async function getStorefrontCheckoutSettings(slug: string): Promise<CheckoutSettings> {
  noStore();
  const sf = await getStorefront(slug);
  if (!sf) return { ...DEFAULT_CHECKOUT_SETTINGS };
  return sf.checkout;
}

/**
 * Internal-only writers. The public action surface lives in
 * `src/app/actions/storefrontSettings.ts`; these are colocated with
 * the loaders so the SQL stays in one file and keeps tagged-template
 * usage uniform.
 */
export async function writeStorefrontPolicies(
  slug: string,
  patch: StorefrontPolicies,
): Promise<void> {
  await db()`
    update briefs set
      policies_terms    = ${patch.terms},
      policies_privacy  = ${patch.privacy},
      policies_refund   = ${patch.refund},
      policies_shipping = ${patch.shipping}
    where slug = ${slug} and expires_at > now()
  `;
}

export async function writeStorefrontCheckoutSettings(
  slug: string,
  patch: CheckoutSettings,
): Promise<void> {
  const bankJson = patch.bankDetails ? JSON.stringify(patch.bankDetails) : null;
  await db()`
    update briefs set
      checkout_payment_methods   = ${patch.paymentMethods as unknown as string},
      checkout_bank_details      = ${bankJson}::jsonb,
      checkout_pay_link_url      = ${patch.payLink?.url ?? null},
      checkout_pay_link_label    = ${patch.payLink?.label ?? null},
      checkout_required_policies = ${patch.requiredPolicies as unknown as string},
      checkout_currency          = ${patch.currency},
      checkout_min_order_qar     = ${patch.minOrderQar},
      checkout_shipping_flat_qar = ${patch.shippingFlatQar}
    where slug = ${slug} and expires_at > now()
  `;
}

export type EncryptedSkipCashCredentials = {
  v: 1;
  ct: string;
  clientIdHint: string | null;
  updatedAt: string;
};

export type EncryptedSadadCredentials = {
  v: 1;
  ct: string;
  merchantIdHint: string | null;
  websiteHint: string | null;
  verifiedMode?: 'live' | 'sandbox';
  verifiedAt?: string;
  updatedAt: string;
};

export async function writeStorefrontSkipCashSetup(
  slug: string,
  input: {
    credentials?: EncryptedSkipCashCredentials | null;
    confirmCr?: boolean;
  },
): Promise<void> {
  const credentialsJson =
    input.credentials === undefined ? undefined : input.credentials ? JSON.stringify(input.credentials) : null;
  if (credentialsJson !== undefined && input.confirmCr) {
    await db()`
      update briefs set
        checkout_skipcash_credentials = ${credentialsJson}::jsonb,
        cr_confirmed_at = coalesce(cr_confirmed_at, now())
      where slug = ${slug} and expires_at > now()
    `;
    return;
  }
  if (credentialsJson !== undefined) {
    await db()`
      update briefs set checkout_skipcash_credentials = ${credentialsJson}::jsonb
      where slug = ${slug} and expires_at > now()
    `;
    return;
  }
  if (input.confirmCr) {
    await db()`
      update briefs set cr_confirmed_at = coalesce(cr_confirmed_at, now())
      where slug = ${slug} and expires_at > now()
    `;
  }
}

export async function writeStorefrontSadadSetup(
  slug: string,
  credentials: EncryptedSadadCredentials | null,
): Promise<void> {
  const credentialsJson = credentials ? JSON.stringify(credentials) : null;
  await db()`
    update briefs set checkout_sadad_credentials = ${credentialsJson}::jsonb
    where slug = ${slug} and expires_at > now()
  `;
}
