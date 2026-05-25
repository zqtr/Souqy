'use client';

import { useEffect, useRef } from 'react';

/**
 * Tiny client island that fires a `page_view` event into Souqna's
 * analytics pipeline as soon as the storefront mounts in the browser.
 * Mounted exactly once per public storefront page (via the brief page
 * server component).
 *
 * Privacy posture:
 *   - No third-party scripts (no GA, no Meta Pixel, no anything).
 *   - The visitor id is a UUIDv4 generated on first visit and stored in
 *     localStorage. Cleared by clearing site data; never sent to a 3p.
 *   - We capture `referrer host` only (no path), `user-agent`, and the
 *     pathname of the page the visitor is on. No fingerprinting.
 *   - We send via `navigator.sendBeacon` so the request fires even if
 *     the visitor immediately taps Back, while never blocking the page.
 *
 * The receiver is `/api/track` which writes to `analytics_events`.
 */
type Props = {
  storefrontSlug: string;
  productId?: string | null;
  /** When set, override the kind (e.g. 'product_view'). Defaults to 'page_view'. */
  kind?: StorefrontClientEventKind;
};

export type StorefrontClientEventKind =
  | 'page_view'
  | 'product_view'
  | 'cart_add'
  | 'cart_remove';

const VISITOR_KEY = 'souqna.visitor';
const SESSION_KEY = 'souqna.session';
// 30 minutes of inactivity = new session.
const SESSION_TTL_MS = 30 * 60 * 1000;

function uuid(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  // Fallback for older Safari iframe contexts.
  return 'xxxxxxxxyxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function readVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return uuid();
  }
}

function readSessionId(): string {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { id: string; at: number };
      if (parsed && Date.now() - parsed.at < SESSION_TTL_MS) {
        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ id: parsed.id, at: Date.now() }),
        );
        return parsed.id;
      }
    }
    const fresh = uuid();
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ id: fresh, at: Date.now() }),
    );
    return fresh;
  } catch {
    return uuid();
  }
}

function referrerHost(): string | null {
  try {
    if (!document.referrer) return null;
    const u = new URL(document.referrer);
    if (u.host === window.location.host) return null;
    return u.host;
  } catch {
    return null;
  }
}

export function TrackPageView({
  storefrontSlug,
  productId = null,
  kind = 'page_view',
}: Props) {
  const did = useRef(false);
  useEffect(() => {
    if (did.current) return;
    did.current = true;

    trackStorefrontEvent({
      storefrontSlug,
      kind,
      productId,
      meta: {
        path: window.location.pathname,
      },
    });
  }, [storefrontSlug, productId, kind]);

  return null;
}

export function trackStorefrontEvent(input: {
  storefrontSlug: string;
  kind: StorefrontClientEventKind;
  productId?: string | null;
  meta?: Record<string, unknown>;
}) {
  if (typeof window === 'undefined') return;

  const payload = JSON.stringify({
    storefrontSlug: input.storefrontSlug,
    kind: input.kind,
    visitorId: readVisitorId(),
    sessionId: readSessionId(),
    productId: input.productId ?? null,
    referrerHost: referrerHost(),
    meta: {
      path: window.location.pathname,
      ua: navigator.userAgent.slice(0, 240),
      lang: navigator.language,
      screen: `${window.innerWidth}x${window.innerHeight}`,
      ...(input.meta ?? {}),
    },
  });

  try {
    const blob = new Blob([payload], { type: 'application/json' });
    const ok = navigator.sendBeacon?.('/api/track', blob);
    if (ok) return;
  } catch {
    /* fall through to fetch */
  }
  fetch('/api/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}
