'use server';

import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { assertStorefrontOwner, getAllProducts } from '@/lib/products';
import {
  installApp,
  uninstallApp,
  updateAppSettings,
  getInstalledApp,
} from '@/lib/apps/installed';
import { getAppDescriptor } from '@/lib/apps/registry';
import { encryptToken } from '@/lib/apps/crypto';
import { recordAudit } from '@/lib/audit';
import {
  UPGRADE_GROWTH_TOOLS_COPY,
  getPlan,
  planUnlocksIntegrations,
} from '@/lib/billing';
import {
  saveCurrencyConverterSettings,
  SUPPORTED_CURRENCIES,
} from '@/lib/apps/currency-converter';
import {
  postTestEvent as postZapierTestEvent,
  type ZapierEventKind,
} from '@/lib/apps/zapier';
import {
  syncBatch as notionSyncBatch,
  type NotionEntity,
} from '@/lib/apps/notion';
import { decryptToken } from '@/lib/apps/crypto';
import {
  parseServiceAccount,
  appendBatch as sheetsAppendBatch,
  HEADERS as SHEETS_HEADERS,
  inquiryRow as sheetsInquiryRow,
  orderRow as sheetsOrderRow,
  productRow as sheetsProductRow,
  normaliseSettings as normaliseSheetsSettings,
  type SheetsEntity,
} from '@/lib/apps/google-sheets';
import { listInquiries } from '@/lib/inquiries';
import { listOrders, getOrder } from '@/lib/orders';
import {
  saveDrop as saveDropPlugin,
  archiveDrop as archiveDropPlugin,
  type Drop,
} from '@/lib/apps/drop-manager';
import {
  saveKit as saveLookbookKitPlugin,
  removeKit as removeLookbookKitPlugin,
  type LookbookKit,
} from '@/lib/apps/lookbook';
import { runAudit, runLighthouseFor } from '@/lib/apps/seo-audit';
import type { SeoReport } from '@/lib/apps/seo-audit';
import { packSecrets as packAramexSecrets } from '@/lib/apps/aramex';
import {
  saveMawidSettings as saveMawidPlugin,
  type MawidSettings,
} from '@/lib/apps/mawid';
import {
  saveTaqimSettings as saveTaqimPlugin,
  type TaqimSettings,
} from '@/lib/apps/taqim';
import { revokeOAuthProvider } from '@/lib/apps/oauth-providers';
import { normaliseSettings as normaliseWhatsApp } from '@/lib/apps/whatsapp';

/**
 * Server actions for the marketplace. There are three doors:
 *
 *   1. installFreeApp(appId) — used by `authKind === 'none'` apps that
 *      need no credentials (e.g. Currency Converter).
 *   2. installWithApiKey(appId, apiKey, settings) — used by API-key apps
 *      (e.g. Giphy) where the founder pastes a key. The key is encrypted
 *      with AES-256-GCM before persisting.
 *   3. saveAppSettings(appId, settings) — updates the JSONB settings blob
 *      on an already-installed app.
 *
 * Uninstall is a single action shared across all auth kinds.
 */

export type AppActionState =
  | { status: 'idle' }
  | { status: 'success'; appId: string }
  | { status: 'error'; message: string };

const InstallFreeSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  appId: z.string().trim().min(1).max(64),
  settings: z.record(z.unknown()).optional().default({}),
});

export async function installFreeApp(
  input: z.input<typeof InstallFreeSchema>,
): Promise<AppActionState> {
  const parsed = InstallFreeSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const desc = getAppDescriptor(parsed.data.appId);
  if (!desc) return { status: 'error', message: 'Unknown app.' };
  if (!desc.available)
    return { status: 'error', message: 'This app is not available yet.' };
  if (desc.authKind !== 'none')
    return { status: 'error', message: 'This app needs configuration.' };

  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in to install apps.' };
  const owner = await assertStorefrontOwner(parsed.data.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  const plan = await getPlan(owner.clerkUserId);
  if (!planUnlocksIntegrations(plan)) {
    return { status: 'error', message: `${UPGRADE_GROWTH_TOOLS_COPY}.` };
  }

  try {
    await installApp(parsed.data.storefrontSlug, {
      appId: desc.id,
      installedBy: userId,
      settings: parsed.data.settings,
    });
    await recordAudit({
      storefrontSlug: parsed.data.storefrontSlug,
      clerkUserId: userId,
      action: 'app.install',
      targetId: desc.id,
      summary: `Installed ${desc.name}`,
    });
    revalidatePath('/account/apps');
    return { status: 'success', appId: desc.id };
  } catch (err) {
    console.error('[installFreeApp] failed', err);
    return { status: 'error', message: 'Install failed. Try again.' };
  }
}

const InstallApiKeySchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  appId: z.string().trim().min(1).max(64),
  apiKey: z.string().trim().min(1).max(512),
  settings: z.record(z.unknown()).optional().default({}),
});

