'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal, flushSync } from 'react-dom';
import { usePathname, useSearchParams } from 'next/navigation';
import { findNavigableAnchor } from './navigationLinkSelector';
import { RouteSkeleton } from './RouteSkeleton';

/**
 * Global navigation loading overlay.
 *
 * Mounts once at the App Router root. While a same-origin client
 * navigation is in flight, portals a backdrop-blur overlay onto
 * `document.body` containing a `RouteSkeleton` for the destination URL,
 * so the user gets immediate "I'm going somewhere" feedback even if the
 * server is slow to render the next route.
 *
 * Behavior:
 *  - A capturing `click` listener on `document` notices internal Link/<a>
 *    clicks (filtered through `findNavigableAnchor`) and starts the loader
 *    with the target pathname.
 *  - Programmatic `router.push` callers can opt in via the
 *    `useNavigationLoader()` context — call `start(target)` before pushing.
 *  - `usePathname()` + `useSearchParams()` change → the navigation
 *    completed, hide the overlay.
 *  - Failsafes: 8s timeout auto-hides if a route hangs; Escape key hides
 *    so the user is never trapped.
 *  - Short minimum visible duration so fast client transitions still read
 *    as intentional feedback instead of a dead click.
 *  - Honors `prefers-reduced-motion` (still shows the wireframe, no
 *    shimmer) and is direction-agnostic (uses logical CSS properties
 *    throughout the skeleton tree).
 */

type LoaderContext = {
  start: (targetPathname: string) => void;
  stop: () => void;
};

const NavigationLoaderCtx = createContext<LoaderContext | null>(null);

export function useNavigationLoader(): LoaderContext {
  const ctx = useContext(NavigationLoaderCtx);
  // Outside the provider (server render or test), no-op so callers don't
  // have to special-case it.
  return ctx ?? { start: () => {}, stop: () => {} };
}

const MIN_VISIBLE_MS = 320;
const FAILSAFE_MS = 8_000;

/**
 * Allow-list of destinations that get the loading overlay.
 *
 * Core admin section changes can involve server work, so they should show
 * progress feedback. Same-page query changes are still filtered below so tab
 * switches and inline filters do not get a full-screen overlay.
 */
const LOADER_TARGET_PREFIXES = [
  '/account/orders',
  '/account/products',
  '/account/customers',
  '/account/inquiries',
  '/account/marketing',
  '/account/discounts',
  '/account/analytics',
  '/account/storage-library',
  '/account/builder',
  '/account/pos',
  '/account/apps',
  '/account/settings',
] as const;

const LOADER_EXCLUDED_PREFIXES = ['/account/souqna'] as const;

function shouldShowLoaderFor(currentPath: string, targetWithQuery: string): boolean {
  // Only same-origin navigations that originated from inside the admin shell.
  if (!currentPath.startsWith('/account')) return false;

  const targetPath = (targetWithQuery.split('?')[0] ?? '').replace(/\/+$/, '') || '/';
  if (
    LOADER_EXCLUDED_PREFIXES.some(
      (prefix) => targetPath === prefix || targetPath.startsWith(`${prefix}/`),
    )
  ) {
    return false;
  }

  // Home (/account exactly).
  if (targetPath === '/account') return true;

  return LOADER_TARGET_PREFIXES.some(
    (prefix) => targetPath === prefix || targetPath.startsWith(`${prefix}/`),
  );
}

export function NavigationLoader() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <NavigationLoaderInner />;
}

