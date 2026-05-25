/**
 * Intercom Live Chat plugin.
 *
 * Auth: founder pastes their Intercom App ID (the short workspace id,
 * e.g. `ab12cd34`). Souqna injects the standard messenger snippet
 * with that id; everything else (inbox, automations, billing) stays
 * inside the founder's Intercom workspace.
 */

export type IntercomSettings = {
  appId: string;
  /** Optional alignment override the founder can flip from the default
   *  bottom-right; same accessibility consideration as Crisp's
   *  `hideOnInquireOpen`. */
  hideOnInquireOpen: boolean;
};

export const DEFAULT_INTERCOM_SETTINGS: IntercomSettings = {
  appId: '',
  hideOnInquireOpen: true,
};

const APP_ID_RE = /^[a-z0-9]{6,12}$/i;

export function isValidAppId(id: string): boolean {
  return APP_ID_RE.test(id.trim());
}

export function normaliseSettings(
  raw: Partial<IntercomSettings> | null | undefined,
): IntercomSettings {
  if (!raw) return DEFAULT_INTERCOM_SETTINGS;
  return {
    appId: typeof raw.appId === 'string' ? raw.appId.trim() : '',
    hideOnInquireOpen:
      typeof raw.hideOnInquireOpen === 'boolean'
        ? raw.hideOnInquireOpen
        : DEFAULT_INTERCOM_SETTINGS.hideOnInquireOpen,
  };
}

export function buildIntercomSnippet(s: IntercomSettings): string {
  const id = JSON.stringify(s.appId);
  const hideOnInquire = s.hideOnInquireOpen ? 'true' : 'false';
  return `
(function () {
  window.intercomSettings = { app_id: ${id} };
  var w = window, ic = w.Intercom;
  if (typeof ic === 'function') { ic('reattach_activator'); ic('update', w.intercomSettings); }
  else {
    var d = document;
    var i = function () { i.c(arguments); };
    i.q = [];
    i.c = function (args) { i.q.push(args); };
    w.Intercom = i;
    var l = function () {
      var s = d.createElement('script');
      s.type = 'text/javascript'; s.async = true;
      s.src = 'https://widget.intercom.io/widget/' + ${id};
      var x = d.getElementsByTagName('script')[0];
      x.parentNode.insertBefore(s, x);
    };
    if (document.readyState === 'complete') l();
    else if (w.attachEvent) w.attachEvent('onload', l);
    else w.addEventListener('load', l, false);
  }
  if (${hideOnInquire}) {
    document.addEventListener('souqna:inquire:open', function () { try { window.Intercom('hide'); } catch(e){} });
  }
  var hooks = w.__souqnaTrackHooks || (w.__souqnaTrackHooks = []);
  hooks.push(function (event, props) {
    try { window.Intercom('trackEvent', event, props || {}); } catch (e) {}
  });
})();
`.trim();
}
