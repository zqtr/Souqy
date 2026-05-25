import { unstable_noStore as noStore } from 'next/cache';
import { db } from './db';

export type ShippingProfile = {
  id: string;
  storefrontSlug: string;
  name: string;
  enabled: boolean;
  freeShippingMinQar: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ShippingRate = {
  id: string;
  profileId: string;
  label: string;
  countryCode: string;
  city: string | null;
  amountQar: number;
  minSubtotalQar: number | null;
  maxSubtotalQar: number | null;
  enabled: boolean;
  position: number;
};

export type ShippingSettings = {
  profile: ShippingProfile | null;
  rates: ShippingRate[];
};

export type ShippingRateInput = {
  label: string;
  countryCode: string;
  city: string | null;
  amountQar: number;
  minSubtotalQar: number | null;
  maxSubtotalQar: number | null;
  enabled: boolean;
};

export type ShippingSettingsInput = {
  name: string;
  enabled: boolean;
  freeShippingMinQar: number | null;
  rates: ShippingRateInput[];
};

export type TaxProfile = {
  id: string;
  storefrontSlug: string;
  name: string;
  enabled: boolean;
  rateBps: number;
  includedInPrices: boolean;
  appliesToShipping: boolean;
  registrationNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TaxProfileInput = {
  name: string;
  enabled: boolean;
  rateBps: number;
  includedInPrices: boolean;
  appliesToShipping: boolean;
  registrationNumber: string | null;
};

export type MarketSettings = {
  storefrontSlug: string;
  primaryCurrency: string;
  enabledCurrencies: string[];
  primaryLanguage: 'en' | 'ar';
  enabledLanguages: Array<'en' | 'ar'>;
  defaultCountry: string;
  sellingRegions: string[];
  updatedAt: Date;
};

export type MarketSettingsInput = Omit<MarketSettings, 'storefrontSlug' | 'updatedAt'>;

export type Metaobject = {
  id: number;
  storefrontSlug: string;
  namespace: string;
  kind: string;
  key: string;
  displayName: string | null;
  fields: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

type ShippingProfileRow = {
  id: string;
  storefront_slug: string;
  name: string;
  enabled: boolean;
  free_shipping_min_qar: number | string | null;
  created_at: string;
  updated_at: string;
};

type ShippingRateRow = {
  id: string;
  profile_id: string;
  label: string;
  country_code: string;
  city: string | null;
  amount_qar: number | string;
  min_subtotal_qar: number | string | null;
  max_subtotal_qar: number | string | null;
  enabled: boolean;
  position: number;
};

type TaxProfileRow = {
  id: string;
  storefront_slug: string;
  name: string;
  enabled: boolean;
  rate_bps: number;
  included_in_prices: boolean;
  applies_to_shipping: boolean;
  registration_number: string | null;
  created_at: string;
  updated_at: string;
};

type MarketSettingsRow = {
  storefront_slug: string;
  primary_currency: string;
  enabled_currencies: string[] | string;
  primary_language: 'en' | 'ar';
  enabled_languages: Array<'en' | 'ar'> | string;
  default_country: string;
  selling_regions: string[] | string;
  updated_at: string;
};

type MetaobjectRow = {
  id: number;
  storefront_slug: string;
  namespace: string;
  kind: string;
  key: string;
  display_name: string | null;
  fields: unknown;
  created_at: string;
  updated_at: string;
};

function parseTextArray<T extends string = string>(value: string[] | string | null | undefined): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value) return [];
  return value
    .replace(/^\{|\}$/g, '')
    .split(',')
    .map((part) => part.trim().replace(/^"|"$/g, ''))
    .filter(Boolean) as T[];
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function profileFromRow(row: ShippingProfileRow): ShippingProfile {
  return {
    id: row.id,
    storefrontSlug: row.storefront_slug,
    name: row.name,
    enabled: row.enabled,
    freeShippingMinQar:
      row.free_shipping_min_qar === null ? null : Number(row.free_shipping_min_qar),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rateFromRow(row: ShippingRateRow): ShippingRate {
  return {
    id: row.id,
    profileId: row.profile_id,
    label: row.label,
    countryCode: row.country_code,
    city: row.city,
    amountQar: Number(row.amount_qar),
    minSubtotalQar: row.min_subtotal_qar === null ? null : Number(row.min_subtotal_qar),
    maxSubtotalQar: row.max_subtotal_qar === null ? null : Number(row.max_subtotal_qar),
    enabled: row.enabled,
    position: row.position,
  };
}

function taxFromRow(row: TaxProfileRow): TaxProfile {
  return {
    id: row.id,
    storefrontSlug: row.storefront_slug,
    name: row.name,
    enabled: row.enabled,
    rateBps: row.rate_bps,
    includedInPrices: row.included_in_prices,
    appliesToShipping: row.applies_to_shipping,
    registrationNumber: row.registration_number,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function marketFromRow(row: MarketSettingsRow): MarketSettings {
  const languages = parseTextArray<'en' | 'ar'>(row.enabled_languages).filter(
    (language) => language === 'en' || language === 'ar',
  );
  return {
    storefrontSlug: row.storefront_slug,
    primaryCurrency: row.primary_currency,
    enabledCurrencies: parseTextArray(row.enabled_currencies),
    primaryLanguage: row.primary_language === 'ar' ? 'ar' : 'en',
    enabledLanguages: languages.length > 0 ? languages : ['en', 'ar'],
    defaultCountry: row.default_country,
    sellingRegions: parseTextArray(row.selling_regions),
    updatedAt: new Date(row.updated_at),
  };
}

function metaobjectFromRow(row: MetaobjectRow): Metaobject {
  return {
    id: row.id,
    storefrontSlug: row.storefront_slug,
    namespace: row.namespace,
    kind: row.kind,
    key: row.key,
    displayName: row.display_name,
    fields: asObject(row.fields),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function getShippingSettings(slug: string): Promise<ShippingSettings> {
  noStore();
  const profiles = (await db()`
    select * from shipping_profiles
    where storefront_slug = ${slug}
    order by created_at asc
    limit 1
  `) as unknown as ShippingProfileRow[];
  const profile = profiles[0] ? profileFromRow(profiles[0]) : null;
  if (!profile) return { profile: null, rates: [] };
  const rates = (await db()`
    select * from shipping_rates
    where profile_id = ${profile.id}
    order by position asc, created_at asc
  `) as unknown as ShippingRateRow[];
  return { profile, rates: rates.map(rateFromRow) };
}

export async function writeShippingSettings(
  slug: string,
  input: ShippingSettingsInput,
): Promise<ShippingSettings> {
  const existing = await getShippingSettings(slug);
  const profileRows = existing.profile
    ? ((await db()`
        update shipping_profiles
        set name = ${input.name},
            enabled = ${input.enabled},
            free_shipping_min_qar = ${input.freeShippingMinQar},
            updated_at = now()
        where id = ${existing.profile.id} and storefront_slug = ${slug}
        returning *
      `) as unknown as ShippingProfileRow[])
    : ((await db()`
        insert into shipping_profiles (
          storefront_slug, name, enabled, free_shipping_min_qar
        ) values (
          ${slug}, ${input.name}, ${input.enabled}, ${input.freeShippingMinQar}
        )
        returning *
      `) as unknown as ShippingProfileRow[]);
  const profile = profileRows[0];
  if (!profile) throw new Error('shipping profile save failed');

  await db()`delete from shipping_rates where profile_id = ${profile.id}`;
  for (const [position, rate] of input.rates.entries()) {
    await db()`
      insert into shipping_rates (
        profile_id, label, country_code, city, amount_qar,
        min_subtotal_qar, max_subtotal_qar, enabled, position
      ) values (
        ${profile.id}, ${rate.label}, ${rate.countryCode}, ${rate.city},
        ${rate.amountQar}, ${rate.minSubtotalQar}, ${rate.maxSubtotalQar},
        ${rate.enabled}, ${position}
      )
    `;
  }
  return getShippingSettings(slug);
}

export async function getTaxProfile(slug: string): Promise<TaxProfile | null> {
  noStore();
  const rows = (await db()`
    select * from tax_profiles
    where storefront_slug = ${slug}
    order by created_at asc
    limit 1
  `) as unknown as TaxProfileRow[];
  return rows[0] ? taxFromRow(rows[0]) : null;
}

export async function writeTaxProfile(
  slug: string,
  input: TaxProfileInput,
): Promise<TaxProfile> {
  const existing = await getTaxProfile(slug);
  const rows = existing
    ? ((await db()`
        update tax_profiles
        set name = ${input.name},
            enabled = ${input.enabled},
            rate_bps = ${input.rateBps},
            included_in_prices = ${input.includedInPrices},
            applies_to_shipping = ${input.appliesToShipping},
            registration_number = ${input.registrationNumber},
            updated_at = now()
        where id = ${existing.id} and storefront_slug = ${slug}
        returning *
      `) as unknown as TaxProfileRow[])
    : ((await db()`
        insert into tax_profiles (
          storefront_slug, name, enabled, rate_bps,
          included_in_prices, applies_to_shipping, registration_number
        ) values (
          ${slug}, ${input.name}, ${input.enabled}, ${input.rateBps},
          ${input.includedInPrices}, ${input.appliesToShipping},
          ${input.registrationNumber}
        )
        returning *
      `) as unknown as TaxProfileRow[]);
  if (!rows[0]) throw new Error('tax profile save failed');
  return taxFromRow(rows[0]);
}

export async function getMarketSettings(slug: string): Promise<MarketSettings> {
  noStore();
  const rows = (await db()`
    select * from market_settings
    where storefront_slug = ${slug}
    limit 1
  `) as unknown as MarketSettingsRow[];
  if (rows[0]) return marketFromRow(rows[0]);
  return {
    storefrontSlug: slug,
    primaryCurrency: 'QAR',
    enabledCurrencies: ['QAR'],
    primaryLanguage: 'en',
    enabledLanguages: ['en', 'ar'],
    defaultCountry: 'QA',
    sellingRegions: ['QA'],
    updatedAt: new Date(),
  };
}

export async function writeMarketSettings(
  slug: string,
  input: MarketSettingsInput,
): Promise<MarketSettings> {
  const rows = (await db()`
    insert into market_settings (
      storefront_slug,
      primary_currency,
      enabled_currencies,
      primary_language,
      enabled_languages,
      default_country,
      selling_regions,
      updated_at
    ) values (
      ${slug},
      ${input.primaryCurrency},
      ${input.enabledCurrencies as unknown as string},
      ${input.primaryLanguage},
      ${input.enabledLanguages as unknown as string},
      ${input.defaultCountry},
      ${input.sellingRegions as unknown as string},
      now()
    )
    on conflict (storefront_slug) do update set
      primary_currency = excluded.primary_currency,
      enabled_currencies = excluded.enabled_currencies,
      primary_language = excluded.primary_language,
      enabled_languages = excluded.enabled_languages,
      default_country = excluded.default_country,
      selling_regions = excluded.selling_regions,
      updated_at = now()
    returning *
  `) as unknown as MarketSettingsRow[];
  if (!rows[0]) throw new Error('market settings save failed');
  return marketFromRow(rows[0]);
}

export async function listMetaobjects(
  slug: string,
  kind?: string,
): Promise<Metaobject[]> {
  noStore();
  const rows = kind
    ? ((await db()`
        select * from metaobjects
        where storefront_slug = ${slug} and kind = ${kind}
        order by namespace asc, kind asc, key asc
      `) as unknown as MetaobjectRow[])
    : ((await db()`
        select * from metaobjects
        where storefront_slug = ${slug}
        order by namespace asc, kind asc, key asc
      `) as unknown as MetaobjectRow[]);
  return rows.map(metaobjectFromRow);
}

export async function upsertMetaobject(input: {
  storefrontSlug: string;
  namespace: string;
  kind: string;
  key: string;
  displayName: string | null;
  fields: Record<string, unknown>;
}): Promise<Metaobject> {
  const rows = (await db()`
    insert into metaobjects (
      storefront_slug, namespace, kind, key, display_name, fields, updated_at
    ) values (
      ${input.storefrontSlug}, ${input.namespace}, ${input.kind}, ${input.key},
      ${input.displayName}, ${JSON.stringify(input.fields)}::jsonb, now()
    )
    on conflict (storefront_slug, namespace, kind, key) do update set
      display_name = excluded.display_name,
      fields = excluded.fields,
      updated_at = now()
    returning *
  `) as unknown as MetaobjectRow[];
  if (!rows[0]) throw new Error('metaobject save failed');
  return metaobjectFromRow(rows[0]);
}

export async function deleteMetaobject(
  storefrontSlug: string,
  id: number,
): Promise<boolean> {
  const rows = (await db()`
    delete from metaobjects
    where storefront_slug = ${storefrontSlug} and id = ${id}
    returning id
  `) as unknown as { id: number }[];
  return rows.length > 0;
}
