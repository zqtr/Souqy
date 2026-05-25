'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * Storefront currency switcher.
 *
 * Mounted only when the Currency Converter app is installed for the
 * active storefront (the storefront page reads `installedSet` and
 * passes it down). Reads the rates snapshot + the founder's saved
 * customisation in one round-trip from the public
 * `/api/apps/currency-converter/rates` endpoint, persists the visitor's
 * choice to localStorage, and rewrites every `[data-souqna-price]`
 * element on the page in-place.
 *
 * Honours the founder's settings:
 *   - `enabledCurrencies`  → which non-QAR options appear
 *   - `defaultCurrency`    → first-time visitor lands here
 *   - `position`           → floating-tr / floating-bl / header / footer
 *   - `label`              → optional text beside the code
 *   - `showOriginalQar`    → (storefront blocks read this from the same
 *                            cached snapshot via `data-souqna-cc-show-qar`)
 *
 * Why `data-souqna-price` instead of React context: the storefront
 * supports three independent rendering paths (Souqy AI bundle, Block
 * Pipeline, legacy templates) and not all of them have a React tree
 * we can wrap. The data-attribute hook works across all three with
 * one client island.
 */
const SUPPORTED = ['QAR', 'USD', 'EUR', 'GBP', 'AED', 'SAR'] as const;
type Currency = (typeof SUPPORTED)[number];
type Position = 'floating-tr' | 'floating-bl' | 'header' | 'footer';

const STORAGE_KEY = 'souqna:currency';

const symbols: Record<Currency, string> = {
  QAR: 'QAR',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED',
  SAR: 'SAR',
};

type Settings = {
  enabledCurrencies: Currency[];
  defaultCurrency: Currency;
  position: Position;
  label: string;
  showOriginalQar: boolean;
};

const DEFAULTS: Settings = {
  enabledCurrencies: ['USD', 'EUR', 'GBP', 'AED', 'SAR'],
  defaultCurrency: 'QAR',
  position: 'floating-tr',
  label: '',
  showOriginalQar: false,
};

