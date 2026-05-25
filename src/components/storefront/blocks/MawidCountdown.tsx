'use client';

import { useEffect, useState } from 'react';
import type { MawidVariant, MawidSize } from '@/lib/apps/mawid';

/**
 * Owner-customizable countdown for the Mawid block.
 *
 * Variant + size + accent + which units to show all come from the
 * founder's Mawid settings. The clock is ticked client-side from the
 * server-supplied `targetIso` (UTC) so a visitor with a skewed local
 * clock still sees a count that lines up with the storefront's
 * server. We deliberately don't fetch `/api/apps/mawid/now` on
 * render — the server-rendered HTML is good enough for first paint
 * and the small drift across the request window is acceptable.
 */
export function MawidCountdown({
  targetIso,
  variant,
  size,
  accent,
  showDays,
  showHours,
  showMinutes,
  showSeconds,
  locale,
}: {
  targetIso: string;
  variant: MawidVariant;
  size: MawidSize;
  accent: string;
  showDays: boolean;
  showHours: boolean;
  showMinutes: boolean;
  showSeconds: boolean;
  locale: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const interval = showSeconds ? 1000 : 30_000;
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [showSeconds]);

  const target = Date.parse(targetIso);
  const remaining =
    now === null || Number.isNaN(target) ? Number.NaN : Math.max(0, target - now);
  const display = formatRemaining(remaining);
  const accentCss = accent.startsWith('--') ? `var(${accent})` : accent;
  const labels = locale === 'ar'
    ? { d: 'يوم', h: 'ساعة', m: 'دقيقة', s: 'ثانية' }
    : { d: 'days', h: 'hrs', m: 'mins', s: 'secs' };
  const cells: Array<{ value: string; label: string }> = [];
  if (showDays) cells.push({ value: display.days, label: labels.d });
  if (showHours) cells.push({ value: display.hours, label: labels.h });
  if (showMinutes) cells.push({ value: display.mins, label: labels.m });
  if (showSeconds) cells.push({ value: display.secs, label: labels.s });
  if (cells.length === 0) return null;

  const numFontSize = size === 'sm' ? 18 : size === 'lg' ? 36 : 26;
  const padding = size === 'sm' ? '10px 14px' : size === 'lg' ? '20px 24px' : '14px 18px';
  const cellMinW = size === 'sm' ? 36 : size === 'lg' ? 60 : 46;

  if (variant === 'inline') {
    return (
      <div
        aria-live="polite"
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 8,
          fontVariantNumeric: 'tabular-nums',
          color: accentCss,
          fontFamily: 'var(--font-serif, var(--font-sans))',
          fontSize: numFontSize,
        }}
      >
        {cells.map((c, i) => (
          <span key={c.label} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
            {c.value}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.08em',
                color: 'color-mix(in srgb, var(--sf-ink) 60%, transparent)',
                textTransform: 'uppercase',
              }}
            >
              {c.label}
            </span>
            {i < cells.length - 1 ? <span style={{ opacity: 0.5 }}>·</span> : null}
          </span>
        ))}
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div
        aria-live="polite"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          padding,
          background: accentCss,
          color: 'var(--sf-ground)',
          width: '100%',
          borderRadius: 12,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {cells.map((c) => (
          <Cell key={c.label} value={c.value} label={c.label} numFontSize={numFontSize} minWidth={cellMinW} onAccent />
        ))}
      </div>
    );
  }

  return (
    <div
      aria-live="polite"
      style={{
        display: 'inline-flex',
        gap: 12,
        padding,
        borderRadius: 14,
        background: 'color-mix(in srgb, ' + accentCss + ' 12%, transparent)',
        border: '1px solid color-mix(in srgb, ' + accentCss + ' 38%, transparent)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {cells.map((c) => (
        <Cell key={c.label} value={c.value} label={c.label} numFontSize={numFontSize} minWidth={cellMinW} />
      ))}
    </div>
  );
}

function Cell({
  value,
  label,
  numFontSize,
  minWidth,
  onAccent,
}: {
  value: string;
  label: string;
  numFontSize: number;
  minWidth: number;
  onAccent?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth }}>
      <span
        style={{
          fontFamily: 'var(--font-serif, var(--font-sans))',
          fontSize: numFontSize,
          lineHeight: 1,
          color: onAccent ? 'var(--sf-ground)' : 'var(--sf-ink)',
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: onAccent
            ? 'color-mix(in srgb, var(--sf-ground) 80%, transparent)'
            : 'color-mix(in srgb, var(--sf-ink) 60%, transparent)',
          marginTop: 6,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function formatRemaining(ms: number) {
  if (!Number.isFinite(ms)) {
    return { days: '--', hours: '--', mins: '--', secs: '--' };
  }
  const totalSecs = Math.floor(ms / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return {
    days: String(days).padStart(2, '0'),
    hours: String(hours).padStart(2, '0'),
    mins: String(mins).padStart(2, '0'),
    secs: String(secs).padStart(2, '0'),
  };
}
