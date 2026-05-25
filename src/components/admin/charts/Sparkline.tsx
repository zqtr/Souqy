/**
 * Lightweight inline SVG sparkline. Hand-rolled so the dashboard home
 * page can show 30-day trends without pulling in a chart library.
 *
 * Renders a 1.5 px polyline with a faint area fill underneath. Empty
 * data and all-zero data both render a flat baseline (no crash, no
 * misleading curve). Padding leaves a few px on every edge so the line
 * never clips against the container border.
 */
type Props = {
  data: number[];
  width?: number;
  height?: number;
  accent?: string;
  ariaLabel?: string;
};

export function Sparkline({
  data,
  width = 120,
  height = 32,
  accent = 'var(--admin-accent)',
  ariaLabel,
}: Props) {
  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const len = data.length;
  const baselineY = pad + innerH;
  const safeData = len > 0 ? data : [0];
  const max = Math.max(...safeData);
  const min = Math.min(...safeData);
  const range = max - min || 1;

  const points = safeData.map((v, i) => {
    const x = pad + (len <= 1 ? innerW / 2 : (i / (len - 1)) * innerW);
    const y = pad + innerH - ((v - min) / range) * innerH;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const linePath = points.join(' ');
  const areaPath =
    safeData.length > 0
      ? `M ${points[0]} L ${points.join(' L ')} L ${(pad + innerW).toFixed(2)},${baselineY.toFixed(2)} L ${pad.toFixed(2)},${baselineY.toFixed(2)} Z`
      : '';

  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? 'Trend over time'}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {areaPath ? (
        <path d={areaPath} fill={accent} fillOpacity={0.08} stroke="none" />
      ) : null}
      <polyline
        points={linePath}
        fill="none"
        stroke={accent}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
