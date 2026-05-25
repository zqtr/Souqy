import { getAppState, setAppState } from '@/lib/apps/installed';

const APP_ID = 'souqnasource';
const KEY = 'settings';

export type SouqnasourceSettings = {
  driftThreshold: number;
  defaultMarkup: Record<string, number>;
  areaFilter: string[];
  includeUnverified: boolean;
  emailDigestOptOut: boolean;
};

export const DEFAULT_SETTINGS: SouqnasourceSettings = {
  driftThreshold: 0.10,
  defaultMarkup: {},
  areaFilter: [],
  includeUnverified: true,
  emailDigestOptOut: false,
};

export async function getSettings(slug: string): Promise<SouqnasourceSettings> {
  const row = await getAppState(slug, APP_ID, KEY).catch(() => null);
  if (!row) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(row.value as Partial<SouqnasourceSettings>) };
}

export async function saveSettings(
  slug: string,
  patch: Partial<SouqnasourceSettings>,
): Promise<SouqnasourceSettings> {
  const current = await getSettings(slug);
  const next = { ...current, ...patch };
  await setAppState(slug, APP_ID, KEY, next as unknown as Record<string, unknown>);
  return next;
}
