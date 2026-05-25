import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Sparkline } from '@/components/admin/charts/Sparkline';

/**
 * Tiny shared admin primitives: page header, stat tile, surface card,
 * empty state. All are server components — they render no client JS
 * and inherit the Souqna palette through CSS tokens. Nothing here is
 * meant to be a generic design system; it's the dashboard's own.
 *
 * Bilingual model: every visible string can be paired with an Arabic
 * counterpart via the `ar*` props. The admin renders both languages
 * stacked or inline (`<Bi>`), with the Arabic span tagged
 * `lang="ar" dir="rtl"` so screen readers and font-stack fallbacks
 * pick the right glyphs without us forcing a global RTL flip.
 */

/**
 * Render an English label and its Qatari Arabic counterpart together.
 * `direction="inline"` puts them on one line separated by a soft `·`,
 * good for short labels. `direction="stack"` puts AR underneath EN at
 * smaller weight, good for headings and body copy.
 */
export function Bi({
  en,
  ar,
  direction = 'inline',
  arSize,
  separator = '·',
  className,
  style,
}: {
  en: React.ReactNode;
  ar?: React.ReactNode;
  direction?: 'inline' | 'stack';
  arSize?: number | string;
  separator?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!ar) return <>{en}</>;
  if (direction === 'stack') {
    return (
      <span
        className={className}
        style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, ...style }}
      >
        <span>{en}</span>
        <span
          lang="ar"
          dir="rtl"
          style={{
            fontFamily: 'var(--font-arabic, var(--font-sans))',
            fontSize: arSize ?? '0.86em',
            fontWeight: 400,
            color: 'inherit',
            opacity: 0.85,
            letterSpacing: 0,
            textTransform: 'none',
          }}
        >
          {ar}
        </span>
      </span>
    );
  }
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', ...style }}
    >
      <span>{en}</span>
      <span aria-hidden style={{ opacity: 0.4 }}>
        {separator}
      </span>
      <span
        lang="ar"
        dir="rtl"
        style={{
          fontFamily: 'var(--font-arabic, var(--font-sans))',
          fontSize: arSize ?? '0.95em',
          letterSpacing: 0,
          textTransform: 'none',
        }}
      >
        {ar}
      </span>
    </span>
  );
}

export function PageHeader({
  eyebrow,
  arEyebrow,
  title,
  arTitle,
  subtitle,
  arSubtitle,
  primaryAction,
  secondaryActions,
}: {
  eyebrow?: string;
  arEyebrow?: string;
  title: string;
  arTitle?: string;
  subtitle?: string;
  arSubtitle?: string;
  primaryAction?: { label: string; arLabel?: string; href: string };
  secondaryActions?: Array<{ label: string; arLabel?: string; href: string }>;
}) {
  return (
    <header
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '24px 0 20px',
        borderBottom: '1px solid color-mix(in srgb, var(--ink-strong) 8%, transparent)',
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          {eyebrow ? (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--ink-muted)',
                marginBottom: 8,
              }}
            >
              <Bi en={eyebrow} ar={arEyebrow} />
            </div>
          ) : null}
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif, var(--font-sans))',
              fontWeight: 500,
              fontSize: 'clamp(22px, 2.6vw, 30px)',
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
              color: 'var(--ink-strong)',
            }}
          >
            <Bi en={title} ar={arTitle} direction="stack" arSize="0.7em" />
          </h1>
          {subtitle ? (
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 14,
                lineHeight: 1.55,
                color: 'var(--ink-muted)',
                maxWidth: 640,
              }}
            >
              <Bi en={subtitle} ar={arSubtitle} direction="stack" arSize="0.92em" />
            </p>
          ) : null}
        </div>
        <div style={{ display: 'inline-flex', gap: 8, flexShrink: 0 }}>
          {secondaryActions?.map((action) => (
            <a
              key={action.href}
              href={action.href}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 14px',
                borderRadius: 8,
                border: '1px solid var(--surface-rule-strong)',
                background: 'var(--surface-overlay)',
                color: 'var(--ink-strong)',
                fontSize: 13.5,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              <Bi en={action.label} ar={action.arLabel} />
            </a>
          ))}
          {primaryAction ? (
            <a
              href={primaryAction.href}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                borderRadius: 8,
                background: 'var(--ink-strong)',
                color: 'var(--surface-bg)',
                fontSize: 13.5,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              <Bi en={primaryAction.label} ar={primaryAction.arLabel} />
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function Surface({
  children,
  padding = 20,
  style,
}: {
  children: React.ReactNode;
  padding?: number;
  style?: React.CSSProperties;
}) {
  return (
    <Card
      className="gap-0 py-0 shadow-none"
      style={{
        background: 'var(--surface-elevated, var(--surface-bg))',
        borderColor: 'var(--surface-rule)',
        padding,
        ...style,
      }}
    >
      {children}
    </Card>
  );
}

export function Stat({
  label,
  arLabel,
  value,
  hint,
  arHint,
  delta,
  trend,
  trendLabel,
}: {
  label: string;
  arLabel?: string;
  value: string | number;
  hint?: string;
  arHint?: string;
  delta?: { value: number; positive?: boolean };
  /** Optional series for a trailing 30-day sparkline beneath the value. */
  trend?: number[];
  /** A11y label for the sparkline; falls back to a generic phrase. */
  trendLabel?: string;
}) {
  const isPositive = delta?.positive ?? (delta ? delta.value >= 0 : false);
  return (
    <Surface padding={18} style={{ border: '1px solid var(--surface-rule)' }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11.5,
          fontWeight: 500,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        <Bi en={label} ar={arLabel} direction="stack" arSize="0.95em" />
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: 'var(--font-serif, var(--font-sans))',
          fontSize: 26,
          fontWeight: 600,
          color: 'var(--ink-strong)',
          lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
          fontFeatureSettings: '"tnum"',
        }}
      >
        {value}
      </div>
      {delta ? (
        <div
          style={{
            marginTop: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: isPositive ? '#2f7d5b' : 'var(--color-maroon, #8b3a3a)',
          }}
          title={hint}
        >
          {isPositive ? '+' : ''}
          {delta.value}%
        </div>
      ) : hint ? (
        <div
          style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-muted)' }}
          title={typeof arHint === 'string' ? arHint : undefined}
        >
          {hint}
        </div>
      ) : null}
      {trend && trend.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <Sparkline data={trend} width={120} height={28} ariaLabel={trendLabel ?? hint ?? label} />
        </div>
      ) : null}
    </Surface>
  );
}