export async function installWithApiKey(
  input: z.input<typeof InstallApiKeySchema>,
): Promise<AppActionState> {
  const parsed = InstallApiKeySchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const desc = getAppDescriptor(parsed.data.appId);
  if (!desc) return { status: 'error', message: 'Unknown app.' };
  if (!desc.available)
    return { status: 'error', message: 'This app is not available yet.' };
  if (desc.authKind !== 'api_key')
    return { status: 'error', message: 'This app uses a different sign-in.' };

  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in to install apps.' };
  const owner = await assertStorefrontOwner(parsed.data.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  const plan = await getPlan(owner.clerkUserId);
  if (!planUnlocksIntegrations(plan)) {
    return { status: 'error', message: `${UPGRADE_GROWTH_TOOLS_COPY}.` };
  }

  try {
    const ct = encryptToken(parsed.data.apiKey);
    await installApp(parsed.data.storefrontSlug, {
      appId: desc.id,
      installedBy: userId,
      settings: parsed.data.settings,
      accessTokenCt: ct,
    });
    await recordAudit({
      storefrontSlug: parsed.data.storefrontSlug,
      clerkUserId: userId,
      action: 'app.install',
      targetId: desc.id,
      summary: `Installed ${desc.name} (API key)`,
    });
    revalidatePath('/account/apps');
    return { status: 'success', appId: desc.id };
  } catch (err) {
    console.error('[installWithApiKey] failed', err);
    if (err instanceof Error && /encryption is not configured/.test(err.message)) {
      return {
        status: 'error',
        message:
          'APPS_ENCRYPTION_KEY is missing. Set it in Vercel env (a 32+ char passphrase) before installing key-based apps.',
      };
    }
    return { status: 'error', message: 'Install failed. Try again.' };
  }
}

const SettingsSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  appId: z.string().trim().min(1).max(64),
  settings: z.record(z.unknown()),
});

export async function saveAppSettings(
  input: z.input<typeof SettingsSchema>,
): Promise<AppActionState> {
  const parsed = SettingsSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in.' };
  const owner = await assertStorefrontOwner(parsed.data.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  const plan = await getPlan(owner.clerkUserId);
  if (!planUnlocksIntegrations(plan)) {
    return { status: 'error', message: `${UPGRADE_GROWTH_TOOLS_COPY}.` };
  }

  const existing = await getInstalledApp(parsed.data.storefrontSlug, parsed.data.appId);
  if (!existing) return { status: 'error', message: 'App is not installed.' };

  await updateAppSettings(
    parsed.data.storefrontSlug,
    parsed.data.appId,
    parsed.data.settings,
  );
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: userId,
    action: 'app.update',
    targetId: parsed.data.appId,
    summary: `Updated settings`,
  });
  revalidatePath('/account/apps');
  return { status: 'success', appId: parsed.data.appId };
}

const UninstallSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  appId: z.string().trim().min(1).max(64),
});

export async function uninstallAppAction(
  input: z.input<typeof UninstallSchema>,
): Promise<AppActionState> {
  const parsed = UninstallSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in.' };
  const owner = await assertStorefrontOwner(parsed.data.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  const existing = await getInstalledApp(parsed.data.storefrontSlug, parsed.data.appId);
  if (existing) {
    await revokeOAuthProvider(existing).catch(async () => {
      await recordAudit({
        storefrontSlug: parsed.data.storefrontSlug,
        clerkUserId: userId,
        action: 'app.oauth.revoke_failed',
        targetId: parsed.data.appId,
        summary: 'Provider token revoke failed during uninstall',
      }).catch(() => {});
    });
  }
  const ok = await uninstallApp(parsed.data.storefrontSlug, parsed.data.appId);
  if (!ok) return { status: 'error', message: 'App was not installed.' };
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: userId,
    action: 'app.uninstall',
    targetId: parsed.data.appId,
    summary: `Uninstalled app`,
  });
  revalidatePath('/account/apps');
  return { status: 'success', appId: parsed.data.appId };
}

const CcSettingsSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  enabledCurrencies: z
    .array(z.enum(SUPPORTED_CURRENCIES))
    .max(SUPPORTED_CURRENCIES.length),
  defaultCurrency: z.enum(SUPPORTED_CURRENCIES),
  position: z.enum(['floating-tr', 'floating-bl', 'header', 'footer']),
  label: z.string().max(24),
  showOriginalQar: z.boolean(),
});

/**
 * Strongly-typed settings save for the Currency Converter app.
 *
 * Lives next to `saveAppSettings` (which is a generic JSONB blob writer)
 * because the converter has a real schema we can validate, and the
 * dashboard form should never have to know about JSON shape.
 */
export async function saveCurrencyConverterAction(
  input: z.input<typeof CcSettingsSchema>,
): Promise<AppActionState> {
  const parsed = CcSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Invalid settings',
    };
  }
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in.' };
  const owner = await assertStorefrontOwner(parsed.data.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  const plan = await getPlan(owner.clerkUserId);
  if (!planUnlocksIntegrations(plan)) {
    return { status: 'error', message: `${UPGRADE_GROWTH_TOOLS_COPY}.` };
  }
  const existing = await getInstalledApp(
    parsed.data.storefrontSlug,
    'currency-converter',
  );
  if (!existing) return { status: 'error', message: 'Install the app first.' };

  await saveCurrencyConverterSettings(parsed.data.storefrontSlug, {
    enabledCurrencies: parsed.data.enabledCurrencies,
    defaultCurrency: parsed.data.defaultCurrency,
    position: parsed.data.position,
    label: parsed.data.label,
    showOriginalQar: parsed.data.showOriginalQar,
  });
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: userId,
    action: 'app.update',
    targetId: 'currency-converter',
    summary: 'Updated Currency Converter settings',
  });
  revalidatePath('/account/apps');
  return { status: 'success', appId: 'currency-converter' };
}

