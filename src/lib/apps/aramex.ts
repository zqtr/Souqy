import { decryptToken } from './crypto';
import { getInstalledApp } from './installed';
import { put as blobPut } from '@vercel/blob';
import { env } from '@/lib/env';
import {
  createShipment,
  getShipmentByAwb,
  updateShipmentStatus,
  type Shipment,
} from '@/lib/shipments';
import type { Order } from '@/lib/orders';

/**
 * Aramex plugin (full scope: live rates + shipment creation +
 * tracking).
 *
 * Auth model: founder pastes their own Aramex account credentials
 * (username, password, account number, account PIN, account entity).
 * Souqna stores them encrypted at rest and decrypts at the moment of
 * each Aramex API call. No Souqna-side Aramex contract.
 *
 * Aramex's APIs are JSON-over-HTTP at `ws.aramex.net/ShippingAPI.V2`.
 * The request bodies are verbose but well-documented; this module
 * builds them server-side so the dashboard never has to think about
 * the schema.
 */

export type AramexSettings = {
  username: string;
  /** AES-encrypted in `installed_apps.oauth_access_token` (a small
   *  abuse of the field name, but it's the existing credential vault
   *  for this app — see crypto.ts). The plain string lives only in
   *  memory at the moment of an outbound API call. */
  password: string;
  accountNumber: string;
  /** Encrypted alongside password — same vault. */
  accountPin: string;
  /** e.g. 'DOH'. Aramex uses entity codes per origin city. */
  accountEntity: string;
  /** ISO country code, e.g. 'QA'. */
  accountCountry: string;
  /** 'DOM' (domestic) or 'EXP' (express international). Used for
   *  default rate quotes. */
  productGroup: 'DOM' | 'EXP';
  /** e.g. 'PDX' priority document express, 'OND' onward delivery. */
  defaultProductType: string;
  pickupAddress: {
    line1: string;
    line2: string;
    city: string;
    countryCode: string;
    postCode: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
  };
  defaultWeightKg: number;
  defaultDimensionsCm: { length: number; width: number; height: number };
};

export const DEFAULT_ARAMEX_SETTINGS: AramexSettings = {
  username: '',
  password: '',
  accountNumber: '',
  accountPin: '',
  accountEntity: 'DOH',
  accountCountry: 'QA',
  productGroup: 'DOM',
  defaultProductType: 'OND',
  pickupAddress: {
    line1: '',
    line2: '',
    city: 'Doha',
    countryCode: 'QA',
    postCode: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
  },
  defaultWeightKg: 1,
  defaultDimensionsCm: { length: 30, width: 20, height: 10 },
};

export function normaliseSettings(
  raw: Partial<AramexSettings> | null | undefined,
): AramexSettings {
  if (!raw) return DEFAULT_ARAMEX_SETTINGS;
  const pa = (raw.pickupAddress ?? {}) as Partial<AramexSettings['pickupAddress']>;
  const dim = (raw.defaultDimensionsCm ?? {}) as Partial<
    AramexSettings['defaultDimensionsCm']
  >;
  return {
    username: typeof raw.username === 'string' ? raw.username.trim() : '',
    password: '', // never round-tripped through settings — vault holds it
    accountNumber:
      typeof raw.accountNumber === 'string' ? raw.accountNumber.trim() : '',
    accountPin: '', // vault
    accountEntity:
      typeof raw.accountEntity === 'string' ? raw.accountEntity.trim().toUpperCase() : 'DOH',
    accountCountry:
      typeof raw.accountCountry === 'string' ? raw.accountCountry.trim().toUpperCase() : 'QA',
    productGroup: raw.productGroup === 'EXP' ? 'EXP' : 'DOM',
    defaultProductType:
      typeof raw.defaultProductType === 'string'
        ? raw.defaultProductType.trim().toUpperCase()
        : 'OND',
    pickupAddress: {
      line1: typeof pa.line1 === 'string' ? pa.line1 : '',
      line2: typeof pa.line2 === 'string' ? pa.line2 : '',
      city: typeof pa.city === 'string' ? pa.city : 'Doha',
      countryCode:
        typeof pa.countryCode === 'string' ? pa.countryCode.trim().toUpperCase() : 'QA',
      postCode: typeof pa.postCode === 'string' ? pa.postCode : '',
      contactName: typeof pa.contactName === 'string' ? pa.contactName : '',
      contactPhone: typeof pa.contactPhone === 'string' ? pa.contactPhone : '',
      contactEmail: typeof pa.contactEmail === 'string' ? pa.contactEmail : '',
    },
    defaultWeightKg:
      typeof raw.defaultWeightKg === 'number' && raw.defaultWeightKg > 0
        ? raw.defaultWeightKg
        : 1,
    defaultDimensionsCm: {
      length: typeof dim.length === 'number' && dim.length > 0 ? dim.length : 30,
      width: typeof dim.width === 'number' && dim.width > 0 ? dim.width : 20,
      height: typeof dim.height === 'number' && dim.height > 0 ? dim.height : 10,
    },
  };
}