export function EmptyState({
  eyebrow,
  arEyebrow,
  title,
  arTitle,
  body,
  arBody,
  action,
}: {
  eyebrow?: string;
  arEyebrow?: string;
  title: string;
  arTitle?: string;
  body: string;
  arBody?: string;
  action?: { label: string; arLabel?: string; href: string };
}) {
  return (
    <Surface padding={48}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        {eyebrow ? (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--ink-muted)',
            }}
          >
            <Bi en={eyebrow} ar={arEyebrow} />
          </div>
        ) : null}
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-serif, var(--font-sans))',
            fontWeight: 400,
            fontSize: 22,
            color: 'var(--ink-strong)',
            letterSpacing: '-0.01em',
          }}
        >
          <Bi en={title} ar={arTitle} direction="stack" arSize="0.78em" />
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 14.5,
            lineHeight: 1.65,
            color: 'var(--ink-muted)',
            maxWidth: 520,
          }}
        >
          <Bi en={body} ar={arBody} direction="stack" arSize="0.92em" />
        </p>
        {action ? (
          <Link
            href={action.href}
            style={{
              marginTop: 8,
              display: 'inline-flex',
              alignItems: 'center',
              padding: '9px 16px',
              borderRadius: 8,
              background: 'var(--ink-strong)',
              color: 'var(--surface-bg)',
              fontSize: 13.5,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            <Bi en={action.label} ar={action.arLabel} />
          </Link>
        ) : null}
      </div>
    </Surface>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'critical' | 'info' | 'neutral';
  children: React.ReactNode;
}) {
  const map = {
    success: ['#2f7d5b', 'color-mix(in srgb, #2f7d5b 18%, transparent)'],
    warning: ['#a4761c', 'color-mix(in srgb, #a4761c 18%, transparent)'],
    critical: [
      'var(--color-maroon, #8b3a3a)',
      'color-mix(in srgb, var(--color-maroon, #8b3a3a) 18%, transparent)',
    ],
    info: ['#3a4a6a', 'color-mix(in srgb, #3a4a6a 18%, transparent)'],
    neutral: ['var(--ink-muted)', 'color-mix(in srgb, var(--ink-strong) 8%, transparent)'],
  } as const;
  const [color, bg] = map[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        borderRadius: 999,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.04em',
        textTransform: 'lowercase',
        whiteSpace: 'nowrap',
        color,
        background: bg,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: color,
        }}
      />
      {children}
    </span>
  );
}
