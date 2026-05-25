'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { assertStorefrontOwner } from '@/lib/products';
import { recordAudit } from '@/lib/audit';
import {
  deleteMetaobject,
  upsertMetaobject,
  writeMarketSettings,
  writeShippingSettings,
  writeTaxProfile,
} from '@/lib/adminSettings';
import { writeStorefrontCheckoutSettings } from '@/lib/storefrontSettings';

export type AdminSettingsActionState =
  | { status: 'idle' }
  | { status: 'success'; updatedAt: string }
  | { status: 'error'; message: string; field?: string };

const SlugSchema = z.string().trim().min(1).max(64);
const MoneySchema = z.number().int().min(0).max(1_000_000).nullable();
const CodeSchema = z.string().trim().min(2).max(3).transform((value) => value.toUpperCase());

const ShippingRateSchema = z.object({
  label: z.string().trim().min(1).max(80),
  countryCode: CodeSchema.default('QA'),
  city: z.string().trim().max(80).nullable(),
  amountQar: z.number().int().min(0).max(1_000_000),
  minSubtotalQar: MoneySchema,
  maxSubtotalQar: MoneySchema,
  enabled: z.boolean(),
});

const ShippingInputSchema = z.object({
  slug: SlugSchema,
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
  freeShippingMinQar: MoneySchema,
  rates: z.array(ShippingRateSchema).max(20),
});

const TaxInputSchema = z.object({
  slug: SlugSchema,
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
  rateBps: z.number().int().min(0).max(10000),
  includedInPrices: z.boolean(),
  appliesToShipping: z.boolean(),
  registrationNumber: z.string().trim().max(80).nullable(),
});

const CurrencySchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{3}$/.test(value), 'Currency must be a 3-letter code.');

const MarketInputSchema = z.object({
  slug: SlugSchema,
  primaryCurrency: CurrencySchema,
  enabledCurrencies: z.array(CurrencySchema).min(1).max(8),
  primaryLanguage: z.enum(['en', 'ar']),
  enabledLanguages: z.array(z.enum(['en', 'ar'])).min(1).max(2),
  defaultCountry: CodeSchema.default('QA'),
  sellingRegions: z.array(CodeSchema).min(1).max(20),
});

const MetaobjectInputSchema = z.object({
  slug: SlugSchema,
  id: z.number().int().positive().optional(),
  namespace: z.string().trim().min(1).max(60).default('app'),
  kind: z.enum(['faq', 'testimonial', 'spec', 'press_logo']),
  key: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .transform((value) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    ),
  displayName: z.string().trim().max(120).nullable(),
  fields: z.record(z.string(), z.unknown()),
});

const DeleteMetaobjectSchema = z.object({
  slug: SlugSchema,
  id: z.number().int().positive(),
});

async function requireOwner(slug: string) {
  const { userId } = await auth();
  if (!userId) return { ok: false as const, error: 'Sign in to save changes.' };
  const storefront = await assertStorefrontOwner(slug, userId);
  if (!storefront) return { ok: false as const, error: 'Storefront not found.' };
  return { ok: true as const, userId, storefront };
}

function validationError(error: z.ZodError): AdminSettingsActionState {
  const issue = error.issues[0];
  return {
    status: 'error',
    message: issue?.message ?? 'Invalid settings.',
    field: issue?.path?.[0] as string | undefined,
  };
}

export async function saveShippingSettings(
  input: z.input<typeof ShippingInputSchema>,
): Promise<AdminSettingsActionState> {
  const parsed = ShippingInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const owner = await requireOwner(parsed.data.slug);
  if (!owner.ok) return { status: 'error', message: owner.error };

  try {
    const settings = await writeShippingSettings(parsed.data.slug, parsed.data);
    const firstEnabledRate = settings.rates.find((rate) => rate.enabled);
    await writeStorefrontCheckoutSettings(parsed.data.slug, {
      ...owner.storefront.checkout,
      shippingFlatQar: firstEnabledRate?.amountQar ?? owner.storefront.checkout.shippingFlatQar,
    });
    await recordAudit({
      storefrontSlug: parsed.data.slug,
      clerkUserId: owner.userId,
      action: 'settings.shipping',
      targetId: parsed.data.slug,
      summary: `Shipping updated · ${parsed.data.rates.length} rate${parsed.data.rates.length === 1 ? '' : 's'}`,
      meta: {
        enabled: parsed.data.enabled,
        freeShippingMinQar: parsed.data.freeShippingMinQar,
        rates: parsed.data.rates.length,
      },
    });
  } catch {
    return { status: 'error', message: 'Could not save shipping settings.' };
  }

  revalidatePath('/account', 'layout');
  return { status: 'success', updatedAt: new Date().toISOString() };
}

