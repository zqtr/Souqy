import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
  mobileError,
  mobileJson,
  mobileOptions,
  requireMobileStoreAccess,
  searchParam,
} from '@/lib/mobile/auth';
import {
  updateStorefront,
  type Storefront,
  type UpdateStorefrontInput,
} from '@/lib/brief';
import { recordAudit } from '@/lib/audit';
import { encryptToken } from '@/lib/apps/crypto';
import {
  PAYMENT_METHODS,
  POLICY_KEYS,
  writeStorefrontCheckoutSettings,
  writeStorefrontSkipCashSetup,
  type CheckoutSettings,
  type PaymentMethod,
  type PolicyKey,
} from '@/lib/storefrontSettings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(): Response {
  return mobileOptions();
}

const SkipCashSchema = z
  .object({
    clientId: z.string().trim().max(240).optional().default(''),
    keyId: z.string().trim().max(240).optional().default(''),
    keySecret: z.string().trim().max(2000).optional().default(''),
    webhookKey: z.string().trim().max(2000).optional().default(''),
    confirmCr: z.boolean().optional().default(false),
  })
  .strict();

const PatchSchema = z.object({
  store: z.string().trim().min(1).max(64).optional(),
  enableSkipCash: z.boolean().optional().default(true),
  crNumber: z.string().trim().max(64).nullable().optional(),
  paymentMethods: z
    .array(z.enum(PAYMENT_METHODS as unknown as [PaymentMethod, ...PaymentMethod[]]))
    .optional()
    .transform((arr) => (arr ? Array.from(new Set(arr)) as PaymentMethod[] : undefined)),
  skipCash: SkipCashSchema.nullable().optional(),
  shippingFlatQar: z.number().int().min(0).max(1_000_000).nullable().optional(),
  minOrderQar: z.number().int().min(0).max(1_000_000).nullable().optional(),
});

export async function GET(req: Request): Promise<Response> {
  const slug = searchParam(req, 'store');
  const gate = await requireMobileStoreAccess(slug, 'settings.manage');
  if (!gate.ok) return gate.response;
  return mobileJson(toPayload(gate.access.storefront));
}

