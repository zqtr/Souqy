import { getAppState, setAppState } from '@/lib/apps/installed';

/**
 * Currency Converter plugin runtime.
 *
 * Strategy: hourly cache in-process, with a per-storefront snapshot in
 * `app_state` so a cold lambda or a flapping upstream doesn't break
 * conversion. The free open.er-api.com endpoint is used at the QAR
 * base — its free tier publishes daily, which is fine for a price
 * toggle.
 */

export const SUPPORTED_CURRENCIES = ['QAR', 'USD', 'EUR', 'GBP', 'AED', 'SAR'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export type RatesSnapshot = {
  base: 'QAR';
  rates: Record<string, number>;
  fetchedAt: number;
};

/**
 * Per-storefront customisation for the Currency Converter.
 *
 * Stored as an `app_state` row at (slug, 'currency-converter', 'settings').
 * The storefront-side `CurrencyToggle` reads this on mount via the
 * `/api/apps/currency-converter/rates` endpoint, which now also returns
 * the applicable settings — keeping the public surface to one round-trip.
 */
export type CurrencyPosition = 'floating-tr' | 'floating-bl' | 'header' | 'footer';

export type CurrencyConverterSettings = {
  /** Currencies the visitor is allowed to switch to. QAR is always
   *  implicitly included (it's the base). Stored as a sorted array
   *  for deterministic JSON. */
  enabledCurrencies: SupportedCurrency[];
  /** The currency a first-time visitor sees. Must be in
   *  `enabledCurrencies` (or QAR). */
  defaultCurrency: SupportedCurrency;
  /** Where the switcher sits on the storefront. */
  position: CurrencyPosition;
  /** Optional custom label, e.g. "Currency", "العملة", "Rates". Empty
   *  string falls back to the symbol-only chip. */
  label: string;
  /** When true, products show the original QAR price as a strikethrough
   *  reference under the converted price. */
  showOriginalQar: boolean;
};

export const DEFAULT_CC_SETTINGS: CurrencyConverterSettings = {
  enabledCurrencies: ['USD', 'EUR', 'GBP', 'AED', 'SAR'],
  defaultCurrency: 'QAR',
  position: 'floating-tr',
  label: '',
  showOriginalQar: false,
};

const APP_ID = 'currency-converter';
const SETTINGS_KEY = 'settings';
const RATE_TTL_MS = 60 * 60 * 1000;

function isSupported(c: unknown): c is SupportedCurrency {
  return typeof c === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(c);
}

function isPosition(p: unknown): p is CurrencyPosition {
  return p === 'floating-tr' || p === 'floating-bl' || p === 'header' || p === 'footer';
}

export async function getCurrencyConverterSettings(
  storefrontSlug: string,
): Promise<CurrencyConverterSettings> {
  try {
    const row = await getAppState(storefrontSlug, APP_ID, SETTINGS_KEY);
    if (!row) return DEFAULT_CC_SETTINGS;
    const v = row.value as Partial<CurrencyConverterSettings>;
    const enabled = Array.isArray(v.enabledCurrencies)
      ? Array.from(
          new Set(
            (v.enabledCurrencies as unknown[]).filter(isSupported).filter((c) => c !== 'QAR'),
          ),
        ).sort()
      : DEFAULT_CC_SETTINGS.enabledCurrencies;
    const defaultCurrency = isSupported(v.defaultCurrency)
      ? v.defaultCurrency
      : DEFAULT_CC_SETTINGS.defaultCurrency;
    return {
      enabledCurrencies: enabled,
      defaultCurrency:
        defaultCurrency !== 'QAR' && !enabled.includes(defaultCurrency)
          ? 'QAR'
          : defaultCurrency,
      position: isPosition(v.position) ? v.position : DEFAULT_CC_SETTINGS.position,
      label: typeof v.label === 'string' ? v.label.slice(0, 24) : '',
      showOriginalQar: Boolean(v.showOriginalQar),
    };
  } catch (err) {
    console.warn('[currency-converter] settings read failed', err);
    return DEFAULT_CC_SETTINGS;
  }
}

export async function saveCurrencyConverterSettings(
  storefrontSlug: string,
  patch: Partial<CurrencyConverterSettings>,
): Promise<CurrencyConverterSettings> {
  const current = await getCurrencyConverterSettings(storefrontSlug);
  const enabledRaw = Array.isArray(patch.enabledCurrencies)
    ? patch.enabledCurrencies
    : current.enabledCurrencies;
  const enabled = Array.from(
    new Set(enabledRaw.filter(isSupported).filter((c) => c !== 'QAR')),
  ).sort() as SupportedCurrency[];
  const desiredDefault = isSupported(patch.defaultCurrency)
    ? patch.defaultCurrency
    : current.defaultCurrency;
  const defaultCurrency =
    desiredDefault !== 'QAR' && !enabled.includes(desiredDefault) ? 'QAR' : desiredDefault;
  const next: CurrencyConverterSettings = {
    enabledCurrencies: enabled,
    defaultCurrency,
    position: isPosition(patch.position) ? patch.position : current.position,
    label: typeof patch.label === 'string' ? patch.label.slice(0, 24) : current.label,
    showOriginalQar:
      typeof patch.showOriginalQar === 'boolean'
        ? patch.showOriginalQar
        : current.showOriginalQar,
  };
  await setAppState(
    storefrontSlug,
    APP_ID,
    SETTINGS_KEY,
    next as unknown as Record<string, unknown>,
  );
  return next;
}

const memoryCache = new Map<string, RatesSnapshot>();

async function fetchUpstream(): Promise<RatesSnapshot | null> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/QAR', {
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      result?: string;
      base_code?: string;
      rates?: Record<string, number>;
    };
    if (json.result !== 'success' || !json.rates) return null;
    const filtered: Record<string, number> = {};
    for (const c of SUPPORTED_CURRENCIES) {
      if (typeof json.rates[c] === 'number') filtered[c] = json.rates[c];
    }
    return { base: 'QAR', rates: filtered, fetchedAt: Date.now() };
  } catch (err) {
    console.warn('[currency-converter] upstream fetch failed', err);
    return null;
  }
}

