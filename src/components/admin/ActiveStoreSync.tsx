'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Persists the active storefront across navigations.
 *
 * The chrome layout receives `?store=<slug>` as the source of truth for
 * the active store. When the founder lands on `/account/orders` without
 * a `store` param (e.g. they clicked a sidebar link from the Home tab),
 * this client island silently appends the param using the slug remembered
 * in `localStorage`. That keeps the URL stable for sharing while sparing
 * the founder from re-picking the store on every section.
 *
 * Order of precedence (URL wins):
 *   1. `?store=` in the URL    → write to localStorage, do nothing else
 *   2. `?store=` missing        → read from localStorage, append silently
 *   3. neither                  → noop (single-store founders never see
 *                                 the param at all)
 */
const STORAGE_KEY = 'souqna.activeStore';
const STORE_SYNC_EXCLUDED_PREFIXES = ['/account/souqna'] as const;

function shouldSyncStore(pathname: string | null): boolean {
  if (!pathname) return false;
  return !STORE_SYNC_EXCLUDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function ActiveStoreSync({
  knownSlugs,
  serverActiveSlug,
}: {
  knownSlugs: string[];
  serverActiveSlug: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const did = useRef(false);

  useEffect(() => {
    if (did.current) return;
    did.current = true;
    if (!shouldSyncStore(pathname)) return;

    const urlStore = searchParams?.get('store');
    if (urlStore && knownSlugs.includes(urlStore)) {
      try {
        localStorage.setItem(STORAGE_KEY, urlStore);
      } catch {
        /* ignore */
      }
      return;
    }

    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }

    if (
      stored &&
      knownSlugs.includes(stored) &&
      stored !== serverActiveSlug &&
      pathname
    ) {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('store', stored);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [knownSlugs, pathname, router, searchParams, serverActiveSlug]);

  return null;
}