export async function PATCH(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return mobileError(400, 'invalid_checkout', 'Invalid checkout settings.');
  }

  const slug = parsed.data.store ?? searchParam(req, 'store');
  const gate = await requireMobileStoreAccess(slug, 'settings.manage');
  if (!gate.ok) return gate.response;

  const current = gate.access.storefront;
  const nextCrNumber =
    'crNumber' in parsed.data
      ? normalizeNullable(parsed.data.crNumber)
      : current.crNumber;
  let workingStorefront = current;

  if (nextCrNumber !== current.crNumber) {
    const next: UpdateStorefrontInput = {
      founderName: current.founderName,
      businessName: current.businessName,
      ownership: current.ownership,
      experience: current.experience,
      businessType: current.businessType,
      marketVolume: current.marketVolume,
      payments: current.payments,
      tagline: current.tagline,
      phone: current.phone,
      area: current.area,
      hours: current.hours,
      instagram: current.instagram,
      logoUrl: current.logoUrl,
      faviconUrl: current.faviconUrl,
      design: current.design,
      palette: current.palette,
      templateId: current.templateId,
      crNumber: nextCrNumber,
    };
    const updated = await updateStorefront(current.slug, next);
    if (!updated) {
      return mobileError(500, 'checkout_failed', 'Could not save CR number.');
    }
    workingStorefront = updated;
  }

  const shouldEnableSkipCash = parsed.data.enableSkipCash !== false;
  const existingMethods = workingStorefront.checkout.paymentMethods.length
    ? workingStorefront.checkout.paymentMethods
    : (['cod'] as PaymentMethod[]);
  const paymentMethods = parsed.data.paymentMethods ?? existingMethods;
  const nextPaymentMethods = shouldEnableSkipCash
    ? uniqueMethods([...paymentMethods, 'skipcash'])
    : uniqueMethods(paymentMethods.filter((method) => method !== 'skipcash'));

  const skipCashFields = parsed.data.skipCash ?? null;
  const providedCredentials = Boolean(
    skipCashFields?.clientId ||
      skipCashFields?.keyId ||
      skipCashFields?.keySecret ||
      skipCashFields?.webhookKey,
  );

  if (shouldEnableSkipCash) {
    if (!workingStorefront.crNumber?.trim()) {
      return mobileError(
        400,
        'missing_cr',
        'Add your CR number before enabling SkipCash.',
      );
    }
    if (!workingStorefront.crConfirmedAt && !skipCashFields?.confirmCr) {
      return mobileError(
        400,
        'cr_not_confirmed',
        'Confirm that the CR belongs to this business before enabling SkipCash.',
      );
    }
    const hasExistingCredentials = Boolean(workingStorefront.checkout.skipCash?.hasCredentials);
    const hasNewCredentials = Boolean(
      skipCashFields?.clientId && skipCashFields.keyId && skipCashFields.keySecret,
    );
    if (!hasExistingCredentials && !hasNewCredentials) {
      return mobileError(
        400,
        'missing_skipcash_credentials',
        'Client id, key id, and key secret are required for SkipCash.',
      );
    }
  }

  const settings: CheckoutSettings = {
    ...workingStorefront.checkout,
    paymentMethods: nextPaymentMethods,
    bankDetails: nextPaymentMethods.includes('bank_transfer')
      ? workingStorefront.checkout.bankDetails
      : null,
    requiredPolicies: workingStorefront.checkout.requiredPolicies.filter((policy): policy is PolicyKey =>
      (POLICY_KEYS as readonly string[]).includes(policy),
    ),
    minOrderQar:
      parsed.data.minOrderQar === undefined
        ? workingStorefront.checkout.minOrderQar
        : parsed.data.minOrderQar,
    shippingFlatQar:
      parsed.data.shippingFlatQar === undefined
        ? workingStorefront.checkout.shippingFlatQar
        : parsed.data.shippingFlatQar,
  };

  let savedClientIdHint: string | null = null;

  try {
    await writeStorefrontCheckoutSettings(workingStorefront.slug, settings);
    if (shouldEnableSkipCash && (providedCredentials || skipCashFields?.confirmCr)) {
      let credentials:
        | {
            v: 1;
            ct: string;
            clientIdHint: string | null;
            updatedAt: string;
          }
        | undefined;
      if (providedCredentials) {
        if (!skipCashFields?.clientId || !skipCashFields.keyId || !skipCashFields.keySecret) {
          return mobileError(
            400,
            'missing_skipcash_credentials',
            'Client id, key id, and key secret are required for SkipCash.',
          );
        }
        credentials = {
          v: 1,
          ct: encryptToken(
            JSON.stringify({
              clientId: skipCashFields.clientId,
              keyId: skipCashFields.keyId,
              keySecret: skipCashFields.keySecret,
              webhookKey: skipCashFields.webhookKey || null,
            }),
          ),
          clientIdHint:
            skipCashFields.clientId.length > 4
              ? `••••${skipCashFields.clientId.slice(-4)}`
              : '••••',
          updatedAt: new Date().toISOString(),
        };
        savedClientIdHint = credentials.clientIdHint;
      }
      await writeStorefrontSkipCashSetup(workingStorefront.slug, {
        credentials,
        confirmCr: Boolean(skipCashFields?.confirmCr),
      });
    }

    await recordAudit({
      storefrontSlug: workingStorefront.slug,
      clerkUserId: gate.user.userId,
      action: 'storefront.checkout.mobile_skipcash',
      targetId: workingStorefront.slug,
      summary: shouldEnableSkipCash ? 'SkipCash enabled from mobile' : 'SkipCash disabled from mobile',
      meta: {
        source: 'mobile',
        skipCashSelected: shouldEnableSkipCash,
        skipCashCredentialsUpdated: providedCredentials,
        paymentMethods: nextPaymentMethods,
      },
    });

    revalidatePath('/account', 'layout');
    revalidatePath('/account/settings/checkout');
    revalidatePath(`/brief/${workingStorefront.slug}`, 'layout');

    const refreshed: Storefront = {
      ...workingStorefront,
      checkout: {
        ...workingStorefront.checkout,
        ...settings,
        skipCash: {
          hasCredentials:
            Boolean(workingStorefront.checkout.skipCash?.hasCredentials) || providedCredentials,
          clientIdHint:
            savedClientIdHint ??
            workingStorefront.checkout.skipCash?.clientIdHint ??
            null,
          enabled: shouldEnableSkipCash && Boolean(workingStorefront.crNumber),
          crConfirmedAt:
            (workingStorefront.crConfirmedAt
              ? workingStorefront.crConfirmedAt.toISOString()
              : null) ??
            (skipCashFields?.confirmCr ? new Date().toISOString() : null),
        },
      },
      crConfirmedAt:
        workingStorefront.crConfirmedAt ??
        (skipCashFields?.confirmCr ? new Date() : null),
    };
    return mobileJson(toPayload(refreshed));
  } catch (err) {
    console.error('[mobile/storefront/checkout PATCH] failed', err);
    return mobileError(500, 'checkout_failed', 'Could not save SkipCash settings.');
  }
}

function normalizeNullable(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function uniqueMethods(methods: PaymentMethod[]): PaymentMethod[] {
  const allowed = new Set(PAYMENT_METHODS as readonly PaymentMethod[]);
  return methods.filter((method, index, array) => allowed.has(method) && array.indexOf(method) === index);
}

function toPayload(storefront: Storefront) {
  const checkout = storefront.checkout;
  const skipCash = checkout.skipCash ?? {
    hasCredentials: false,
    clientIdHint: null,
    enabled: false,
    crConfirmedAt: storefront.crConfirmedAt ? storefront.crConfirmedAt.toISOString() : null,
  };
  const skipCashReady = Boolean(
    checkout.paymentMethods.includes('skipcash') &&
      skipCash.hasCredentials &&
      storefront.crNumber &&
      (skipCash.crConfirmedAt || storefront.crConfirmedAt),
  );

  return {
    checkout: {
      paymentMethods: checkout.paymentMethods,
      currency: checkout.currency,
      minOrderQar: checkout.minOrderQar,
      shippingFlatQar: checkout.shippingFlatQar,
      skipCash: {
        hasCredentials: skipCash.hasCredentials,
        clientIdHint: skipCash.clientIdHint,
        enabled: skipCashReady,
        crConfirmedAt:
          skipCash.crConfirmedAt ??
          (storefront.crConfirmedAt ? storefront.crConfirmedAt.toISOString() : null),
      },
    },
    crNumber: storefront.crNumber,
    skipCashEligible: Boolean(storefront.crNumber),
    skipCashBlockedReason: storefront.crNumber ? 'Confirm CR ownership' : 'Add CR number',
  };
}
