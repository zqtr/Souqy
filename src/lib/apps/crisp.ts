/**
 * Crisp Live Chat plugin.
 *
 * Auth: founder pastes their Crisp Website ID (UUID) — that's the
 * only thing required. The Website ID is embedded in the public
 * snippet on every Crisp-using site, so it isn't a secret; we still
 * encrypt it at rest because the rest of the apps system does.
 *
 * Souqna ships nothing on the Crisp side: the founder owns the
 * Crisp account, the inbox, and every conversation. Souqna is a
 * pure script-tag injector.
 */

export type CrispSettings = {
  websiteId: string;
  /** Hide the chat bubble while the inquire dialog is open so the two
   *  CTAs don't compete for attention. */
  hideOnInquireOpen: boolean;
  /** Locale override; otherwise Crisp auto-detects from `<html lang>`. */
  locale: 'auto' | 'en' | 'ar';
};

export const DEFAULT_CRISP_SETTINGS: CrispSettings = {
  websiteId: '',
  hideOnInquireOpen: true,
  locale: 'auto',
};

const WEBSITE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidWebsiteId(id: string): boolean {
  return WEBSITE_ID_RE.test(id.trim());
}

export function normaliseSettings(
  raw: Partial<CrispSettings> | null | undefined,
): CrispSettings {
  if (!raw) return DEFAULT_CRISP_SETTINGS;
  return {
    websiteId: typeof raw.websiteId === 'string' ? raw.websiteId.trim() : '',
    hideOnInquireOpen:
      typeof raw.hideOnInquireOpen === 'boolean'
        ? raw.hideOnInquireOpen
        : DEFAULT_CRISP_SETTINGS.hideOnInquireOpen,
    locale:
      raw.locale === 'en' || raw.locale === 'ar' || raw.locale === 'auto'
        ? raw.locale
        : 'auto',
  };
}

export function buildCrispSnippet(s: CrispSettings): string {
  const id = JSON.stringify(s.websiteId);
  const locale = JSON.stringify(s.locale === 'auto' ? '' : s.locale);
  const hideOnInquire = s.hideOnInquireOpen ? 'true' : 'false';
  return `
window.$crisp=[];
window.CRISP_WEBSITE_ID=${id};
${s.locale !== 'auto' ? `window.CRISP_RUNTIME_CONFIG={locale:${locale}};` : ''}
(function(){var d=document,s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();
if (${hideOnInquire}) {
  document.addEventListener('souqna:inquire:open', function () { try { window.$crisp.push(['do','chat:hide']); } catch(e){} });
  document.addEventListener('souqna:inquire:close', function () { try { window.$crisp.push(['do','chat:show']); } catch(e){} });
}
var hooks = window.__souqnaTrackHooks || (window.__souqnaTrackHooks = []);
hooks.push(function (event, props) {
  try { window.$crisp.push(['set','session:event',[[[event, props || {}]]]]); } catch (e) {}
});
`.trim();
}