function NavigationLoaderInner() {
  const [target, setTarget] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleSinceRef = useRef<number | null>(null);
  // Tracks the (pathname, search) we were on when the navigation started.
  // We only auto-hide once the route key actually changes, so a same-path
  // click (which we already filter out, but defensive) wouldn't hang.
  const startSnapshotRef = useRef<string | null>(null);

  const clearTimers = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (failsafeTimerRef.current) {
      clearTimeout(failsafeTimerRef.current);
      failsafeTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearTimers();
    const finish = () => {
      setTarget(null);
      setVisible(false);
      startSnapshotRef.current = null;
      visibleSinceRef.current = null;
      hideTimerRef.current = null;
    };

    if (!visible || visibleSinceRef.current == null) {
      finish();
      return;
    }

    const elapsed = Date.now() - visibleSinceRef.current;
    if (elapsed >= MIN_VISIBLE_MS) {
      finish();
      return;
    }

    hideTimerRef.current = setTimeout(finish, MIN_VISIBLE_MS - elapsed);
  }, [clearTimers, visible]);

  const start = useCallback(
    (targetPathname: string) => {
      // Gate: only show the overlay for the handful of admin destinations
      // the user actually wants progress feedback on. Every other click
      // (Orders, Products, marketing pages, sign-out, etc.) is a no-op.
      if (!shouldShowLoaderFor(window.location.pathname, targetPathname)) {
        return;
      }

      // Same-path query-param changes (e.g. tab switches inside an app
      // page) keep the user on the current screen — surface chrome is
      // already mounted, so painting a full-screen skeleton over it is
      // jarring. Inline `<Suspense>` boundaries on the destination handle
      // any per-section streaming. Compare bare pathnames so `?foo=bar`
      // toggles are ignored but real route segment changes still win.
      const targetBarePath = targetPathname.split('?')[0] ?? '';
      if (targetBarePath === window.location.pathname) {
        return;
      }

      // Re-entrant start — restart the failsafe but keep the existing
      // overlay so consecutive clicks don't flash.
      clearTimers();
      // Normalize the snapshot through URLSearchParams so it matches the
      // format produced by `searchParams.toString()` in the auto-hide
      // effect below (no leading "?"). Without this, URLs with query
      // strings would auto-hide the loader on the first effect tick.
      const normalizedSearch = new URLSearchParams(window.location.search).toString();
      startSnapshotRef.current = `${window.location.pathname}?${normalizedSearch}`;
      visibleSinceRef.current = Date.now();
      flushSync(() => {
        setTarget(targetPathname);
        setVisible(true);
      });
      failsafeTimerRef.current = setTimeout(() => {
        stop();
      }, FAILSAFE_MS);
    },
    [clearTimers, stop],
  );

  // Click interception. Capturing phase so we beat any stopPropagation
  // happening downstream (e.g. command palette consumes its own clicks
  // but still navigates with router.push).
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const result = findNavigableAnchor(event);
      if (!result) return;
      start(result.url.pathname + result.url.search);
    }
    document.addEventListener('click', onClick, { capture: true });
    return () => {
      document.removeEventListener('click', onClick, { capture: true });
    };
  }, [start]);

  // Auto-hide once the URL actually changes — that's our signal the
  // destination route mounted.
  useEffect(() => {
    if (target == null) return;
    const key = `${pathname ?? ''}?${searchParams?.toString() ?? ''}`;
    if (startSnapshotRef.current && key !== startSnapshotRef.current) {
      stop();
    }
  }, [pathname, searchParams, target, stop]);

  // Esc to bail.
  useEffect(() => {
    if (target == null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') stop();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [target, stop]);

  // Cleanup on unmount.
  useEffect(() => () => clearTimers(), [clearTimers]);

  const ctxValue = useMemo<LoaderContext>(
    () => ({ start, stop }),
    [start, stop],
  );

  // CRITICAL: SSR and CSR must produce the EXACT same JSX shape, or
  // React aborts hydration and re-renders the entire subtree. Mounted
  // at a layout level, that bailout discards the document shell — which
  // is how the previous version of this loader took the whole app down.
  //
  // The portal is the only branch that must be client-only (it touches
  // `document.body`), so we gate just the `createPortal(...)` call —
  // not the surrounding JSX. `<StyleTag />` is server-renderable so it
  // emits identical markup on both sides.
  const portal =
    typeof document !== 'undefined' && visible && target != null
      ? createPortal(<Overlay target={target} />, document.body)
      : null;

  return (
    <NavigationLoaderCtx.Provider value={ctxValue}>
      <StyleTag />
      {portal}
    </NavigationLoaderCtx.Provider>
  );
}

function Overlay({ target }: { target: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483600,
        background: 'color-mix(in srgb, var(--surface-bg) 70%, transparent)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        overflow: 'hidden',
        animation: 'souqnaSkelFade 180ms ease-out both',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.85,
          pointerEvents: 'none',
        }}
      >
        <RouteSkeleton pathname={target.split('?')[0] ?? '/'} />
      </div>
    </div>
  );
}

/**
 * Inline keyframes + bone styling. Co-located so nothing about the
 * loader needs to land in `globals.css`. Mounted once per
 * NavigationLoader instance — React de-dupes the inner `<style>` text
 * on rerender, and there's only one loader instance app-wide.
 */
function StyleTag() {
  return (
    <style>{`
      @keyframes souqnaSkelShimmer {
        0% { background-position: -150% 0; }
        100% { background-position: 250% 0; }
      }
      @keyframes souqnaSkelFade {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes souqnaSkelSpin {
        to { transform: rotate(360deg); }
      }
      .souqna-skel-bone {
        background: var(--surface-rule);
        background-image: linear-gradient(
          90deg,
          color-mix(in srgb, var(--surface-rule) 100%, transparent) 0%,
          color-mix(in srgb, var(--surface-elevated) 65%, transparent) 50%,
          color-mix(in srgb, var(--surface-rule) 100%, transparent) 100%
        );
        background-size: 200% 100%;
        background-repeat: no-repeat;
        animation: souqnaSkelShimmer 1.4s linear infinite;
      }
      .souqna-skel-spinner {
        animation: souqnaSkelSpin 0.9s linear infinite;
      }
      [dir='rtl'] .souqna-skel-bone {
        animation-direction: reverse;
      }
      @media (prefers-reduced-motion: reduce) {
        .souqna-skel-bone,
        .souqna-skel-spinner {
          animation: none;
        }
      }
    `}</style>
  );
}
