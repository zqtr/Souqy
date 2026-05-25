/**
 * Pure-SSR area + line sparkline. Takes a sparse list of `{day, n}`
 * data points, back-fills missing days with zero, and renders an SVG
 * that scales to its container width via `preserveAspectRatio`.
 *
 * Deliberately framework-free: no Recharts dependency, no client JS.
 * The chart re-renders on every Server Component render and is cached
 * with the rest of the analytics page.
 */
type Point = { day: string; n: number };

export function Sparkline({
  points,
  windowDays,
  label,
  locale,
  height = 80,
}: {
  points: Point[];
  windowDays: number;
  label?: string;
  locale?: string;
  height?: number;
}) {
  const series = backfillSeries(points, windowDays);
  const max = Math.max(...series.map((p) => p.n), 1);

  const width = 600;
  const padX = 12;
  const padY = 14;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const stepX = innerW / Math.max(series.length - 1, 1);

  const coords = series.map((p, i) => {
    const x = padX + i * stepX;
    const y = padY + innerH - (p.n / max) * innerH;
    return { x, y, n: p.n, day: p.day };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1]!.x.toFixed(1)},${(padY + innerH).toFixed(1)} L${coords[0]!.x.toFixed(1)},${(padY + innerH).toFixed(1)} Z`;

  const total = series.reduce((acc, p) => acc + p.n, 0);

  return (
    <figure style={{ margin: 0 }}>
      {label ? (
        <figcaption
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 8,
            gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--ink-muted)',
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--ink-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {locale === 'ar'
              ? `${total.toLocaleString('ar-QA')} الإجمالي · آخر ${windowDays.toLocaleString('ar-QA')} يوم`
              : `${total.toLocaleString()} total · last ${windowDays}d`}
          </span>
        </figcaption>
      ) : null}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{
          width: '100%',
          height,
          display: 'block',
        }}
        role="img"
        aria-label={
          label
            ? locale === 'ar'
              ? `${label} خلال آخر ${windowDays.toLocaleString('ar-QA')} يوم`
              : `${label} over the last ${windowDays} days`
            : locale === 'ar'
              ? 'رسم بياني مصغر'
              : 'sparkline'
        }
      >
        <defs>
          <linearGradient id="souqna-spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--admin-accent)"
              stopOpacity="0.32"
            />
            <stop
              offset="100%"
              stopColor="var(--admin-accent)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#souqna-spark-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--admin-accent)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </figure>
  );
}

function backfillSeries(points: Point[], windowDays: number): Point[] {
  const map = new Map<string, number>();
  for (const p of points) map.set(p.day, p.n);
  const out: Point[] = [];
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, n: map.get(key) ?? 0 });
  }
  return out;
}