// ---------------------------------------------------------------
// Credential helpers
// ---------------------------------------------------------------

type DecryptedSecrets = { password: string; accountPin: string };

/**
 * Pulls the encrypted password+PIN bundle out of the install row.
 * The vault stores them as a single JSON string in
 * `installed_apps.oauth_access_token` so reinstall doesn't lose them
 * and `installed_apps.settings` can stay safely returnable to the
 * dashboard.
 */
function decryptSecrets(ct: string): DecryptedSecrets | null {
  const json = decryptToken(ct);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.password === 'string' &&
      typeof parsed.accountPin === 'string'
    ) {
      return { password: parsed.password, accountPin: parsed.accountPin };
    }
  } catch {
    /* fall through */
  }
  return null;
}

export function packSecrets(password: string, accountPin: string): string {
  return JSON.stringify({ password, accountPin });
}

type ResolvedClient = {
  settings: AramexSettings;
  password: string;
  accountPin: string;
};

async function resolveClient(slug: string): Promise<ResolvedClient | null> {
  const installed = await getInstalledApp(slug, 'aramex');
  if (!installed || !installed.enabled) return null;
  const settings = normaliseSettings(installed.settings as Partial<AramexSettings>);
  const secrets = decryptSecrets(installed.oauthAccessTokenCt);
  if (!secrets) return null;
  if (!settings.username || !settings.accountNumber) return null;
  return { settings, ...secrets };
}

// ---------------------------------------------------------------
// Aramex envelope builder
// ---------------------------------------------------------------

function clientInfo(c: ResolvedClient) {
  return {
    UserName: c.settings.username,
    Password: c.password,
    Version: 'v1',
    AccountNumber: c.settings.accountNumber,
    AccountPin: c.accountPin,
    AccountEntity: c.settings.accountEntity,
    AccountCountryCode: c.settings.accountCountry,
    Source: 24, // Aramex docs: arbitrary positive integer per integrator
  };
}

const RATE_URL =
  'https://ws.aramex.net/ShippingAPI.V2/RateCalculator/Service_1_0.svc/json/CalculateRate';
const CREATE_URL =
  'https://ws.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json/CreateShipments';
const TRACK_URL =
  'https://ws.aramex.net/ShippingAPI.V2/Tracking/Service_1_0.svc/json/TrackShipments';

// ---------------------------------------------------------------
// Live rate quote
// ---------------------------------------------------------------

export type RateQuoteInput = {
  destinationCountryCode: string;
  destinationCity: string;
  destinationPostCode?: string;
  weightKg?: number;
  dimensionsCm?: { length: number; width: number; height: number };
  productType?: string;
};

export type RateQuote = {
  amount: number;
  currency: string;
  productType: string;
  /** Raw upstream response — useful when debugging unexpected fees. */
  raw: Record<string, unknown>;
};

