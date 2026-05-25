/**
 * Click → navigable-anchor resolver.
 *
 * Walks the event composed path for the closest <a> element and decides
 * whether the click will actually trigger a same-tab, same-origin, App
 * Router navigation we should overlay a loading state for. Returns the
 * resolved target URL, or null if the click should be passed through
 * untouched (new-tab modifier, download link, hash-only jump, external,
 * mailto/tel, etc).
 *
 * Centralized so the loader stays focused on render/timing concerns.
 */
export function findNavigableAnchor(event: MouseEvent): { url: URL } | null {
  // Only primary-button clicks navigate.
  if (event.button !== 0) return null;
  if (event.defaultPrevented) return null;
  // New-tab / new-window / download modifiers — let the browser handle.
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return null;
  }

  const path = event.composedPath?.() ?? [];
  let anchor: HTMLAnchorElement | null = null;
  for (const node of path) {
    if (node instanceof HTMLAnchorElement) {
      anchor = node;
      break;
    }
  }
  if (!anchor) return null;

  // Anchor opt-outs.
  const target = anchor.getAttribute('target');
  if (target && target !== '_self') return null;
  if (anchor.hasAttribute('download')) return null;
  // Authors can hint "this isn't a real navigation" with data-no-loader.
  if (anchor.dataset.noLoader === 'true') return null;

  const href = anchor.getAttribute('href');
  if (!href) return null;
  // Schemes that don't navigate the page.
  if (
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('sms:') ||
    href.startsWith('javascript:')
  ) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return null;
  }

  // Different origin → hard navigation, browser handles its own UI.
  if (url.origin !== window.location.origin) return null;

  // Hash-only jump on the current page → not a route change.
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search &&
    url.hash !== window.location.hash
  ) {
    return null;
  }

  // Identical pathname + search → not a navigation worth overlaying.
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    return null;
  }

  return { url };
}
