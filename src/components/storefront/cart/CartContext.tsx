'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { trackStorefrontEvent } from '../TrackPageView';

/**
 * Buyer-side cart for the M3 checkout flow. Persists per-storefront in
 * localStorage under `souqna:cart:{slug}` so a buyer can browse, leave,
 * and resume on the same device. The cart never leaves the browser
 * until the buyer hits checkout — `createOrder` is the only path that
 * sends the line items to the server.
 *
 * The provider is intentionally thin (no reducer, no selectors) — the
 * surface is small enough that one map + a setter does the job. When
 * `enabled=false` (storefront has no payment methods configured) every
 * mutator becomes a no-op and the drawer can never open. This keeps
 * the "Add to cart" CTA harmless to wire on every product without
 * having to know whether checkout is configured.
 */

export type CartLineItem = {
  lineId: string;
  productId: string;
  title: string;
  variantLabel?: string | null;
  customInputs?: Record<string, string>;
  priceQar: number;
  imageUrl?: string | null;
  quantity: number;
};

export type CartAddItem = Omit<CartLineItem, 'lineId' | 'quantity'>;

export type CartContextValue = {
  enabled: boolean;
  items: CartLineItem[];
  count: number;
  subtotalQar: number;
  add(item: CartAddItem, qty?: number): void;
  remove(lineId: string): void;
  setQuantity(lineId: string, qty: number): void;
  clear(): void;
  isOpen: boolean;
  open(): void;
  close(): void;
  toggle(): void;
};

const MAX_QTY_PER_LINE = 99;

const CartContext = createContext<CartContextValue | null>(null);

const SERVER_SNAPSHOT: CartLineItem[] = [];

type Store = {
  read(): CartLineItem[];
  write(items: CartLineItem[]): void;
  subscribe(cb: () => void): () => void;
};

/**
 * Tiny external store backed by localStorage so we can use
 * `useSyncExternalStore` to fully avoid SSR/CSR hydration mismatch:
 * server snapshot is always `[]`, the client snapshot reflects whatever
 * is in storage at hydration time. Subscribers also listen to the
 * `storage` event so two tabs on the same store stay in sync.
 */
function makeStore(slug: string, enabled: boolean): Store {
  const key = `souqna:cart:${slug}`;
  let cached: CartLineItem[] | null = null;
  const listeners = new Set<() => void>();

  function readRaw(): CartLineItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidItem).map(normalize);
    } catch {
      return [];
    }
  }

  function notify() {
    cached = null;
    for (const l of listeners) l();
  }

  return {
    read() {
      if (!enabled) return SERVER_SNAPSHOT;
      if (cached) return cached;
      cached = readRaw();
      return cached;
    },
    write(items) {
      if (!enabled || typeof window === 'undefined') return;
      try {
        if (items.length === 0) {
          window.localStorage.removeItem(key);
        } else {
          window.localStorage.setItem(key, JSON.stringify(items));
        }
      } catch {
        // Quota / privacy mode — fail soft so the cart still works
        // in-memory for the current page view.
      }
      cached = items;
      for (const l of listeners) l();
    },
    subscribe(cb) {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key || e.key === null) notify();
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('storage', onStorage);
      }
      return () => {
        listeners.delete(cb);
        if (typeof window !== 'undefined') {
          window.removeEventListener('storage', onStorage);
        }
      };
    },
  };
}

function isValidItem(v: unknown): v is CartLineItem {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.productId === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.priceQar === 'number' &&
    typeof obj.quantity === 'number' &&
    obj.quantity > 0
  );
}

function normalizeCustomInputs(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== 'string') continue;
    const normalized = raw.replace(/\s+/g, ' ').trim();
    if (normalized) out[key] = normalized;
  }
  return out;
}

function lineIdFor(
  productId: string,
  variantLabel?: string | null,
  customInputs?: Record<string, string>,
): string {
  const entries = Object.entries(normalizeCustomInputs(customInputs)).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return JSON.stringify([productId, variantLabel?.trim() ?? '', entries]);
}

function normalize(it: CartLineItem): CartLineItem {
  const variantLabel = it.variantLabel?.trim() || null;
  const customInputs = normalizeCustomInputs(it.customInputs);
  return {
    lineId: it.lineId || lineIdFor(it.productId, variantLabel, customInputs),
    productId: it.productId,
    title: it.title,
    variantLabel,
    customInputs,
    priceQar: Math.max(0, Math.round(it.priceQar)),
    imageUrl: it.imageUrl ?? null,
    quantity: Math.min(MAX_QTY_PER_LINE, Math.max(1, Math.floor(it.quantity))),
  };
}

