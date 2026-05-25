'use client';

import { useEffect, useState } from 'react';

/**
 * Client-side ticking countdown to a drop's `startsAt`. Server renders
 * a static placeholder (avoids a hydration flicker) and the client
 * upgrades to the live timer on mount.
 */
export function DropCountdown({
  targetIso,
  locale,
}: {
  targetIso: string;
  locale: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const target = new Date(targetIso).getTime();
  const remaining = now === null ? Number.NaN : Math.max(0, target - now);
  const display = formatRemaining(remaining);
  const labels = locale === 'ar'
    ? { d: 'يوم', h: 'ساعة', m: 'دقيقة', s: 'ثانية' }
    : { d: 'days', h: 'hours', m: 'mins', s: 'secs' };

  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 14,
        padding: '16px 20px',
        borderRadius: 14,
        background: 'color-mix(in srgb, var(--sf-accent) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--sf-accent) 35%, transparent)',
        alignSelf: 'flex-start',
        fontVariantNumeric: 'tabular-nums',
      }}
      aria-live="polite"
    >
      <Cell value={display.days} label={labels.d} />
      <Cell value={display.hours} label={labels.h} />
      <Cell value={display.mins} label={labels.m} />
      <Cell value={display.secs} label={labels.s} />
    </div>
  );
}

function Cell({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44 }}>
      <span
        style={{
          fontFamily: 'var(--font-serif, var(--font-sans))',
          fontSize: 28,
          lineHeight: 1,
          color: 'var(--sf-ink)',
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'color-mix(in srgb, var(--sf-ink) 60%, transparent)',
          marginTop: 4,
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
