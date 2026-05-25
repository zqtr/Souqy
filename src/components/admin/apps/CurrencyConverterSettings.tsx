'use client';

import { useState, useTransition } from 'react';
import { saveCurrencyConverterAction } from '@/app/actions/apps';
import {
  SUPPORTED_CURRENCIES,
  type CurrencyConverterSettings as Settings,
  type CurrencyPosition,
  type SupportedCurrency,
} from '@/lib/apps/currency-converter';
import { Surface } from '../primitives';

const SWITCHABLE = SUPPORTED_CURRENCIES.filter((c) => c !== 'QAR') as readonly SupportedCurrency[];

const POSITION_LABELS: Record<CurrencyPosition, { title: string; sub: string }> = {
  'floating-tr': { title: 'Floating chip · top right', sub: 'Always visible. Recommended.' },
  'floating-bl': { title: 'Floating chip · bottom left', sub: 'Out of the way for desktop carts.' },
  header: { title: 'Inside your header', sub: 'Sits next to the navigation links.' },
  footer: { title: 'Inside your footer', sub: 'Subtle — for stores with few non-QAR visitors.' },
};

const FLAGS: Record<SupportedCurrency, string> = {
  QAR: 'ðŸ‡¶ðŸ‡¦',
  USD: 'ðŸ‡ºðŸ‡¸',
  EUR: 'ðŸ‡ªðŸ‡º',
  GBP: 'ðŸ‡¬ðŸ‡§',
  AED: 'ðŸ‡¦ðŸ‡ª',
  SAR: 'ðŸ‡¸ðŸ‡¦',
};

const NAMES: Record<SupportedCurrency, string> = {
  QAR: 'Qatari Riyal',
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  AED: 'UAE Dirham',
  SAR: 'Saudi Riyal',
};

type Props = {
  storefrontSlug: string;
  initial: Settings;
};

/**
 * Founder-facing customisation form for the Currency Converter.
 *
 * Deliberately friendly:
 *   - No mention of any upstream rate provider, no JSON, no API key.
 *   - Toggles for which currencies appear, default, where the switcher
 *     sits, custom label, and whether to show the original QAR price
 *     as a strikethrough next to the converted price.
 *   - Saves through `saveCurrencyConverterAction` and shows a small
 *     "Saved" pill that fades after 1.5s.
 */
