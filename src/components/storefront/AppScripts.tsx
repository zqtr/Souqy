import Script from 'next/script';
import { getAppState } from '@/lib/apps/installed';
import {
  buildTikTokSnippet,
  type TikTokPixelSettings,
} from '@/lib/apps/tiktok-pixel';
import { buildCrispSnippet, type CrispSettings } from '@/lib/apps/crisp';
import { buildIntercomSnippet, type IntercomSettings } from '@/lib/apps/intercom';
import {
  buildHubspotSnippet,
  type HubspotSettings,
} from '@/lib/apps/hubspot';

/**
 * Injects per-plugin <script> snippets into the public storefront.
 *
 * One central server component handles every snippet-style plugin
 * (analytics pixels, chat widgets) so:
 *
 *  - The Storefront wrapper has a single mount point ({@link Storefront})
 *    instead of one client island per plugin.
 *  - Plugins surface their settings through `app_state` and we load
 *    them all on the server in a single round of `getAppState` calls.
 *  - Founders never see two chat widgets at once: the first installed
 *    chat plugin wins and the rest are skipped.
 *
 * Every snippet talks ONLY to the founder's own provider (their pixel
 * id, their chat website id). Souqna never proxies, never holds the
 * provider account.
 */

type Props = {
  storefrontSlug: string;
  installedAppIds: string[];
};

const CHAT_PLUGINS = ['crisp', 'intercom', 'hubspot'] as const;

export async function AppScripts({ storefrontSlug, installedAppIds }: Props) {
  const installed = new Set(installedAppIds);

  const tasks = await Promise.all([
    installed.has('tiktok-pixel')
      ? loadSettings<TikTokPixelSettings>(storefrontSlug, 'tiktok-pixel')
      : Promise.resolve(null),
    installed.has('crisp')
      ? loadSettings<CrispSettings>(storefrontSlug, 'crisp')
      : Promise.resolve(null),
    installed.has('intercom')
      ? loadSettings<IntercomSettings>(storefrontSlug, 'intercom')
      : Promise.resolve(null),
    installed.has('hubspot')
      ? loadSettings<HubspotSettings>(storefrontSlug, 'hubspot')
      : Promise.resolve(null),
  ]);

  const tiktokSettings = tasks[0] as TikTokPixelSettings | null;
  const crispSettings = tasks[1] as CrispSettings | null;
  const intercomSettings = tasks[2] as IntercomSettings | null;
  const hubspotSettings = tasks[3] as HubspotSettings | null;

  // Pick exactly one chat widget. Order matches CHAT_PLUGINS.
  const chatPicks = {
    crisp: crispSettings,
    intercom: intercomSettings,
    hubspot: hubspotSettings,
  };
  const activeChat = CHAT_PLUGINS.find((id) => installed.has(id) && chatPicks[id]);

  const snippets: Array<{ id: string; src: string; strategy?: 'afterInteractive' | 'lazyOnload' }> = [];

  if (tiktokSettings && tiktokSettings.pixelId) {
    snippets.push({
      id: 'tiktok-pixel',
      src: buildTikTokSnippet(tiktokSettings),
      strategy: 'afterInteractive',
    });
  }

  if (activeChat === 'crisp' && crispSettings?.websiteId) {
    snippets.push({
      id: 'crisp',
      src: buildCrispSnippet(crispSettings),
      strategy: 'lazyOnload',
    });
  }
  if (activeChat === 'intercom' && intercomSettings?.appId) {
    snippets.push({
      id: 'intercom',
      src: buildIntercomSnippet(intercomSettings),
      strategy: 'lazyOnload',
    });
  }
  if (activeChat === 'hubspot' && hubspotSettings?.hubId) {
    snippets.push({
      id: 'hubspot-tracking',
      src: buildHubspotSnippet(hubspotSettings),
      strategy: 'afterInteractive',
    });
  }

  if (snippets.length === 0) return null;

  return (
    <>
      {/* Tiny global helper used by storefront client code (e.g.
          InquireDialog) to fire pixel + chat events without each surface
          knowing which providers are installed. Plugins hook into this
          symbol below in their own <script> blocks. */}
      <Script id="souqna-track-helper" strategy="afterInteractive">
        {`window.__souqnaTrack = window.__souqnaTrack || function (event, props) {
  try {
    var hooks = window.__souqnaTrackHooks || (window.__souqnaTrackHooks = []);
    hooks.forEach(function (h) { try { h(event, props || {}); } catch (e) {} });
  } catch (e) {}
};`}
      </Script>
      {snippets.map((s) => (
        <Script
          key={s.id}
          id={`souqna-app-${s.id}`}
          strategy={s.strategy ?? 'afterInteractive'}
        >
          {s.src}
        </Script>
      ))}
    </>
  );
}

async function loadSettings<T>(slug: string, appId: string): Promise<T | null> {
  try {
    const row = await getAppState(slug, appId, 'settings');
    return (row?.value as T) ?? null;
  } catch (err) {
    console.warn(`[AppScripts] could not load ${appId} settings`, err);
    return null;
  }
}
