/**
 * App-wide light / dark theme primitives.
 *
 * The theme is persisted in a cookie (`souqna-theme`) so the server can
 * render the right `data-theme` attribute on `<html>` immediately — no
 * flash on first paint. An inline `<head>` script (THEME_INIT_SCRIPT)
 * runs before React hydrates to:
 *
 *   1. Read the cookie. If found, apply it.
 *   2. Otherwise, read `prefers-color-scheme` and persist that as the
 *      cookie so subsequent visits are stable (the user can flip later
 *      via the toggle, but OS changes won't auto-revert their pick).
 *
 * The toggle only writes `light` or `dark` — never an `auto` mode.
 * "Auto" only exists on the very first visit.
 */

export const THEME_COOKIE = 'souqna-theme';
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export function isTheme(v: unknown): v is Theme {
  return v === 'light' || v === 'dark';
}

/**
 * Server-side cookie reader. Used by Server Components that render
 * `<html>` so they can stamp the right `data-theme` before any HTML
 * leaves the server.
 *
 * Returns `null` if the cookie is missing — the caller should fall back
 * to `'light'` for the SSR pass; the inline script will quickly correct
 * the attribute to match the user's system preference and write the
 * cookie so the next request is stable.
 */
export function readThemeCookieFromHeader(cookieHeader: string | null | undefined): Theme | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)souqna-theme=(light|dark)\b/);
  return match && isTheme(match[1]) ? match[1] : null;
}

/**
 * Inline `<head>` script. Runs before paint. Keeps the document's
 * `data-theme` attribute synced with the cookie / system preference.
 *
 * Also listens for `storage` events so toggling theme in one tab
 * propagates instantly to the other tabs of the same origin.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k='souqna-theme';var d=document.documentElement;var c=document.cookie.match(/(?:^|;\\s*)souqna-theme=(light|dark)/);var t=c?c[1]:null;if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.cookie=k+'='+t+';path=/;max-age=31536000;SameSite=Lax';}d.setAttribute('data-theme',t);d.style.colorScheme=t;window.addEventListener('storage',function(e){if(e.key==='souqna-theme-bcast'&&(e.newValue==='light'||e.newValue==='dark')){d.setAttribute('data-theme',e.newValue);d.style.colorScheme=e.newValue;}});}catch(_){}})();`;