// ===========================================================================
// Per-plugin save actions for the nine functional plugins added in v1.
//
// Each action:
//   1. Validates the Clerk session + storefront ownership.
//   2. Verifies the app is installed (`saveAppSettings` is the catch-all
//      escape hatch for any future plugin that doesn't need its own
//      Zod-typed action; the ones below have schemas worth pinning).
//   3. Rewrites only the JSONB `settings` blob via `updateAppSettings`
//      so the credential vault columns are never touched.
//
// None of these actions mention provider names to the founder in error
// strings — the marketplace voice is "by Souqna" or the partner brand,
// nothing else.
// ===========================================================================

async function authoriseSettings(
  storefrontSlug: string,
  appId: string,
): Promise<{ ok: true; userId: string } | AppActionState> {
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in.' };
  const owner = await assertStorefrontOwner(storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  const plan = await getPlan(owner.clerkUserId);
  if (!planUnlocksIntegrations(plan)) {
    return { status: 'error', message: `${UPGRADE_GROWTH_TOOLS_COPY}.` };
  }
  const existing = await getInstalledApp(storefrontSlug, appId);
  if (!existing) return { status: 'error', message: 'Install the app first.' };
  return { ok: true, userId };
}

// ---- TikTok Pixel ---------------------------------------------------------

const TikTokSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  pixelId: z.string().trim().min(8).max(64),
  advancedMatching: z.boolean(),
  autoViewContent: z.boolean(),
  accessToken: z.string().trim().max(400).optional(),
});

export async function saveTikTokPixelAction(
  input: z.input<typeof TikTokSchema>,
): Promise<AppActionState> {
  const parsed = TikTokSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid settings' };
  const gate = await authoriseSettings(parsed.data.storefrontSlug, 'tiktok-pixel');
  if ('status' in gate) return gate;
  if (parsed.data.accessToken !== undefined) {
    try {
      const ct = parsed.data.accessToken
        ? encryptToken(parsed.data.accessToken)
        : '';
      await installApp(parsed.data.storefrontSlug, {
        appId: 'tiktok-pixel',
        installedBy: gate.userId,
        accessTokenCt: ct,
      });
    } catch (err) {
      if (err instanceof Error && /encryption is not configured/.test(err.message)) {
        return {
          status: 'error',
          message: 'Set APPS_ENCRYPTION_KEY before storing the access token.',
        };
      }
      return { status: 'error', message: 'Could not save the access token.' };
    }
  }
  await updateAppSettings(parsed.data.storefrontSlug, 'tiktok-pixel', {
    pixelId: parsed.data.pixelId,
    advancedMatching: parsed.data.advancedMatching,
    autoViewContent: parsed.data.autoViewContent,
  });
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: gate.userId,
    action: 'app.update',
    targetId: 'tiktok-pixel',
    summary: 'Updated TikTok Pixel settings',
  });
  revalidatePath('/account/apps');
  return { status: 'success', appId: 'tiktok-pixel' };
}

// ---- Zapier ---------------------------------------------------------------

const ZapierSaveSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  hookUrls: z
    .object({
      'inquiry.created': z.string().url().optional(),
      'order.created': z.string().url().optional(),
      'product.created': z.string().url().optional(),
    })
    .partial(),
});

export async function saveZapierAction(
  input: z.input<typeof ZapierSaveSchema>,
): Promise<AppActionState> {
  const parsed = ZapierSaveSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid settings' };
  const gate = await authoriseSettings(parsed.data.storefrontSlug, 'zapier');
  if ('status' in gate) return gate;
  await updateAppSettings(parsed.data.storefrontSlug, 'zapier', {
    hookUrls: parsed.data.hookUrls,
  });
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: gate.userId,
    action: 'app.update',
    targetId: 'zapier',
    summary: 'Updated Zapier hook URLs',
  });
  revalidatePath('/account/apps');
  return { status: 'success', appId: 'zapier' };
}

const ZapierTestSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  url: z.string().url(),
});

export async function testZapierHookAction(
  input: z.input<typeof ZapierTestSchema>,
): Promise<AppActionState> {
  const parsed = ZapierTestSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const gate = await authoriseSettings(parsed.data.storefrontSlug, 'zapier');
  if ('status' in gate) return gate;
  try {
    await postZapierTestEvent(parsed.data.url);
    return { status: 'success', appId: 'zapier' };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Webhook failed',
    };
  }
}

// Quiet "unused" guard — keeps the import live for future eventKind
// validation refactors.
void (null as unknown as ZapierEventKind);

// ---- WhatsApp Business ----------------------------------------------------

const WhatsAppSaveSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  storefrontInquiryMode: z.enum(['whatsapp', 'souqna_form']),
  inboundCreatesInquiries: z.boolean(),
  outboundMode: z.enum(['manual', 'template']),
  defaultReplyTemplate: z.string().trim().min(1).max(1000),
  inquiryTemplateName: z.string().trim().max(120),
  templateLanguage: z.string().trim().min(2).max(20),
});