export async function saveTaxSettings(
  input: z.input<typeof TaxInputSchema>,
): Promise<AdminSettingsActionState> {
  const parsed = TaxInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const owner = await requireOwner(parsed.data.slug);
  if (!owner.ok) return { status: 'error', message: owner.error };

  try {
    await writeTaxProfile(parsed.data.slug, parsed.data);
    await recordAudit({
      storefrontSlug: parsed.data.slug,
      clerkUserId: owner.userId,
      action: 'settings.tax',
      targetId: parsed.data.slug,
      summary: `Tax updated · ${(parsed.data.rateBps / 100).toFixed(2)}%`,
      meta: {
        enabled: parsed.data.enabled,
        rateBps: parsed.data.rateBps,
        includedInPrices: parsed.data.includedInPrices,
        appliesToShipping: parsed.data.appliesToShipping,
      },
    });
  } catch {
    return { status: 'error', message: 'Could not save tax settings.' };
  }

  revalidatePath('/account', 'layout');
  return { status: 'success', updatedAt: new Date().toISOString() };
}

export async function saveMarketSettings(
  input: z.input<typeof MarketInputSchema>,
): Promise<AdminSettingsActionState> {
  const parsed = MarketInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const owner = await requireOwner(parsed.data.slug);
  if (!owner.ok) return { status: 'error', message: owner.error };

  const enabledCurrencies = Array.from(new Set(parsed.data.enabledCurrencies));
  const enabledLanguages = Array.from(new Set(parsed.data.enabledLanguages));
  const sellingRegions = Array.from(new Set(parsed.data.sellingRegions));

  if (!enabledCurrencies.includes(parsed.data.primaryCurrency)) {
    return {
      status: 'error',
      message: 'Primary currency must be enabled.',
      field: 'primaryCurrency',
    };
  }
  if (!enabledLanguages.includes(parsed.data.primaryLanguage)) {
    return {
      status: 'error',
      message: 'Primary language must be enabled.',
      field: 'primaryLanguage',
    };
  }

  try {
    await writeMarketSettings(parsed.data.slug, {
      primaryCurrency: parsed.data.primaryCurrency,
      enabledCurrencies,
      primaryLanguage: parsed.data.primaryLanguage,
      enabledLanguages,
      defaultCountry: parsed.data.defaultCountry,
      sellingRegions,
    });
    await writeStorefrontCheckoutSettings(parsed.data.slug, {
      ...owner.storefront.checkout,
      currency: parsed.data.primaryCurrency,
    });
    await recordAudit({
      storefrontSlug: parsed.data.slug,
      clerkUserId: owner.userId,
      action: 'settings.markets',
      targetId: parsed.data.slug,
      summary: `Markets updated · ${parsed.data.primaryCurrency}`,
      meta: { enabledCurrencies, enabledLanguages, sellingRegions },
    });
  } catch {
    return { status: 'error', message: 'Could not save market settings.' };
  }

  revalidatePath('/account', 'layout');
  return { status: 'success', updatedAt: new Date().toISOString() };
}

export async function saveMetaobject(
  input: z.input<typeof MetaobjectInputSchema>,
): Promise<AdminSettingsActionState> {
  const parsed = MetaobjectInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const owner = await requireOwner(parsed.data.slug);
  if (!owner.ok) return { status: 'error', message: owner.error };
  if (!parsed.data.key) {
    return { status: 'error', message: 'Key must include a letter or number.', field: 'key' };
  }

  try {
    await upsertMetaobject({
      storefrontSlug: parsed.data.slug,
      namespace: parsed.data.namespace,
      kind: parsed.data.kind,
      key: parsed.data.key,
      displayName: parsed.data.displayName,
      fields: parsed.data.fields,
    });
    await recordAudit({
      storefrontSlug: parsed.data.slug,
      clerkUserId: owner.userId,
      action: `metaobject.${parsed.data.kind}.save`,
      targetId: parsed.data.key,
      summary: `Saved ${parsed.data.kind.replace('_', ' ')} · ${parsed.data.key}`,
      meta: { namespace: parsed.data.namespace },
    });
  } catch {
    return { status: 'error', message: 'Could not save custom data.' };
  }

  revalidatePath('/account/settings/custom-data');
  return { status: 'success', updatedAt: new Date().toISOString() };
}

export async function removeMetaobject(
  input: z.input<typeof DeleteMetaobjectSchema>,
): Promise<AdminSettingsActionState> {
  const parsed = DeleteMetaobjectSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const owner = await requireOwner(parsed.data.slug);
  if (!owner.ok) return { status: 'error', message: owner.error };

  try {
    const deleted = await deleteMetaobject(parsed.data.slug, parsed.data.id);
    if (!deleted) return { status: 'error', message: 'Custom data record not found.' };
    await recordAudit({
      storefrontSlug: parsed.data.slug,
      clerkUserId: owner.userId,
      action: 'metaobject.delete',
      targetId: String(parsed.data.id),
      summary: 'Deleted custom data record',
    });
  } catch {
    return { status: 'error', message: 'Could not delete custom data.' };
  }

  revalidatePath('/account/settings/custom-data');
  return { status: 'success', updatedAt: new Date().toISOString() };
}
