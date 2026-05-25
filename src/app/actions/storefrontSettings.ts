'use server';

/**
 * Storefront settings actions.
 *
 *   saveStorefrontSettings(input)
 *     Generic per-section save for the dashboard's Settings panels
 *     (general, brand, contact, languages, policies, notifications,
 *     customer-accounts). Validates a per-field schema and writes
 *     either to first-class columns (general / brand / contact /
 *     policies) or to ancillary audit metadata (notifications,
 *     customer-accounts) until those grow dedicated columns.
 *
 *   updateCheckoutSettings(input)
 *     Dedicated checkout configuration writer. Front-end contract:
 *
 *     {
 *       slug: string,
 *       paymentMethods: Array<'cod'|'bank_transfer'|'skipcash'|'sadad'>,
 *       bankDetails: { accountName, iban, bankName, swift?, notes? } | null,
 *       skipCash: { clientId, keyId, keySecret, webhookKey?, confirmCr? } | null,
 *       sadad: { merchantId, website, secretKey } | null,
 *       requiredPolicies: Array<'terms'|'privacy'|'refund'|'shipping'>,
 *       currency: string,
 *       minOrderQar: number | null,
 *       shippingFlatQar: number | null,
 *     }
 *
 *     Returns `{ status: 'success' | 'error', message?, field? }` so
 *     forms can surface per-field validation errors. Validation is
 *     conditional on the selected payment methods (IBAN required when
 *     bank_transfer is in the list, CR confirmation + merchant credentials
 *     required when skipcash is in the list, SADAD credentials required
 *     when sadad is in the list) and on the configured policies (you
 *     can't require a policy you haven't written yet).
 */

import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import {
  getStorefront,
  updateStorefront,
  type UpdateStorefrontInput,
} from '@/lib/brief';
import { assertStorefrontOwner } from '@/lib/products';
import { recordAudit } from '@/lib/audit';
import { PALETTE_IDS } from '@/lib/palettes';
import {
  CONFIGURABLE_PAYMENT_METHODS,
  POLICY_KEYS,
  writeStorefrontCheckoutSettings,
  writeStorefrontSadadSetup,
  writeStorefrontSkipCashSetup,
  writeStorefrontPolicies,
  type CheckoutSettings,
  type PaymentMethod,
  type PolicyKey,
  type StorefrontPolicies,
} from '@/lib/storefrontSettings';
import { encryptToken } from '@/lib/apps/crypto';
import { verifySadadCredentials } from '@/lib/sadad';

/**
 * Settings actions — the dashboard's update-anything write path. The
 * legacy edit page used a single full-form submit; the new Settings
 * surfaces are split into focused per-section panels (general / brand /
 * contact) and each panel posts only the fields it owns. We collapse
 * those into one action because:
 *
 *   - the persistence is the same (`updateStorefront`)
 *   - the ownership check is the same (active store must belong to the
 *     calling Clerk user)
 *   - the audit-log entry is the same shape
 *
 * The action takes a partial patch + the section name. Fields not
 * present in the patch are read off the current row and re-written
 * unchanged, so the underlying `updateStorefront` (which expects a
 * full record) stays simple.
 */
export type SettingsActionState =
  | { status: 'idle' }
  | { status: 'success'; updatedAt: string }
  | { status: 'error'; message: string };

const PatchSchema = z.object({
  slug: z.string().trim().min(1).max(64),
  section: z.enum([
    'general',
    'brand',
    'contact',
    'languages',
    'policies',
    'notifications',
    'customer-accounts',
  ]),
  // Generic free-form patch. Validated per-field below to give the
  // founder per-field error feedback rather than a single zod blob.
  patch: z.record(z.string(), z.unknown()),
});