export function CartProvider(props: {
  storefrontSlug: string;
  enabled: boolean;
  currency: string;
  children: ReactNode;
}): JSX.Element {
  const { storefrontSlug, enabled, children } = props;

  // Keep the store stable per (slug, enabled) tuple so subscribers
  // don't churn between renders.
  const storeRef = useRef<{ slug: string; enabled: boolean; store: Store } | null>(null);
  if (
    !storeRef.current ||
    storeRef.current.slug !== storefrontSlug ||
    storeRef.current.enabled !== enabled
  ) {
    storeRef.current = {
      slug: storefrontSlug,
      enabled,
      store: makeStore(storefrontSlug, enabled),
    };
  }
  const store = storeRef.current.store;

  const items = useSyncExternalStore(store.subscribe, store.read, () => SERVER_SNAPSHOT);

  const [isOpen, setIsOpen] = useState(false);

  // Defensive: a parent flipping `enabled` from true → false should
  // never leave the drawer mounted in an open state.
  useEffect(() => {
    if (!enabled && isOpen) setIsOpen(false);
  }, [enabled, isOpen]);

  const add = useCallback(
    (item: CartAddItem, qty: number = 1) => {
      if (!enabled) return;
      const safeQty = Math.max(1, Math.floor(qty));
      const variantLabel = item.variantLabel?.trim() || null;
      const customInputs = normalizeCustomInputs(item.customInputs);
      const lineId = lineIdFor(item.productId, variantLabel, customInputs);
      const next = [...store.read()];
      const idx = next.findIndex((l) => l.lineId === lineId);
      if (idx >= 0) {
        const merged = Math.min(MAX_QTY_PER_LINE, next[idx]!.quantity + safeQty);
        next[idx] = { ...next[idx]!, quantity: merged };
      } else {
        next.push(
          normalize({
            lineId,
            productId: item.productId,
            title: item.title,
            variantLabel,
            customInputs,
            priceQar: item.priceQar,
            imageUrl: item.imageUrl ?? null,
            quantity: safeQty,
          }),
        );
      }
      store.write(next);
      trackStorefrontEvent({
        storefrontSlug,
        kind: 'cart_add',
        productId: item.productId,
        meta: {
          title: item.title,
          priceQar: item.priceQar,
          quantity: safeQty,
          variantLabel,
          customInputs,
        },
      });
    },
    [enabled, store, storefrontSlug],
  );

  const remove = useCallback(
    (lineId: string) => {
      if (!enabled) return;
      const current = store.read();
      const removed = current.find((l) => l.lineId === lineId);
      store.write(current.filter((l) => l.lineId !== lineId));
      if (removed) {
        trackStorefrontEvent({
          storefrontSlug,
          kind: 'cart_remove',
          productId: removed.productId,
          meta: {
            title: removed.title,
            priceQar: removed.priceQar,
            quantity: removed.quantity,
            variantLabel: removed.variantLabel ?? null,
            customInputs: removed.customInputs ?? {},
          },
        });
      }
    },
    [enabled, store, storefrontSlug],
  );

  const setQuantity = useCallback(
    (lineId: string, qty: number) => {
      if (!enabled) return;
      if (qty <= 0) {
        const current = store.read();
        const removed = current.find((l) => l.lineId === lineId);
        store.write(current.filter((l) => l.lineId !== lineId));
        if (removed) {
          trackStorefrontEvent({
            storefrontSlug,
            kind: 'cart_remove',
            productId: removed.productId,
            meta: {
              title: removed.title,
              priceQar: removed.priceQar,
              quantity: removed.quantity,
              variantLabel: removed.variantLabel ?? null,
              customInputs: removed.customInputs ?? {},
            },
          });
        }
        return;
      }
      const capped = Math.min(MAX_QTY_PER_LINE, Math.floor(qty));
      store.write(store.read().map((l) => (l.lineId === lineId ? { ...l, quantity: capped } : l)));
    },
    [enabled, store, storefrontSlug],
  );

  const clear = useCallback(() => {
    if (!enabled) return;
    store.write([]);
  }, [enabled, store]);

  const open = useCallback(() => {
    if (!enabled) return;
    if (typeof console !== 'undefined') {
      console.trace('[souqna/cart] open() called');
    }
    setIsOpen(true);
  }, [enabled]);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => {
    if (!enabled) return;
    setIsOpen((v) => !v);
  }, [enabled]);

  const value = useMemo<CartContextValue>(() => {
    const count = enabled ? items.reduce((acc, l) => acc + l.quantity, 0) : 0;
    const subtotalQar = enabled ? items.reduce((acc, l) => acc + l.priceQar * l.quantity, 0) : 0;
    return {
      enabled,
      items: enabled ? items : SERVER_SNAPSHOT,
      count,
      subtotalQar,
      add,
      remove,
      setQuantity,
      clear,
      isOpen: enabled ? isOpen : false,
      open,
      close,
      toggle,
    };
  }, [enabled, items, add, remove, setQuantity, clear, isOpen, open, close, toggle]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a <CartProvider>');
  }
  return ctx;
}