export async function quoteRate(
  slug: string,
  input: RateQuoteInput,
): Promise<RateQuote | null> {
  const client = await resolveClient(slug);
  if (!client) return null;
  const w = input.weightKg ?? client.settings.defaultWeightKg;
  const d = input.dimensionsCm ?? client.settings.defaultDimensionsCm;
  const productType = input.productType ?? client.settings.defaultProductType;

  const body = {
    ClientInfo: clientInfo(client),
    OriginAddress: {
      Line1: client.settings.pickupAddress.line1,
      Line2: client.settings.pickupAddress.line2,
      Line3: '',
      City: client.settings.pickupAddress.city,
      StateOrProvinceCode: '',
      PostCode: client.settings.pickupAddress.postCode,
      CountryCode: client.settings.pickupAddress.countryCode,
    },
    DestinationAddress: {
      Line1: '',
      Line2: '',
      Line3: '',
      City: input.destinationCity,
      StateOrProvinceCode: '',
      PostCode: input.destinationPostCode ?? '',
      CountryCode: input.destinationCountryCode.toUpperCase(),
    },
    ShipmentDetails: {
      PaymentType: 'P',
      ProductGroup: client.settings.productGroup,
      ProductType: productType,
      ActualWeight: { Unit: 'KG', Value: w },
      ChargeableWeight: { Unit: 'KG', Value: w },
      NumberOfPieces: 1,
      Dimensions: {
        Length: d.length,
        Width: d.width,
        Height: d.height,
        Unit: 'CM',
      },
      DescriptionOfGoods: 'Souqna shipment',
      GoodsOriginCountry: client.settings.accountCountry,
    },
    PreferredCurrencyCode: 'QAR',
    Transaction: { Reference1: slug },
  };

  const res = await fetch(RATE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Aramex rate ${res.status}`);
  }
  const json = (await res.json()) as {
    HasErrors?: boolean;
    Notifications?: Array<{ Code: string; Message: string }>;
    TotalAmount?: { Value: number; CurrencyCode: string };
  };
  if (json.HasErrors) {
    const first = json.Notifications?.[0];
    throw new Error(`Aramex: ${first?.Message ?? 'rate quote refused'}`);
  }
  if (!json.TotalAmount) return null;
  return {
    amount: json.TotalAmount.Value,
    currency: json.TotalAmount.CurrencyCode || 'QAR',
    productType,
    raw: json as unknown as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------
// Shipment creation (returns AWB + label PDF cached to Vercel Blob)
// ---------------------------------------------------------------

export type CreateShipmentInput = {
  order: Order;
  destination: {
    name: string;
    phone: string;
    email: string;
    line1: string;
    line2?: string;
    city: string;
    countryCode: string;
    postCode?: string;
  };
  productType?: string;
  weightKg?: number;
  dimensionsCm?: { length: number; width: number; height: number };
};

export async function createAramexShipment(
  slug: string,
  input: CreateShipmentInput,
): Promise<Shipment> {
  const client = await resolveClient(slug);
  if (!client) {
    throw new Error('Aramex is not installed for this storefront.');
  }
  const w = input.weightKg ?? client.settings.defaultWeightKg;
  const d = input.dimensionsCm ?? client.settings.defaultDimensionsCm;
  const productType = input.productType ?? client.settings.defaultProductType;

  const shipper = {
    Reference1: slug,
    Reference2: '',
    AccountNumber: client.settings.accountNumber,
    PartyAddress: {
      Line1: client.settings.pickupAddress.line1,
      Line2: client.settings.pickupAddress.line2,
      Line3: '',
      City: client.settings.pickupAddress.city,
      StateOrProvinceCode: '',
      PostCode: client.settings.pickupAddress.postCode,
      CountryCode: client.settings.pickupAddress.countryCode,
    },
    Contact: {
      PersonName: client.settings.pickupAddress.contactName,
      CompanyName: client.settings.pickupAddress.contactName,
      PhoneNumber1: client.settings.pickupAddress.contactPhone,
      EmailAddress: client.settings.pickupAddress.contactEmail,
    },
  };

  const consignee = {
    Reference1: `order-${input.order.orderNumber}`,
    Reference2: '',
    AccountNumber: '',
    PartyAddress: {
      Line1: input.destination.line1,
      Line2: input.destination.line2 ?? '',
      Line3: '',
      City: input.destination.city,
      StateOrProvinceCode: '',
      PostCode: input.destination.postCode ?? '',
      CountryCode: input.destination.countryCode.toUpperCase(),
    },
    Contact: {
      PersonName: input.destination.name,
      CompanyName: input.destination.name,
      PhoneNumber1: input.destination.phone,
      EmailAddress: input.destination.email,
    },
  };

  const body = {
    ClientInfo: clientInfo(client),
    LabelInfo: { ReportID: 9201, ReportType: 'URL' },
    Shipments: [
      {
        Reference1: `order-${input.order.orderNumber}`,
        Shipper: shipper,
        Consignee: consignee,
        ShippingDateTime: new Date().toISOString(),
        Comments: input.order.notes ?? '',
        Details: {
          Dimensions: {
            Length: d.length,
            Width: d.width,
            Height: d.height,
            Unit: 'CM',
          },
          ActualWeight: { Unit: 'KG', Value: w },
          ChargeableWeight: { Unit: 'KG', Value: w },
          ProductGroup: client.settings.productGroup,
          ProductType: productType,
          PaymentType: 'P',
          NumberOfPieces: 1,
          DescriptionOfGoods: input.order.items
            ?.map((it) => `${it.quantity}× ${it.productTitle}`)
            .join(', ')
            ?.slice(0, 240)
            ?? `Order #${input.order.orderNumber}`,
          GoodsOriginCountry: client.settings.accountCountry,
          CashOnDeliveryAmount: { Value: 0, CurrencyCode: 'QAR' },
          InsuranceAmount: { Value: 0, CurrencyCode: 'QAR' },
          CollectAmount: { Value: 0, CurrencyCode: 'QAR' },
          CashAdditionalAmount: { Value: 0, CurrencyCode: 'QAR' },
          CashAdditionalAmountDescription: '',
          CustomsValueAmount: {
            Value: input.order.total,
            CurrencyCode: input.order.currencyCode || 'QAR',
          },
        },
      },
    ],
  };

  const res = await fetch(CREATE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Aramex create ${res.status}`);
  }
  const json = (await res.json()) as {
    HasErrors?: boolean;
    Notifications?: Array<{ Code: string; Message: string }>;
    Shipments?: Array<{
      ID: string;
      ShipmentLabel?: { LabelURL?: string };
    }>;
  };
  if (json.HasErrors || !json.Shipments?.[0]) {
    const first = json.Notifications?.[0];
    throw new Error(`Aramex: ${first?.Message ?? 'create refused'}`);
  }
  const created = json.Shipments[0];
  const awb = created.ID;
  const trackingUrl = `https://www.aramex.com/track/results?ShipmentNumber=${encodeURIComponent(awb)}`;

  // Cache the label PDF in our Blob store so reprints don't keep
  // hitting Aramex's rate-limited PDF endpoint. Tolerates a missing
  // Blob token in dev — falls back to the live URL.
  let labelUrl: string | null = created.ShipmentLabel?.LabelURL ?? null;
  if (env.BLOB_READ_WRITE_TOKEN && labelUrl) {
    try {
      const pdfRes = await fetch(labelUrl);
      if (pdfRes.ok) {
        const buf = Buffer.from(await pdfRes.arrayBuffer());
        const blob = await blobPut(`shipments/aramex/${awb}.pdf`, buf, {
          access: 'public',
          contentType: 'application/pdf',
          token: env.BLOB_READ_WRITE_TOKEN,
        });
        labelUrl = blob.url;
      }
    } catch (err) {
      console.warn('[aramex] could not cache label pdf', err);
    }
  }

  const shipment = await createShipment(slug, {
    orderId: input.order.id,
    carrier: 'aramex',
    service: productType,
    awb,
    trackingUrl,
    labelUrl,
    raw: json as unknown as Record<string, unknown>,
  });
  return shipment;
}