const FIELD_SCHEMAS: Record<string, z.ZodTypeAny> = {
  founderName: z.string().trim().min(1).max(120),
  businessName: z.string().trim().min(1).max(120),
  tagline: z
    .string()
    .trim()
    .max(280)
    .nullable()
    .optional()
    .transform((v) => (v == null ? null : v)),
  phone: z.string().trim().max(40).nullable().optional(),
  area: z.string().trim().max(120).nullable().optional(),
  hours: z.string().trim().max(280).nullable().optional(),
  instagram: z.string().trim().max(120).nullable().optional(),
  logoUrl: z
    .string()
    .url()
    .max(2048)
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  faviconUrl: z
    .string()
    .url()
    .max(2048)
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  crNumber: z.string().trim().max(64).nullable().optional(),
  palette: z.enum(PALETTE_IDS as unknown as [string, ...string[]]),
  notificationsConfig: z.record(z.string(), z.boolean()).optional(),
  policies: z
    .object({
      terms: z.string().trim().max(20000).optional(),
      privacy: z.string().trim().max(20000).optional(),
      refund: z.string().trim().max(20000).optional(),
      shipping: z.string().trim().max(20000).optional(),
    })
    .optional(),
  customerAccounts: z
    .object({
      mode: z.enum(['off', 'optional', 'required']),
    })
    .optional(),
};

function validateField(field: string, value: unknown): unknown {
  const schema = FIELD_SCHEMAS[field];
  if (!schema) {
    throw new Error(`Field '${field}' is not editable from settings.`);
  }
  return schema.parse(value);
}

export async function saveStorefrontSettings(
  input: z.input<typeof PatchSchema>,
): Promise<SettingsActionState> {
  const parsed = PatchSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Invalid request payload.' };
  }

  const { userId } = await auth();
  if (!userId) {
    return { status: 'error', message: 'Sign in to save changes.' };
  }

  const current = await getStorefront(parsed.data.slug);
  if (!current || current.clerkUserId !== userId) {
    return { status: 'error', message: 'Storefront not found.' };
  }

  // Validate every patch field independently. A bad value short-circuits
  // before we touch the DB.
  const validated: Record<string, unknown> = {};
  try {
    for (const [k, v] of Object.entries(parsed.data.patch)) {
      validated[k] = validateField(k, v);
    }
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Invalid field value.',
    };
  }

  // Build the full record `updateStorefront` expects: start with the
  // current row, apply the patch on top.
  const next: UpdateStorefrontInput = {
    founderName: (validated.founderName as string) ?? current.founderName,
    businessName: (validated.businessName as string) ?? current.businessName,
    ownership: current.ownership,
    experience: current.experience,
    businessType: current.businessType,
    marketVolume: current.marketVolume,
    payments: current.payments,
    tagline: 'tagline' in validated ? (validated.tagline as string | null) : current.tagline,
    phone: 'phone' in validated ? (validated.phone as string | null) : current.phone,
    area: 'area' in validated ? (validated.area as string | null) : current.area,
    hours: 'hours' in validated ? (validated.hours as string | null) : current.hours,
    instagram: 'instagram' in validated ? (validated.instagram as string | null) : current.instagram,
    logoUrl: 'logoUrl' in validated ? (validated.logoUrl as string | null) : current.logoUrl,
    faviconUrl: 'faviconUrl' in validated ? (validated.faviconUrl as string | null) : current.faviconUrl,
    design: current.design,
    palette: ('palette' in validated
      ? (validated.palette as typeof current.palette)
      : current.palette),
    templateId: current.templateId,
    crNumber: 'crNumber' in validated ? (validated.crNumber as string | null) : current.crNumber,
  };

  // Notifications and customer-accounts still live in audit metadata
  // until they grow dedicated columns. Policies graduate to first-class
  // `policies_*` columns in migration 016 — extract here and write
  // alongside the main `updateStorefront` call so a single section
  // submit is one logical save.
  const ancillary: Record<string, unknown> = {};
  for (const k of ['notificationsConfig', 'customerAccounts']) {
    if (k in validated) ancillary[k] = validated[k];
  }

  let policiesPatch: StorefrontPolicies | null = null;
  if ('policies' in validated && validated.policies) {
    const p = validated.policies as {
      terms?: string;
      privacy?: string;
      refund?: string;
      shipping?: string;
    };
    const norm = (v: string | undefined): string | null => {
      if (typeof v !== 'string') return null;
      const t = v.trim();
      return t.length === 0 ? null : t;
    };
    policiesPatch = {
      terms: 'terms' in p ? norm(p.terms) : current.policies.terms,
      privacy: 'privacy' in p ? norm(p.privacy) : current.policies.privacy,
      refund: 'refund' in p ? norm(p.refund) : current.policies.refund,
      shipping: 'shipping' in p ? norm(p.shipping) : current.policies.shipping,
    };
  }

  try {
    await updateStorefront(parsed.data.slug, next);
    if (policiesPatch) {
      await writeStorefrontPolicies(parsed.data.slug, policiesPatch);
    }
    await recordAudit({
      storefrontSlug: parsed.data.slug,
      clerkUserId: userId,
      action: `settings.${parsed.data.section}`,
      targetId: parsed.data.slug,
      summary: `Updated ${parsed.data.section} settings`,
      meta: policiesPatch
        ? {
            ...ancillary,
            policiesPresent: {
              terms: policiesPatch.terms !== null,
              privacy: policiesPatch.privacy !== null,
              refund: policiesPatch.refund !== null,
              shipping: policiesPatch.shipping !== null,
            },
          }
        : { ...validated, ...ancillary },
    });
  } catch {
    return { status: 'error', message: 'Save failed. Try again.' };
  }

  // Revalidate every settings page so the read after the write reflects
  // the change. Cheap because they're all SSR-cached at request scope.
  revalidatePath('/account', 'layout');

  return { status: 'success', updatedAt: new Date().toISOString() };
}