export async function saveWhatsAppBusinessAction(
  input: z.input<typeof WhatsAppSaveSchema>,
): Promise<AppActionState> {
  const parsed = WhatsAppSaveSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid settings' };
  const gate = await authoriseSettings(
    parsed.data.storefrontSlug,
    'whatsapp-business',
  );
  if ('status' in gate) return gate;
  const installed = await getInstalledApp(parsed.data.storefrontSlug, 'whatsapp-business');
  const previous = normaliseWhatsApp(installed?.settings ?? {});
  await updateAppSettings(parsed.data.storefrontSlug, 'whatsapp-business', {
    ...previous,
    storefrontInquiryMode: parsed.data.storefrontInquiryMode,
    inboundCreatesInquiries: parsed.data.inboundCreatesInquiries,
    outboundMode: parsed.data.outboundMode,
    defaultReplyTemplate: parsed.data.defaultReplyTemplate,
    inquiryTemplateName: parsed.data.inquiryTemplateName,
    templateLanguage: parsed.data.templateLanguage,
  });
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: gate.userId,
    action: 'app.update',
    targetId: 'whatsapp-business',
    summary: 'Updated WhatsApp Business settings',
  });
  revalidatePath('/account/apps');
  revalidatePath('/brief/[slug]/[[...path]]', 'page');
  return { status: 'success', appId: 'whatsapp-business' };
}

// ---- Notion ---------------------------------------------------------------

const NotionSaveSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  databaseIds: z
    .object({
      inquiries: z.string().trim().max(64).optional(),
      orders: z.string().trim().max(64).optional(),
      products: z.string().trim().max(64).optional(),
    })
    .partial(),
});

export async function saveNotionAction(
  input: z.input<typeof NotionSaveSchema>,
): Promise<AppActionState> {
  const parsed = NotionSaveSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid settings' };
  const gate = await authoriseSettings(parsed.data.storefrontSlug, 'notion');
  if ('status' in gate) return gate;
  await updateAppSettings(parsed.data.storefrontSlug, 'notion', {
    databaseIds: parsed.data.databaseIds,
  });
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: gate.userId,
    action: 'app.update',
    targetId: 'notion',
    summary: 'Updated Notion database links',
  });
  revalidatePath('/account/apps');
  return { status: 'success', appId: 'notion' };
}

const NotionBackfillSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  entity: z.enum(['inquiries', 'orders', 'products']),
});

export async function notionBackfillAction(
  input: z.input<typeof NotionBackfillSchema>,
): Promise<AppActionState> {
  const parsed = NotionBackfillSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const gate = await authoriseSettings(parsed.data.storefrontSlug, 'notion');
  if ('status' in gate) return gate;
  const installed = await getInstalledApp(parsed.data.storefrontSlug, 'notion');
  if (!installed) return { status: 'error', message: 'Install the app first.' };
  const token = decryptToken(installed.oauthAccessTokenCt);
  if (!token) return { status: 'error', message: 'Re-install Notion: connection token unreadable.' };
  const settings = (installed.settings as { databaseIds?: Record<string, string> }) ?? {};
  const dbId = settings.databaseIds?.[parsed.data.entity];
  if (!dbId) return { status: 'error', message: 'Add a database link for this entity first.' };

  const entity: NotionEntity = parsed.data.entity;
  let payloads: Array<{ entity: NotionEntity; payload: unknown }> = [];
  if (entity === 'inquiries') {
    const rows = await listInquiries(parsed.data.storefrontSlug, { limit: 100 });
    payloads = rows.map((p) => ({ entity, payload: p }));
  } else if (entity === 'orders') {
    const rows = await listOrders(parsed.data.storefrontSlug, { limit: 100 });
    payloads = rows.map((p) => ({ entity, payload: p }));
  } else {
    const rows = await getAllProducts(parsed.data.storefrontSlug);
    payloads = rows.map((p) => ({ entity, payload: p }));
  }
  try {
    const result = await notionSyncBatch(token, dbId, payloads as never[]);
    if (result.failed > 0 && result.ok === 0) {
      return { status: 'error', message: result.lastError ?? 'Backfill failed' };
    }
    return { status: 'success', appId: 'notion' };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Backfill failed',
    };
  }
}

// ---- Google Sheets --------------------------------------------------------

const SheetsSaveSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  spreadsheetId: z.string().trim().min(1).max(120),
  appendOnEvent: z.boolean(),
  tabs: z.record(
    z.object({
      tabName: z.string().trim().max(80),
      enabled: z.boolean(),
    }),
  ),
});

export async function saveGoogleSheetsAction(
  input: z.input<typeof SheetsSaveSchema>,
): Promise<AppActionState> {
  const parsed = SheetsSaveSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid settings' };
  const gate = await authoriseSettings(parsed.data.storefrontSlug, 'google-sheets');
  if ('status' in gate) return gate;
  await updateAppSettings(parsed.data.storefrontSlug, 'google-sheets', {
    spreadsheetId: parsed.data.spreadsheetId,
    appendOnEvent: parsed.data.appendOnEvent,
    tabs: parsed.data.tabs,
  });
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: gate.userId,
    action: 'app.update',
    targetId: 'google-sheets',
    summary: 'Updated Google Sheets export settings',
  });
  revalidatePath('/account/apps');
  return { status: 'success', appId: 'google-sheets' };
}

const SheetsExportSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  entity: z.enum(['inquiries', 'orders', 'products']),
});

export async function googleSheetsExportAction(
  input: z.input<typeof SheetsExportSchema>,
): Promise<AppActionState> {
  const parsed = SheetsExportSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const gate = await authoriseSettings(parsed.data.storefrontSlug, 'google-sheets');
  if ('status' in gate) return gate;
  const installed = await getInstalledApp(parsed.data.storefrontSlug, 'google-sheets');
  if (!installed) return { status: 'error', message: 'Install the app first.' };
  const settings = normaliseSheetsSettings(
    installed.settings as Record<string, unknown>,
  );
  if (!settings.spreadsheetId) {
    return { status: 'error', message: 'Add a spreadsheet first.' };
  }
  const tab = settings.tabs[parsed.data.entity];
  if (!tab) return { status: 'error', message: 'No tab configured for this entity.' };
  const json = decryptToken(installed.oauthAccessTokenCt);
  const key = json ? parseServiceAccount(json) : null;
  if (!key) {
    return {
      status: 'error',
      message: 'Re-install with a valid service account JSON key.',
    };
  }
  const entity: SheetsEntity = parsed.data.entity;
  let rows: (string | number | null)[][] = [];
  if (entity === 'inquiries') {
    const items = await listInquiries(parsed.data.storefrontSlug, { limit: 200 });
    rows = items.map(sheetsInquiryRow);
  } else if (entity === 'orders') {
    const items = await listOrders(parsed.data.storefrontSlug, { limit: 200 });
    const detailed = await Promise.all(
      items.map((o) => getOrder(parsed.data.storefrontSlug, o.id)),
    );
    rows = items.map((o, i) => sheetsOrderRow(o, detailed[i]?.items ?? []));
  } else {
    const items = await getAllProducts(parsed.data.storefrontSlug);
    rows = items.map(sheetsProductRow);
  }
  // Always re-write the header row first so a fresh tab is self-explanatory.
  const allRows: (string | number | null)[][] = [SHEETS_HEADERS[entity], ...rows];
  try {
    await sheetsAppendBatch(key, settings.spreadsheetId, tab.tabName, allRows);
    return { status: 'success', appId: 'google-sheets' };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Export failed',
    };
  }
}

// ---- Crisp / Intercom / HubSpot ------------------------------------------

const CrispSaveSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  websiteId: z.string().trim().min(8).max(80),
  hideOnInquireOpen: z.boolean(),
  locale: z.enum(['auto', 'en', 'ar']),
});

export async function saveCrispAction(
  input: z.input<typeof CrispSaveSchema>,
): Promise<AppActionState> {
  const parsed = CrispSaveSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid settings' };
  const gate = await authoriseSettings(parsed.data.storefrontSlug, 'crisp');
  if ('status' in gate) return gate;
  await updateAppSettings(parsed.data.storefrontSlug, 'crisp', {
    websiteId: parsed.data.websiteId,
    hideOnInquireOpen: parsed.data.hideOnInquireOpen,
    locale: parsed.data.locale,
  });
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: gate.userId,
    action: 'app.update',
    targetId: 'crisp',
    summary: 'Updated Crisp settings',
  });
  revalidatePath('/account/apps');
  return { status: 'success', appId: 'crisp' };
}

const IntercomSaveSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  appId: z.string().trim().min(4).max(40),
  hideOnInquireOpen: z.boolean(),
});

export async function saveIntercomAction(
  input: z.input<typeof IntercomSaveSchema>,
): Promise<AppActionState> {
  const parsed = IntercomSaveSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid settings' };
  const gate = await authoriseSettings(parsed.data.storefrontSlug, 'intercom');
  if ('status' in gate) return gate;
  await updateAppSettings(parsed.data.storefrontSlug, 'intercom', {
    appId: parsed.data.appId,
    hideOnInquireOpen: parsed.data.hideOnInquireOpen,
  });
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: gate.userId,
    action: 'app.update',
    targetId: 'intercom',
    summary: 'Updated Intercom settings',
  });
  revalidatePath('/account/apps');
  return { status: 'success', appId: 'intercom' };
}

const HubspotSaveSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  hubId: z.string().trim().regex(/^\d{4,10}$/),
  formId: z.string().trim().max(64).optional().default(''),
  hideOnInquireOpen: z.boolean(),
});

export async function saveHubspotAction(
  input: z.input<typeof HubspotSaveSchema>,
): Promise<AppActionState> {
  const parsed = HubspotSaveSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid settings' };
  const gate = await authoriseSettings(parsed.data.storefrontSlug, 'hubspot');
  if ('status' in gate) return gate;
  await updateAppSettings(parsed.data.storefrontSlug, 'hubspot', {
    hubId: parsed.data.hubId,
    formId: parsed.data.formId,
    hideOnInquireOpen: parsed.data.hideOnInquireOpen,
  });
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: gate.userId,
    action: 'app.update',
    targetId: 'hubspot',
    summary: 'Updated HubSpot settings',
  });
  revalidatePath('/account/apps');
  return { status: 'success', appId: 'hubspot' };
}

