'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

/**
 * PostHog browser provider. Mounted once at the top of the App
 * Router tree so every nested page inherits the same client.
 *
 * We disable PostHog's automatic pageview tracking because
 * Next.js's App Router does soft client-side navigations that the
 * SDK can't observe. Instead the inner `<PageviewTracker />`
 * listens to Next's `usePathname` + `useSearchParams` and emits
 * `$pageview` manually.
 *
 * Init is gated on `NEXT_PUBLIC_POSTHOG_KEY`; without it the
 * provider is a transparent passthrough so local dev stays clean.
 */
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let initialized = false;

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (typeof window !== 'undefined' && POSTHOG_KEY && !initialized) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: 'identified_only',
      loaded: (ph) => {
        if (process.env.NODE_ENV === 'development') ph.debug(false);
      },
    });
    initialized = true;
  }

  if (!POSTHOG_KEY) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const url =
      pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    posthog.capture('$pageview', { $current_url: window.location.origin + url });
  }, [pathname, searchParams]);

  return null;
}
