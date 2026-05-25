import { getAppState, setAppState } from './apps/installed';

/**
 * Per-store Point-of-Sale (POS) register settings.
 *
 * Stored in the generic `app_state` table under
 * `(storefront_slug, app_id='pos', key='register')` so we don't need a
 * dedicated table for what is effectively one row per store. The shape
 * is small + JSONB, easy to evolve without migrations.
 */
export type PosRegister = {
  /** True once the founder has completed onboarding. */
  configured: boolean;
  /** Friendly location label, e.g. "Souq Waqif kiosk", "Lusail pop-up". */
  locationName: string;
  /** Optional 4-digit PIN required to open the till. Empty = no PIN. */
  pin: string;
  /** Cash on hand at the start of the current shift, in QAR. */
  cashFloat: number;
  /** Currency code recorded on every POS order. Defaults to QAR. */
  currencyCode: string;
  /** Tax-inclusive pricing toggle. Souqna POS treats all prices as
   *  inclusive by default — Qatar's market norm. */
  pricesIncludeTax: boolean;
  /** Optional receipt footer printed on tickets. */
  receiptFooter: string;
};

const DEFAULT_REGISTER: PosRegister = {
  configured: false,
  locationName: '',
  pin: '',
  cashFloat: 0,
  currencyCode: 'QAR',
  pricesIncludeTax: true,
  receiptFooter: 'Shukran. ◈',
};

const APP_ID = 'pos';
const KEY = 'register';

export async function getRegister(storefrontSlug: string): Promise<PosRegister> {
  const row = await getAppState(storefrontSlug, APP_ID, KEY);
  if (!row) return DEFAULT_REGISTER;
  const v = row.value as Partial<PosRegister>;
  return {
    configured: Boolean(v.configured),
    locationName: typeof v.locationName === 'string' ? v.locationName : '',
    pin: typeof v.pin === 'string' ? v.pin : '',
    cashFloat: typeof v.cashFloat === 'number' && Number.isFinite(v.cashFloat) ? v.cashFloat : 0,
    currencyCode: typeof v.currencyCode === 'string' && v.currencyCode ? v.currencyCode : 'QAR',
    pricesIncludeTax: v.pricesIncludeTax !== false,
    receiptFooter: typeof v.receiptFooter === 'string' ? v.receiptFooter : DEFAULT_REGISTER.receiptFooter,
  };
}

export async function saveRegister(
  storefrontSlug: string,
  patch: Partial<PosRegister>,
): Promise<PosRegister> {
  const current = await getRegister(storefrontSlug);
  const next: PosRegister = { ...current, ...patch };
  await setAppState(
    storefrontSlug,
    APP_ID,
    KEY,
    next as unknown as Record<string, unknown>,
  );
  return next;
}