// ---- Drop manager ---------------------------------------------------------

const DropSaveSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  drop: z.object({
    id: z.string().trim().max(64),
    name: z.string().trim().max(120),
    productIds: z.array(z.string().trim().min(1)).min(1).max(120),
    startsAt: z.string(),
    endsAt: z.string(),
    maxQty: z.number().int().positive().max(100_000).nullable(),
    soldCount: z.number().int().nonnegative().max(100_000).optional(),
    waitlistEnabled: z.boolean(),
    heroCopy: z.object({
      en: z.string().trim().max(160),
      ar: z.string().trim().max(160),
    }),
    accentVar: z.string().trim().max(64).nullable().optional(),
    archived: z.boolean().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  }),
});

export async function saveDropAction(
  input: z.input<typeof DropSaveSchema>,
): Promise<AppActionState & { drop?: Drop }> {
  const parsed = DropSaveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Invalid drop',
    };
  }
  const gate = await authoriseSettings(parsed.data.storefrontSlug, 'drop-manager');
  if ('status' in gate) return gate;
  const saved = await saveDropPlugin(parsed.data.storefrontSlug, {
    ...parsed.data.drop,
    soldCount: parsed.data.drop.soldCount ?? 0,
    accentVar: parsed.data.drop.accentVar ?? null,
    archived: parsed.data.drop.archived ?? false,
    createdAt: parsed.data.drop.createdAt ?? new Date().toISOString(),
    updatedAt: parsed.data.drop.updatedAt ?? new Date().toISOString(),
  });
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: gate.userId,
    action: 'app.update',
    targetId: 'drop-manager',
    summary: `Saved drop ${saved.name || saved.id}`,
  });
  revalidatePath('/account/apps');
  return { status: 'success', appId: 'drop-manager', drop: saved };
}

const DropArchiveSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  dropId: z.string().trim().min(1).max(64),
});

export async function archiveDropAction(
  input: z.input<typeof DropArchiveSchema>,
): Promise<AppActionState> {
  const parsed = DropArchiveSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const gate = await authoriseSettings(parsed.data.storefrontSlug, 'drop-manager');
  if ('status' in gate) return gate;
  await archiveDropPlugin(parsed.data.storefrontSlug, parsed.data.dropId);
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: gate.userId,
    action: 'app.update',
    targetId: 'drop-manager',
    summary: `Archived drop ${parsed.data.dropId}`,
  });
  revalidatePath('/account/apps');
  return { status: 'success', appId: 'drop-manager' };
}

// ---- Lookbook -------------------------------------------------------------

const LookbookSaveSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  kit: z.object({
    id: z.string().trim().max(64),
    fileSlug: z.string().trim().max(80),
    title: z.object({
      en: z.string().trim().max(160),
      ar: z.string().trim().max(160),
    }),
    intro: z.object({
      en: z.string().trim().max(2000),
      ar: z.string().trim().max(2000),
    }),
    productIds: z.array(z.string().trim().min(1)).min(1).max(200),
    coverImageUrl: z.string().trim().nullable(),
    accentVar: z.string().trim().nullable().optional(),
    pressContact: z.object({
      name: z.string().trim().max(120),
      email: z.string().trim().max(200),
      phone: z.string().trim().max(40),
    }),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  }),
});

export async function saveLookbookKitAction(
  input: z.input<typeof LookbookSaveSchema>,
): Promise<AppActionState & { kit?: LookbookKit }> {
  const parsed = LookbookSaveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Invalid kit',
    };
  }
  const gate = await authoriseSettings(parsed.data.storefrontSlug, 'lookbook');
  if ('status' in gate) return gate;
  const saved = await saveLookbookKitPlugin(parsed.data.storefrontSlug, {
    ...parsed.data.kit,
    accentVar: parsed.data.kit.accentVar ?? null,
    createdAt: parsed.data.kit.createdAt ?? new Date().toISOString(),
    updatedAt: parsed.data.kit.updatedAt ?? new Date().toISOString(),
  });
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: gate.userId,
    action: 'app.update',
    targetId: 'lookbook',
    summary: `Saved lookbook ${saved.title.en || saved.title.ar || saved.id}`,
  });
  revalidatePath('/account/apps');
  return { status: 'success', appId: 'lookbook', kit: saved };
}

const LookbookRemoveSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  kitId: z.string().trim().min(1).max(64),
});

export async function removeLookbookKitAction(
  input: z.input<typeof LookbookRemoveSchema>,
): Promise<AppActionState> {
  const parsed = LookbookRemoveSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const gate = await authoriseSettings(parsed.data.storefrontSlug, 'lookbook');
  if ('status' in gate) return gate;
  await removeLookbookKitPlugin(parsed.data.storefrontSlug, parsed.data.kitId);
  revalidatePath('/account/apps');
  return { status: 'success', appId: 'lookbook' };
}

// ---- SEO Assistant --------------------------------------------------------

const SeoSaveSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  allowIndex: z.boolean(),
  pagespeedKey: z.string().trim().max(120),
});

