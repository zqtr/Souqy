'use server';

import { auth } from '@clerk/nextjs/server';
import { assertStorefrontOwner, getAllProducts } from '@/lib/products';
import { getCategories } from '@/lib/categories';
import { getInstalledApp } from '@/lib/apps/installed';
import { getAppDescriptor } from '@/lib/apps/registry';
import { getCurrencyConverterSettings } from '@/lib/apps/currency-converter';
import {
  normaliseSettings as normaliseTikTok,
  DEFAULT_TIKTOK_SETTINGS,
} from '@/lib/apps/tiktok-pixel';
import {
  normaliseSettings as normaliseZapier,
  DEFAULT_ZAPIER_SETTINGS,
} from '@/lib/apps/zapier';
import {
  normaliseSettings as normaliseNotion,
  DEFAULT_NOTION_SETTINGS,
} from '@/lib/apps/notion';
import {
  normaliseSettings as normaliseSheets,
  DEFAULT_SHEETS_SETTINGS,
} from '@/lib/apps/google-sheets';
import {
  normaliseSettings as normaliseCrisp,
  DEFAULT_CRISP_SETTINGS,
} from '@/lib/apps/crisp';
import {
  normaliseSettings as normaliseIntercom,
  DEFAULT_INTERCOM_SETTINGS,
} from '@/lib/apps/intercom';
import {
  normaliseSettings as normaliseHubspot,
  DEFAULT_HUBSPOT_SETTINGS,
} from '@/lib/apps/hubspot';
import {
  normaliseSettings as normaliseSeo,
  DEFAULT_SEO_SETTINGS,
  runAudit,
} from '@/lib/apps/seo-audit';
import {
  normaliseSettings as normaliseAramex,
  DEFAULT_ARAMEX_SETTINGS,
} from '@/lib/apps/aramex';
import { listDrops } from '@/lib/apps/drop-manager';
import { listKits } from '@/lib/apps/lookbook';
import { getMawidSettings } from '@/lib/apps/mawid';
import { getTaqimSettings } from '@/lib/apps/taqim';

/**
 * Single shape returned to the builder's AppSettingsModal so it can
 * mount the right per-app settings form without round-tripping through
 * the configure page. Fields that don't apply to the requested app are
 * left undefined; the modal switches on `appId` to pick which to use.
 *
 * Mirrors the server-side fan-out in
 * `/account/apps/[id]/configure/page.tsx`. If a new plugin adds a new
 * preload, both paths must be updated.
 */
export type AppConfigContext = {
  appId: string;
  storefrontSlug: string;
  installedAt: string;
  enabled: boolean;
  /** Slim product list for any picker that needs storefront products. */
  products: Array<{ id: string; title: string; imageUrl: string | null }>;
  /** Storefront categories — for collection / category pickers. */
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
    productCount: number;
  }>;
  /** Per-app payloads (only the relevant one is populated). */
  ccSettings?: unknown;
  tiktokSettings?: unknown;
  zapierSettings?: unknown;
  notionSettings?: unknown;
  sheetsSettings?: unknown;
  crispSettings?: unknown;
  intercomSettings?: unknown;
  hubspotSettings?: unknown;
  seoSettings?: unknown;
  seoReport?: unknown;
  aramexSettings?: unknown;
  drops?: unknown;
  kits?: unknown;
  mawidSettings?: unknown;
  taqimSettings?: unknown;
};

export type LoadAppConfigContextResult =
  | { ok: true; context: AppConfigContext }
  | { ok: false; error: string };

export async function loadAppConfigContext(
  storefrontSlug: string,
  appId: string,
): Promise<LoadAppConfigContextResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Sign in required.' };

  const desc = getAppDescriptor(appId);
  if (!desc) return { ok: false, error: 'Unknown app.' };

  try {
    await assertStorefrontOwner(userId, storefrontSlug);
  } catch {
    return { ok: false, error: 'You do not own this storefront.' };
  }

  const installed = await getInstalledApp(storefrontSlug, appId);
  if (!installed) return { ok: false, error: 'App is not installed.' };

  const pluginSettings = installed.settings as Record<string, unknown>;

  const needsProducts =
    appId === 'drop-manager' ||
    appId === 'lookbook' ||
    appId === 'mawid' ||
    appId === 'taqim';
  const needsCategories = appId === 'mawid';

  const [products, categories] = await Promise.all([
    needsProducts
      ? getAllProducts(storefrontSlug).then((rows) =>
          rows.map((p) => ({ id: p.id, title: p.title, imageUrl: p.imageUrl })),
        )
      : Promise.resolve([] as AppConfigContext['products']),
    needsCategories
      ? getCategories(storefrontSlug).then((rows) =>
          rows.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            imageUrl: c.imageUrl,
            productCount: c.productCount,
          })),
        )
      : Promise.resolve([] as AppConfigContext['categories']),
  ]);

  const context: AppConfigContext = {
    appId,
    storefrontSlug,
    installedAt: installed.installedAt.toISOString(),
    enabled: installed.enabled,
    products,
    categories,
  };

  switch (appId) {
    case 'currency-converter':
      context.ccSettings = await getCurrencyConverterSettings(storefrontSlug);
      break;
    case 'tiktok-pixel':
      context.tiktokSettings =
        normaliseTikTok(pluginSettings) ?? DEFAULT_TIKTOK_SETTINGS;
      break;
    case 'zapier':
      context.zapierSettings =
        normaliseZapier(pluginSettings) ?? DEFAULT_ZAPIER_SETTINGS;
      break;
    case 'notion':
      context.notionSettings =
        normaliseNotion(pluginSettings) ?? DEFAULT_NOTION_SETTINGS;
      break;
    case 'google-sheets':
      context.sheetsSettings =
        normaliseSheets(pluginSettings) ?? DEFAULT_SHEETS_SETTINGS;
      break;
    case 'crisp':
      context.crispSettings =
        normaliseCrisp(pluginSettings) ?? DEFAULT_CRISP_SETTINGS;
      break;
    case 'intercom':
      context.intercomSettings =
        normaliseIntercom(pluginSettings) ?? DEFAULT_INTERCOM_SETTINGS;
      break;
    case 'hubspot':
      context.hubspotSettings =
        normaliseHubspot(pluginSettings) ?? DEFAULT_HUBSPOT_SETTINGS;
      break;
    case 'seo-assistant': {
      const [seoSettings, seoReport] = await Promise.all([
        Promise.resolve(normaliseSeo(pluginSettings) ?? DEFAULT_SEO_SETTINGS),
        runAudit(storefrontSlug),
      ]);
      context.seoSettings = seoSettings;
      context.seoReport = seoReport;
      break;
    }
    case 'aramex':
      context.aramexSettings =
        normaliseAramex(pluginSettings) ?? DEFAULT_ARAMEX_SETTINGS;
      break;
    case 'drop-manager':
      context.drops = await listDrops(storefrontSlug);
      break;
    case 'lookbook':
      context.kits = await listKits(storefrontSlug);
      break;
    case 'mawid':
      context.mawidSettings = await getMawidSettings(storefrontSlug);
      break;
    case 'taqim':
      context.taqimSettings = await getTaqimSettings(storefrontSlug);
      break;
    default:
      break;
  }

  return { ok: true, context };
}