export function CurrencyConverterSettingsForm({ storefrontSlug, initial }: Props) {
  const [enabled, setEnabled] = useState<Set<SupportedCurrency>>(
    () => new Set(initial.enabledCurrencies),
  );
  const [defaultCurrency, setDefault] = useState<SupportedCurrency>(initial.defaultCurrency);
  const [position, setPosition] = useState<CurrencyPosition>(initial.position);
  const [label, setLabel] = useState(initial.label);
  const [showOriginalQar, setShowOriginalQar] = useState(initial.showOriginalQar);
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(c: SupportedCurrency) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
    if (defaultCurrency !== 'QAR' && enabled.has(defaultCurrency) && !enabled.has(c) && c === defaultCurrency) {
      setDefault('QAR');
    }
  }

  function save() {
    setError(null);
    const enabledArr = Array.from(enabled).filter((c) => c !== 'QAR');
    const safeDefault =
      defaultCurrency !== 'QAR' && !enabledArr.includes(defaultCurrency)
        ? 'QAR'
        : defaultCurrency;
    start(async () => {
      const res = await saveCurrencyConverterAction({
        storefrontSlug,
        enabledCurrencies: enabledArr,
        defaultCurrency: safeDefault,
        position,
        label: label.trim(),
        showOriginalQar,
      });
      if (res.status === 'success') {
        setSavedAt(Date.now());
        setTimeout(() => setSavedAt((v) => (v && Date.now() - v >= 1500 ? null : v)), 1700);
      } else if (res.status === 'error') {
        setError(res.message);
      }
    });
  }

  const switcherChoices = (['QAR', ...Array.from(enabled).filter((c) => c !== 'QAR').sort()] as SupportedCurrency[]);

  return (
    <Surface padding={20}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--admin-accent)',
            }}
          >
            ◈ Customise
          </div>
          <h3
            style={{
              margin: '4px 0 0',
              fontFamily: 'var(--font-serif, var(--font-sans))',
              fontWeight: 400,
              fontSize: 17,
              color: 'var(--ink-strong)',
            }}
          >
            Currency switcher
          </h3>
        </div>
        {savedAt ? (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.06em',
              color: 'var(--admin-accent)',
              padding: '4px 10px',
              borderRadius: 999,
              background: 'color-mix(in srgb, var(--admin-accent) 15%, transparent)',
            }}
          >
            ✓ Saved
          </span>
        ) : null}
      </header>

      {/* Live preview */}
      <div
        style={{
          marginBottom: 18,
          padding: 16,
          borderRadius: 10,
          background: 'var(--surface-bg)',
          border: '1px solid var(--surface-rule)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--ink-muted)',
            }}
          >
            Preview
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: 'var(--font-serif, var(--font-sans))',
              fontSize: 15,
              color: 'var(--ink-strong)',
            }}
          >
            How visitors will see the switcher
          </div>
        </div>
        <PreviewChip
          label={label.trim()}
          defaultCurrency={defaultCurrency}
          choices={switcherChoices}
        />
      </div>

      <Section title="Currencies visitors can switch to">
        <p
          style={{
            margin: '0 0 10px',
            fontSize: 13,
            color: 'var(--ink-muted)',
            lineHeight: 1.55,
          }}
        >
          QAR is always the base. Pick the currencies you want to offer.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 8,
          }}
        >
          {SWITCHABLE.map((c) => {
            const on = enabled.has(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggle(c)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: on
                    ? 'color-mix(in srgb, var(--admin-accent) 12%, transparent)'
                    : 'transparent',
                  border: `1px solid ${on ? 'var(--admin-accent)' : 'var(--surface-rule-strong)'}`,
                  color: 'var(--ink-strong)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <span aria-hidden style={{ fontSize: 16 }}>{FLAGS[c]}</span>
                <span style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{NAMES[c]}</div>
                </span>
                <span
                  aria-hidden
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background: on ? 'var(--admin-accent)' : 'transparent',
                    border: `1px solid ${on ? 'var(--admin-accent)' : 'var(--surface-rule-strong)'}`,
                    color: 'var(--ink-on-gold)',
                    fontSize: 11,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {on ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Default currency for new visitors">
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {(['QAR', ...Array.from(enabled).filter((c) => c !== 'QAR')] as SupportedCurrency[]).map((c) => {
            const on = defaultCurrency === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setDefault(c)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 999,
                  background: on
                    ? 'var(--admin-accent)'
                    : 'transparent',
                  border: `1px solid ${on ? 'var(--admin-accent)' : 'var(--surface-rule-strong)'}`,
                  color: on ? 'var(--ink-on-gold)' : 'var(--ink-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                }}
              >
                {FLAGS[c]} {c}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Where the switcher sits on your storefront">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 8,
          }}
        >
          {(Object.keys(POSITION_LABELS) as CurrencyPosition[]).map((p) => {
            const on = position === p;
            const meta = POSITION_LABELS[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPosition(p)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: on
                    ? 'color-mix(in srgb, var(--admin-accent) 12%, transparent)'
                    : 'transparent',
                  border: `1px solid ${on ? 'var(--admin-accent)' : 'var(--surface-rule-strong)'}`,
                  color: 'var(--ink-strong)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <PositionPreview position={p} active={on} />
                <span style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{meta.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>
                    {meta.sub}
                  </div>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Custom label (optional)">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, 24))}
          placeholder="Currency"
          maxLength={24}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--surface-rule-strong)',
            background: 'var(--surface-bg)',
            color: 'var(--ink-strong)',
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            outline: 'none',
          }}
        />
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 11.5,
            color: 'var(--ink-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Shown beside the currency code on the chip. Leave blank to show the code only.
        </p>
      </Section>

      <Section title="Show the original QAR price">
        <button
          type="button"
          onClick={() => setShowOriginalQar((v) => !v)}
          aria-pressed={showOriginalQar}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '4px 4px 4px 4px',
            borderRadius: 999,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              position: 'relative',
              width: 40,
              height: 22,
              borderRadius: 999,
              background: showOriginalQar
                ? 'var(--admin-accent)'
                : 'color-mix(in srgb, var(--ink-strong) 18%, transparent)',
              transition: 'background 180ms',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: showOriginalQar ? 20 : 2,
                width: 18,
                height: 18,
                borderRadius: 999,
                background: '#fff',
                transition: 'left 180ms',
              }}
            />
          </span>
          <span style={{ fontSize: 13, color: 'var(--ink-strong)' }}>
            {showOriginalQar ? 'On — visitors see the QAR price under the converted one' : 'Off — only the converted price'}
          </span>
        </button>
      </Section>

      {error ? (
        <p
          role="alert"
          style={{
            margin: '12px 0 0',
            color: 'var(--color-maroon, #8b3a3a)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            background: 'color-mix(in srgb, var(--color-maroon, #8b3a3a) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-maroon, #8b3a3a) 35%, transparent)',
            padding: '8px 10px',
            borderRadius: 8,
          }}
        >
          {error}
        </p>
      ) : null}

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            background: pending
              ? 'color-mix(in srgb, var(--admin-accent) 35%, transparent)'
              : 'var(--admin-accent)',
            color: 'var(--ink-on-gold)',
            border: 'none',
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            fontWeight: 500,
            cursor: pending ? 'default' : 'pointer',
          }}
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </Surface>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h4
        style={{
          margin: '0 0 8px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
          fontWeight: 500,
        }}
      >
        {title}
      </h4>
      {children}
    </div>
  );
}

function PreviewChip({
  label,
  defaultCurrency,
  choices,
}: {
  label: string;
  defaultCurrency: SupportedCurrency;
  choices: SupportedCurrency[];
}) {
  const display = choices.includes(defaultCurrency) ? defaultCurrency : 'QAR';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderRadius: 999,
        background: '#f1e9d7',
        color: '#1f1b16',
        border: '1px solid rgba(31,27,22,0.18)',
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        fontWeight: 500,
        boxShadow: '0 4px 12px -8px rgba(0,0,0,0.25)',
      }}
    >
      <span aria-hidden>{FLAGS[display]}</span>
      <span>
        {label ? `${label} · ` : ''}
        {display}
      </span>
      <span aria-hidden style={{ opacity: 0.55 }}>▾</span>
    </div>
  );
}

function PositionPreview({ position, active }: { position: CurrencyPosition; active: boolean }) {
  const dot = active ? 'var(--admin-accent)' : 'color-mix(in srgb, var(--ink-strong) 30%, transparent)';
  return (
    <span
      aria-hidden
      style={{
        position: 'relative',
        width: 56,
        height: 36,
        borderRadius: 4,
        border: `1px solid ${active ? 'var(--admin-accent)' : 'var(--surface-rule-strong)'}`,
        background: 'var(--surface-bg)',
        flex: '0 0 56px',
      }}
    >
      <span
        style={{
          position: 'absolute',
          width: 12,
          height: 6,
          borderRadius: 999,
          background: dot,
          ...positionCoords(position),
        }}
      />
    </span>
  );
}

function positionCoords(p: CurrencyPosition): React.CSSProperties {
  switch (p) {
    case 'floating-tr':
      return { top: 4, right: 4 };
    case 'floating-bl':
      return { bottom: 4, left: 4 };
    case 'header':
      return { top: 4, left: '50%', transform: 'translateX(-50%)' };
    case 'footer':
      return { bottom: 4, left: '50%', transform: 'translateX(-50%)' };
  }
}