export async function saveSeoAssistantAction(
  input: z.input<typeof SeoSaveSchema>,
): Promise<AppActionState> {
  const parsed = SeoSaveSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid settings' };
  const gate = await authoriseSettings(parsed.data.storefrontSlug, 'seo-assistant');
  if ('status' in gate) return gate;
  await updateAppSettings(parsed.data.storefrontSlug, 'seo-assistant', {
    allowIndex: parsed.data.allowIndex,
    pagespeedKey: parsed.data.pagespeedKey,
  });
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: gate.userId,
    action: 'app.update',
    targetId: 'seo-assistant',
    summary: 'Updated SEO Assistant settings',
  });
  revalidatePath('/account/apps');
  return { status: 'success', appId: 'seo-assistant' };
}

const SeoRunSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
});

export async function runSeoAuditAction(
  input: z.input<typeof SeoRunSchema>,
): Promise<AppActionState & { report?: SeoReport }> {
  const parsed = SeoRunSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const gate = await authoriseSettings(parsed.data.storefrontSlug, 'seo-assistant');
  if ('status' in gate) return gate;
  const report = await runAudit(parsed.data.storefrontSlug);
  // Optional Lighthouse sidecar — only fires if the founder configured a key.
  try {
    const publicUrl = `https://${parsed.data.storefrontSlug}.souqna.qa`;
    const lh = await runLighthouseFor(parsed.data.storefrontSlug, publicUrl);
    if (lh) report.lighthouse = lh;
  } catch (err) {
    console.warn('[seo-assistant] lighthouse failed', err);
  }
  return { status: 'success', appId: 'seo-assistant', report };
}

// ---- Aramex ---------------------------------------------------------------

const AramexSaveSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  username: z.string().trim().min(1).max(120),
  accountNumber: z.string().trim().min(1).max(40),
  accountEntity: z.string().trim().min(2).max(8),
  accountCountry: z.string().trim().length(2),
  productGroup: z.enum(['DOM', 'EXP']),
  defaultProductType: z.string().trim().min(1).max(8),
  pickupAddress: z.object({
    line1: z.string().trim().max(200),
    line2: z.string().trim().max(200),
    city: z.string().trim().min(1).max(120),
    countryCode: z.string().trim().length(2),
    postCode: z.string().trim().max(40),
    contactName: z.string().trim().max(120),
    contactPhone: z.string().trim().max(40),
    contactEmail: z.string().trim().max(200),
  }),
  defaultWeightKg: z.number().positive().max(10_000),
  defaultDimensionsCm: z.object({
    length: z.number().positive().max(10_000),
    width: z.number().positive().max(10_000),
    height: z.number().positive().max(10_000),
  }),
  password: z.string().trim().max(200).optional(),
  accountPin: z.string().trim().max(80).optional(),
});

export async function saveAramexAction(
  input: z.input<typeof AramexSaveSchema>,
): Promise<AppActionState> {
  const parsed = AramexSaveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Invalid settings',
    };
  }
  const gate = await authoriseSettings(parsed.data.storefrontSlug, 'aramex');
  if ('status' in gate) return gate;

  // The settings blob never holds the password / PIN — they live in
  // the credential vault. We only re-encrypt when the founder ticked
  // the "Update password / PIN" box.
  if (parsed.data.password || parsed.data.accountPin) {
    const installed = await getInstalledApp(parsed.data.storefrontSlug, 'aramex');
    let currentPassword = '';
    let currentPin = '';
    if (installed) {
      const existingJson = decryptToken(installed.oauthAccessTokenCt);
      try {
        const existing = existingJson ? JSON.parse(existingJson) : {};
        currentPassword = typeof existing.password === 'string' ? existing.password : '';
        currentPin = typeof existing.accountPin === 'string' ? existing.accountPin : '';
      } catch {
        /* ignore */
      }
    }
    const password = parsed.data.password ?? currentPassword;
    const accountPin = parsed.data.accountPin ?? currentPin;
    try {
      const ct = encryptToken(packAramexSecrets(password, accountPin));
      await installApp(parsed.data.storefrontSlug, {
        appId: 'aramex',
        installedBy: gate.userId,
        accessTokenCt: ct,
      });
    } catch (err) {
      if (err instanceof Error && /encryption is not configured/.test(err.message)) {
        return {
          status: 'error',
          message: 'Set APPS_ENCRYPTION_KEY in your environment first.',
        };
      }
      return { status: 'error', message: 'Could not save credentials.' };
    }
  }

  await updateAppSettings(parsed.data.storefrontSlug, 'aramex', {
    username: parsed.data.username,
    accountNumber: parsed.data.accountNumber,
    accountEntity: parsed.data.accountEntity,
    accountCountry: parsed.data.accountCountry,
    productGroup: parsed.data.productGroup,
    defaultProductType: parsed.data.defaultProductType,
    pickupAddress: parsed.data.pickupAddress,
    defaultWeightKg: parsed.data.defaultWeightKg,
    defaultDimensionsCm: parsed.data.defaultDimensionsCm,
  });
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: gate.userId,
    action: 'app.update',
    targetId: 'aramex',
    summary: 'Updated Aramex settings',
  });
  revalidatePath('/account/apps');
  return { status: 'success', appId: 'aramex' };
}