export type CheckoutActionState =
  | { status: 'idle' }
  | { status: 'success'; updatedAt: string }
  | { status: 'error'; message: string; field?: string };

const IBAN_REGEX = /^[A-Z]{2}[0-9A-Z]{13,32}$/;
const CURRENCY_REGEX = /^[A-Z]{3}$/;

const BankDetailsSchema = z.object({
  accountName: z.string().trim().min(1).max(120),
  iban: z
    .string()
    .trim()
    .max(34)
    .transform((v) => v.replace(/\s+/g, '').toUpperCase()),
  bankName: z.string().trim().min(1).max(120),
  swift: z
    .string()
    .trim()
    .max(11)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v.toUpperCase() : null)),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

const PayLinkSchema = z.object({
  url: z.string().trim().url().max(2048),
  label: z.string().trim().min(1).max(80),
});

const SkipCashSetupSchema = z.object({
  clientId: z.string().trim().max(240).optional().default(''),
  keyId: z.string().trim().max(240).optional().default(''),
  keySecret: z.string().trim().max(2000).optional().default(''),
  webhookKey: z.string().trim().max(2000).optional().default(''),
  confirmCr: z.boolean().optional().default(false),
});

const SadadSetupSchema = z.object({
  merchantId: z.string().trim().max(120).optional().default(''),
  website: z.string().trim().max(240).optional().default(''),
  secretKey: z.string().trim().max(2000).optional().default(''),
});

const CheckoutInputSchema = z.object({
  slug: z.string().trim().min(1).max(64),
  paymentMethods: z
    .array(z.enum(CONFIGURABLE_PAYMENT_METHODS as unknown as [PaymentMethod, ...PaymentMethod[]]))
    .min(1, 'Pick at least one payment method.')
    .transform((arr) => Array.from(new Set(arr)) as PaymentMethod[]),
  bankDetails: BankDetailsSchema.nullable(),
  payLink: PayLinkSchema.nullable(),
  skipCash: SkipCashSetupSchema.nullable().optional(),
  sadad: SadadSetupSchema.nullable().optional(),
  requiredPolicies: z
    .array(z.enum(POLICY_KEYS as unknown as [PolicyKey, ...PolicyKey[]]))
    .transform((arr) => Array.from(new Set(arr)) as PolicyKey[]),
  currency: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => CURRENCY_REGEX.test(v), {
      message: 'Currency must be a 3-letter ISO 4217 code.',
    })
    .default('QAR'),
  minOrderQar: z.number().int().min(0).max(1_000_000).nullable(),
  shippingFlatQar: z.number().int().min(0).max(1_000_000).nullable(),
});