// ---------------------------------------------------------------
// Tracking poll
// ---------------------------------------------------------------

export type TrackingUpdate = {
  status: string;
  events: Array<{
    code: string;
    description: string;
    location: string;
    at: string;
  }>;
};

export async function trackShipment(
  slug: string,
  awb: string,
): Promise<TrackingUpdate | null> {
  const client = await resolveClient(slug);
  if (!client) return null;

  const body = {
    ClientInfo: clientInfo(client),
    Shipments: [awb],
    GetLastTrackingUpdateOnly: false,
    Transaction: { Reference1: slug },
  };

  const res = await fetch(TRACK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Aramex track ${res.status}`);
  }
  const json = (await res.json()) as {
    HasErrors?: boolean;
    TrackingResults?: Array<{
      Key: string;
      Value?: Array<{
        UpdateCode: string;
        UpdateDescription: string;
        UpdateLocation: string;
        UpdateDateTime: string;
      }>;
    }>;
  };
  if (json.HasErrors || !json.TrackingResults?.[0]?.Value) return null;
  const events = (json.TrackingResults[0].Value ?? []).map((u) => ({
    code: u.UpdateCode,
    description: u.UpdateDescription,
    location: u.UpdateLocation,
    at: u.UpdateDateTime,
  }));
  const latest = events[events.length - 1];
  const status = latest ? mapAramexStatus(latest.code, latest.description) : 'in_transit';

  // Persist the latest snapshot back onto the shipment row.
  const existing = await getShipmentByAwb('aramex', awb);
  if (existing) {
    await updateShipmentStatus(existing.id, status, {
      ...existing.raw,
      lastTracking: { events, fetchedAt: new Date().toISOString() },
    }).catch(() => {});
  }
  return { status, events };
}

function mapAramexStatus(code: string, description: string): string {
  const lower = description.toLowerCase();
  if (/delivered/.test(lower)) return 'delivered';
  if (/return/.test(lower)) return 'returned';
  if (/out for delivery/.test(lower)) return 'out_for_delivery';
  if (/picked up|collected/.test(lower)) return 'picked_up';
  if (/cancel/.test(lower)) return 'cancelled';
  if (/held|exception|fail/.test(lower)) return 'failed';
  if (code) return 'in_transit';
  return 'in_transit';
}