// ---- Mawid (scheduled drops & countdowns) --------------------------------

const MawidEventSchema = z.object({
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().max(120),
  targetKind: z.enum(['product', 'collection', 'announcement']),
  targetId: z.string().trim().max(120).optional(),
  startsAt: z.string(),
  endsAt: z.string().optional(),
  preLaunch: z.enum(['hide', 'placeholder', 'countdown']),
  postLaunch: z.enum(['live', 'hide', 'soldOut']),
  scheduledPrice: z
    .object({
      price: z.number().nonnegative().max(10_000_000),
      compareAt: z.number().nonnegative().max(10_000_000).optional(),
    })
    .optional(),
  countdown: z.object({
    variant: z.enum(['boxed', 'inline', 'banner']),
    size: z.enum(['sm', 'md', 'lg']),
    labelEn: z.string().trim().max(60),
    labelAr: z.string().trim().max(60),
    finishedEn: z.string().trim().max(60),
    finishedAr: z.string().trim().max(60),
    accent: z.string().trim().max(64),
    showDays: z.boolean(),
    showHours: z.boolean(),
    showMinutes: z.boolean(),
    showSeconds: z.boolean(),
  }),
  hideWhenOos: z.boolean(),
  enabled: z.boolean(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const MawidSaveSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  settings: z.object({
    enabled: z.boolean(),
    defaultTimezone: z.string().trim().max(64),
    globalBanner: z.object({
      enabled: z.boolean(),
      eventId: z.string().trim().max(64).optional(),
    }),
    events: z.array(MawidEventSchema).max(60),
  }),
});

export async function saveMawidAction(
  input: z.input<typeof MawidSaveSchema>,
): Promise<AppActionState & { settings?: MawidSettings }> {
  const parsed = MawidSaveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Invalid Mawid settings',
    };
  }
  const gate = await authoriseSettings(parsed.data.storefrontSlug, 'mawid');
  if ('status' in gate) return gate;
  const now = new Date().toISOString();
  const next = await saveMawidPlugin(parsed.data.storefrontSlug, {
    ...parsed.data.settings,
    events: parsed.data.settings.events.map((e) => ({
      ...e,
      createdAt: e.createdAt ?? now,
      updatedAt: now,
    })),
  });
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: gate.userId,
    action: 'app.update',
    targetId: 'mawid',
    summary: `Saved Mawid (${next.events.length} event${next.events.length === 1 ? '' : 's'})`,
  });
  revalidatePath('/account/apps');
  return { status: 'success', appId: 'mawid', settings: next };
}

// ---- Taqim (bundles & complete-the-look) ---------------------------------

const TaqimBundleSchema = z.object({
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().max(120),
  kind: z.enum(['fixed', 'pickN', 'fbt']),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1).max(120),
        variantId: z.string().trim().max(120).optional(),
        required: z.boolean().optional(),
      }),
    )
    .max(40),
  anchorProductIds: z.array(z.string().trim().min(1).max(120)).max(120),
  pricing: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('fixed'), price: z.number().nonnegative().max(10_000_000) }),
    z.object({ mode: z.literal('percentOff'), percent: z.number().min(0).max(100) }),
    z.object({ mode: z.literal('amountOff'), amount: z.number().nonnegative().max(10_000_000) }),
  ]),
  titleEn: z.string().trim().max(120),
  titleAr: z.string().trim().max(120),
  subtitleEn: z.string().trim().max(280),
  subtitleAr: z.string().trim().max(280),
  ctaEn: z.string().trim().min(1).max(60),
  ctaAr: z.string().trim().min(1).max(60),
  stockPolicy: z.enum(['hideIfAnyOOS', 'showDisabled']),
  enabled: z.boolean(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const TaqimSaveSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  settings: z.object({
    enabled: z.boolean(),
    appearance: z.object({
      layout: z.enum(['stack', 'cards', 'carousel']),
      radius: z.enum(['sm', 'md', 'lg']),
      accent: z.string().trim().max(64),
      savingsTemplateEn: z.string().trim().max(80),
      savingsTemplateAr: z.string().trim().max(80),
    }),
    bundles: z.array(TaqimBundleSchema).max(60),
  }),
});

export async function saveTaqimAction(
  input: z.input<typeof TaqimSaveSchema>,
): Promise<AppActionState & { settings?: TaqimSettings }> {
  const parsed = TaqimSaveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Invalid Taqim settings',
    };
  }
  const gate = await authoriseSettings(parsed.data.storefrontSlug, 'taqim');
  if ('status' in gate) return gate;
  const now = new Date().toISOString();
  const next = await saveTaqimPlugin(parsed.data.storefrontSlug, {
    ...parsed.data.settings,
    bundles: parsed.data.settings.bundles.map((b) => ({
      ...b,
      createdAt: b.createdAt ?? now,
      updatedAt: now,
    })),
  });
  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: gate.userId,
    action: 'app.update',
    targetId: 'taqim',
    summary: `Saved Taqim (${next.bundles.length} bundle${next.bundles.length === 1 ? '' : 's'})`,
  });
  revalidatePath('/account/apps');
  return { status: 'success', appId: 'taqim', settings: next };
}