/**
 * Returns the freshest rates snapshot, falling back to the per-storefront
 * persisted snapshot when the upstream is unreachable. Returns null only
 * when there's neither cache nor backup — at which point the storefront
 * gracefully renders prices in QAR only.
 */
export async function getRatesForStore(
  storefrontSlug: string,
): Promise<RatesSnapshot | null> {
  const cached = memoryCache.get(storefrontSlug);
  if (cached && Date.now() - cached.fetchedAt < RATE_TTL_MS) return cached;

  const fresh = await fetchUpstream();
  if (fresh) {
    memoryCache.set(storefrontSlug, fresh);
    try {
      await setAppState(storefrontSlug, APP_ID, 'rates', {
        base: fresh.base,
        rates: fresh.rates,
        fetchedAt: fresh.fetchedAt,
      });
    } catch (err) {
      console.warn('[currency-converter] persisting snapshot failed', err);
    }
    return fresh;
  }

  if (cached) return cached;

  try {
    const stored = await getAppState(storefrontSlug, APP_ID, 'rates');
    if (stored && typeof stored.value === 'object') {
      const v = stored.value as Partial<RatesSnapshot>;
      if (v.rates && v.base && typeof v.fetchedAt === 'number') {
        const snap: RatesSnapshot = {
          base: 'QAR',
          rates: v.rates as Record<string, number>,
          fetchedAt: v.fetchedAt,
        };
        memoryCache.set(storefrontSlug, snap);
        return snap;
      }
    }
  } catch (err) {
    console.warn('[currency-converter] snapshot read failed', err);
  }

  return null;
}

export function convertQarTo(
  amountQar: number,
  target: SupportedCurrency,
  snapshot: RatesSnapshot | null,
): number {
  if (target === 'QAR' || !snapshot) return amountQar;
  const rate = snapshot.rates[target];
  if (typeof rate !== 'number' || rate <= 0) return amountQar;
  return amountQar * rate;
}

const symbols: Record<SupportedCurrency, string> = {
  QAR: 'QAR',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED',
  SAR: 'SAR',
};

export function formatPriceIn(
  amountQar: number,
  target: SupportedCurrency,
  snapshot: RatesSnapshot | null,
): string {
  const value = convertQarTo(amountQar, target, snapshot);
  if (target === 'USD' || target === 'EUR' || target === 'GBP') {
    return `${symbols[target]}${value.toFixed(2)}`;
  }
  return `${symbols[target]} ${value.toFixed(2)}`;
}