export function CurrencyToggle({ storefrontSlug }: { storefrontSlug: string }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Currency>('QAR');
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [stale, setStale] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/apps/currency-converter/rates?store=${storefrontSlug}`, {
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        if (j.rates) setRates(j.rates as Record<string, number>);
        if (j.settings) setSettings(normalizeSettings(j.settings));
        if (j.fetchedAt) {
          setStale(Date.now() - Number(j.fetchedAt) > 1000 * 60 * 60 * 24);
        }
        const saved =
          (typeof window !== 'undefined' &&
            (localStorage.getItem(STORAGE_KEY) as Currency)) ||
          null;
        const def =
          j.settings?.defaultCurrency &&
          SUPPORTED.includes(j.settings.defaultCurrency as Currency)
            ? (j.settings.defaultCurrency as Currency)
            : 'QAR';
        const initial: Currency =
          saved && SUPPORTED.includes(saved) ? saved : def;
        setCurrent(initial);
        setHydrated(true);
      })
      .catch(() => {
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storefrontSlug]);

  useEffect(() => {
    if (!hydrated) return;
    rewriteAllPrices(current, rates, settings.showOriginalQar);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, current);
    }
  }, [current, rates, settings.showOriginalQar, hydrated]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;
    const obs = new MutationObserver(() => {
      rewriteAllPrices(current, rates, settings.showOriginalQar);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [current, rates, settings.showOriginalQar]);

  const choices = useMemo(() => {
    const list: Currency[] = ['QAR', ...settings.enabledCurrencies];
    return list.filter((c, i) => list.indexOf(c) === i);
  }, [settings.enabledCurrencies]);

  const wrapperStyle = positionStyle(settings.position);

  return (
    <div
      style={{
        ...wrapperStyle,
        zIndex: 999,
        fontFamily:
          'var(--storefront-sans, system-ui, -apple-system, "Segoe UI", sans-serif)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change currency"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          borderRadius: 999,
          background: 'var(--storefront-ground, #f1e9d7)',
          color: 'var(--storefront-ink, #1f1b16)',
          border: '1px solid rgba(31,27,22,0.18)',
          fontSize: 12.5,
          fontWeight: 500,
          cursor: 'pointer',
          letterSpacing: '0.04em',
          boxShadow: '0 4px 12px -8px rgba(0,0,0,0.25)',
        }}
      >
        <span>
          {settings.label ? `${settings.label} · ` : ''}
          {symbols[current]}
        </span>
        <span aria-hidden style={{ opacity: 0.55 }}>▾</span>
      </button>
      {open ? (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            ...dropdownAnchor(settings.position),
            background: 'var(--storefront-ground, #f1e9d7)',
            color: 'var(--storefront-ink, #1f1b16)',
            border: '1px solid rgba(31,27,22,0.18)',
            borderRadius: 12,
            padding: 6,
            minWidth: 180,
            boxShadow: '0 18px 40px -16px rgba(0,0,0,0.35)',
          }}
        >
          {choices.map((c) => (
            <button
              key={c}
              type="button"
              role="option"
              aria-selected={c === current}
              onClick={() => {
                setCurrent(c);
                setOpen(false);
              }}
              style={{
                display: 'flex',
                width: '100%',
                justifyContent: 'space-between',
                gap: 12,
                padding: '8px 10px',
                borderRadius: 8,
                background: c === current ? 'rgba(168,137,63,0.16)' : 'transparent',
                color: 'inherit',
                border: 'none',
                fontFamily: 'inherit',
                fontSize: 13,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span>{c}</span>
              <span style={{ opacity: 0.55, fontVariantNumeric: 'tabular-nums' }}>
                {c === 'QAR' || !rates?.[c]
                  ? '—'
                  : rates[c]!.toFixed(c === 'USD' || c === 'EUR' || c === 'GBP' ? 4 : 3)}
              </span>
            </button>
          ))}
          {stale ? (
            <p
              style={{
                margin: '6px 8px 4px',
                fontSize: 11,
                opacity: 0.6,
                lineHeight: 1.45,
              }}
            >
              Showing cached rates — refreshing in the background.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function normalizeSettings(s: unknown): Settings {
  if (!s || typeof s !== 'object') return DEFAULTS;
  const obj = s as Record<string, unknown>;
  const enabled = Array.isArray(obj.enabledCurrencies)
    ? (obj.enabledCurrencies as unknown[]).filter(
        (c): c is Currency => typeof c === 'string' && SUPPORTED.includes(c as Currency) && c !== 'QAR',
      )
    : DEFAULTS.enabledCurrencies;
  const def =
    typeof obj.defaultCurrency === 'string' && SUPPORTED.includes(obj.defaultCurrency as Currency)
      ? (obj.defaultCurrency as Currency)
      : 'QAR';
  const pos =
    obj.position === 'floating-tr' ||
    obj.position === 'floating-bl' ||
    obj.position === 'header' ||
    obj.position === 'footer'
      ? (obj.position as Position)
      : DEFAULTS.position;
  return {
    enabledCurrencies: enabled,
    defaultCurrency: def !== 'QAR' && !enabled.includes(def) ? 'QAR' : def,
    position: pos,
    label: typeof obj.label === 'string' ? obj.label.slice(0, 24) : '',
    showOriginalQar: Boolean(obj.showOriginalQar),
  };
}

function positionStyle(p: Position): React.CSSProperties {
  switch (p) {
    case 'floating-tr':
      return { position: 'fixed', top: 18, right: 18 };
    case 'floating-bl':
      return { position: 'fixed', bottom: 18, left: 18 };
    case 'header':
      return { position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)' };
    case 'footer':
      return { position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)' };
  }
}

function dropdownAnchor(p: Position): React.CSSProperties {
  switch (p) {
    case 'floating-tr':
      return { top: 'calc(100% + 6px)', right: 0 };
    case 'floating-bl':
      return { bottom: 'calc(100% + 6px)', left: 0 };
    case 'header':
      return { top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' };
    case 'footer':
      return { bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' };
  }
}

function rewriteAllPrices(
  current: Currency,
  rates: Record<string, number> | null,
  showOriginalQar: boolean,
) {
  if (typeof document === 'undefined') return;
  const els = document.querySelectorAll<HTMLElement>('[data-souqna-price]');
  els.forEach((el) => {
    const qarText = el.dataset.souqnaPrice;
    if (!qarText) return;
    const qar = Number(qarText);
    if (!Number.isFinite(qar)) return;
    const converted =
      current === 'QAR' || !rates || !rates[current]
        ? `QAR ${qar.toFixed(2)}`
        : current === 'USD' || current === 'EUR' || current === 'GBP'
          ? `${symbols[current]}${(qar * rates[current]!).toFixed(2)}`
          : `${symbols[current]} ${(qar * rates[current]!).toFixed(2)}`;
    if (showOriginalQar && current !== 'QAR') {
      el.innerHTML =
        `${escapeHtml(converted)}` +
        `<span style="display:inline-block;margin-left:6px;opacity:0.55;font-size:0.72em;text-decoration:line-through;">QAR ${qar.toFixed(2)}</span>`;
    } else {
      el.textContent = converted;
    }
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