export type UpdateCheckoutSettingsInput = z.input<typeof CheckoutInputSchema>;

function maskIban(iban: string): string {
  const trimmed = iban.replace(/\s+/g, '');
  if (trimmed.length <= 4) return '••••';
  return `••••${trimmed.slice(-4)}`;
}

export async function updateCheckoutSettings(
  input: UpdateCheckoutSettingsInput,
): Promise<CheckoutActionState> {
  const parsed = CheckoutInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      status: 'error',
      message: issue?.message ?? 'Invalid checkout settings.',
      field: issue?.path?.[0] as string | undefined,
    };
  }
  const data = parsed.data;

  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in to save changes.' };

  const owner = await assertStorefrontOwner(data.slug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };

  if (data.paymentMethods.includes('bank_transfer')) {
    if (!data.bankDetails) {
      return {
        status: 'error',
        message: 'Bank details are required when bank transfer is enabled.',
        field: 'bankDetails',
      };
    }
    if (!IBAN_REGEX.test(data.bankDetails.iban)) {
      return {
        status: 'error',
        message: 'IBAN must be 2 letters followed by 13–32 alphanumerics.',
        field: 'iban',
      };
    }
  }

  const skipCashSelected = data.paymentMethods.includes('skipcash');
  const skipCashFields = data.skipCash ?? null;
  const providedSkipCashCredentials = Boolean(
    skipCashFields?.clientId ||
      skipCashFields?.keyId ||
      skipCashFields?.keySecret ||
      skipCashFields?.webhookKey,
  );

  if (skipCashSelected) {
    if (!owner.crNumber || owner.crNumber.trim().length === 0) {
      return {
        status: 'error',
        message: 'Add your CR number in Brand settings before enabling SkipCash.',
        field: 'paymentMethods',
      };
    }
    const crConfirmed = Boolean(owner.crConfirmedAt || skipCashFields?.confirmCr);
    if (!crConfirmed) {
      return {
        status: 'error',
        message: 'Confirm that the CR belongs to this business before enabling SkipCash.',
        field: 'skipCash',
      };
    }
  }

  const sadadSelected = data.paymentMethods.includes('sadad');
  const sadadFields = data.sadad ?? null;
  const providedSadadCredentials = Boolean(
    sadadFields?.merchantId || sadadFields?.website || sadadFields?.secretKey,
  );

  if (sadadSelected) {
    const hasExistingCredentials = Boolean(owner.checkout.sadad?.hasCredentials);
    const hasNewCredentials = Boolean(
      sadadFields?.merchantId && sadadFields.website && sadadFields.secretKey,
    );
    if (!hasExistingCredentials && !hasNewCredentials) {
      return {
        status: 'error',
        message: 'Save your SADAD merchant id, website, and secret key first.',
        field: 'sadad',
      };
    }
  }

  // Cross-validate: a required policy must already exist as text on
  // the briefs row. Otherwise the founder would publish a checkout
  // that asks the buyer to accept an empty policy.
  const labels: Record<PolicyKey, string> = {
    terms: 'Terms of service',
    privacy: 'Privacy policy',
    refund: 'Refund policy',
    shipping: 'Shipping policy',
  };
  const missing = data.requiredPolicies.filter((k) => {
    const v = owner.policies[k];
    return !v || v.trim().length === 0;
  });
  if (missing.length > 0) {
    return {
      status: 'error',
      message: `Write the ${labels[missing[0]!]} text first, then require it at checkout.`,
      field: 'requiredPolicies',
    };
  }

  let sadadCredentialsToSave:
    | {
        v: 1;
        ct: string;
        merchantIdHint: string | null;
        websiteHint: string | null;
        verifiedMode: 'live' | 'sandbox';
        verifiedAt: string;
        updatedAt: string;
      }
    | null = null;
  if (providedSadadCredentials) {
    if (!sadadFields?.merchantId || !sadadFields.website || !sadadFields.secretKey) {
      return {
        status: 'error',
        message: 'Merchant id, website, and secret key are required for SADAD.',
        field: 'sadad',
      };
    }
    const payload = {
      merchantId: sadadFields.merchantId,
      website: sadadFields.website,
      secretKey: sadadFields.secretKey,
    };
    const verification = await verifySadadCredentials(payload);
    if (!verification.ok) {
      return {
        status: 'error',
        message: verification.reason,
        field: 'sadad',
      };
    }
    const verifiedAt = new Date().toISOString();
    sadadCredentialsToSave = {
      v: 1,
      ct: encryptToken(JSON.stringify(payload)),
      merchantIdHint:
        sadadFields.merchantId.length > 4 ? `••••${sadadFields.merchantId.slice(-4)}` : '••••',
      websiteHint: sadadFields.website,
      verifiedMode: verification.mode,
      verifiedAt,
      updatedAt: verifiedAt,
    };
  }

  const settings: CheckoutSettings = {
    paymentMethods: data.paymentMethods,
    bankDetails: data.paymentMethods.includes('bank_transfer') ? data.bankDetails : null,
    payLink: null,
    skipCash: owner.checkout.skipCash,
    sadad: owner.checkout.sadad,
    requiredPolicies: data.requiredPolicies,
    currency: data.currency,
    minOrderQar: data.minOrderQar,
    shippingFlatQar: data.shippingFlatQar,
  };

  try {
    await writeStorefrontCheckoutSettings(data.slug, settings);
    if (skipCashSelected && (providedSkipCashCredentials || skipCashFields?.confirmCr)) {
      let credentials:
        | {
            v: 1;
            ct: string;
            clientIdHint: string | null;
            updatedAt: string;
          }
        | undefined;
      if (providedSkipCashCredentials) {
        if (!skipCashFields?.clientId || !skipCashFields.keyId || !skipCashFields.keySecret) {
          return {
            status: 'error',
            message: 'Client id, key id, and key secret are required for SkipCash.',
            field: 'skipCash',
          };
        }
        const payload = {
          clientId: skipCashFields.clientId,
          keyId: skipCashFields.keyId,
          keySecret: skipCashFields.keySecret,
          webhookKey: skipCashFields.webhookKey || null,
        };
        credentials = {
          v: 1,
          ct: encryptToken(JSON.stringify(payload)),
          clientIdHint:
            skipCashFields.clientId.length > 4
              ? `••••${skipCashFields.clientId.slice(-4)}`
              : '••••',
          updatedAt: new Date().toISOString(),
        };
      }
      await writeStorefrontSkipCashSetup(data.slug, {
        credentials,
        confirmCr: Boolean(skipCashFields?.confirmCr),
      });
    }
    if (sadadCredentialsToSave) {
      await writeStorefrontSadadSetup(data.slug, sadadCredentialsToSave);
    }
    await recordAudit({
      storefrontSlug: data.slug,
      clerkUserId: userId,
      action: 'storefront.checkout.update',
      targetId: data.slug,
      summary: `Checkout updated · ${settings.paymentMethods.join(', ')}`,
      meta: {
        paymentMethods: settings.paymentMethods,
        requiredPolicies: settings.requiredPolicies,
        currency: settings.currency,
        bankIbanMasked: settings.bankDetails ? maskIban(settings.bankDetails.iban) : null,
        skipCashSelected,
        skipCashCredentialsUpdated: providedSkipCashCredentials,
        sadadSelected,
        sadadCredentialsUpdated: providedSadadCredentials,
        minOrderQar: settings.minOrderQar,
        shippingFlatQar: settings.shippingFlatQar,
      },
    });
  } catch {
    return { status: 'error', message: 'Save failed. Try again.' };
  }

  revalidatePath('/account', 'layout');
  revalidatePath(`/${data.slug}`);

  return { status: 'success', updatedAt: new Date().toISOString() };
}
