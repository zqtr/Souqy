import type { AppDescriptor } from '@/lib/apps/types';

/**
 * Brand mark for marketplace tiles + detail headers.
 *
 * If the descriptor declares a `markSrc`, render the SVG file from
 * /public/apps/<id>/. Otherwise compose a unified, marketplace-grade
 * letter mark from the descriptor's `glyph` + `accentVar` so every
 * app in the catalogue looks intentional even before custom art is
 * shipped.
 */
export function AppMark({
  app,
  size = 56,
  radius,
}: {
  app: AppDescriptor;
  size?: number;
  radius?: number;
}) {
  const r = radius ?? Math.round(size * 0.22);
  if (app.markSrc) {
    return (
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          flex: `0 0 ${size}px`,
          borderRadius: r,
          overflow: 'hidden',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          boxShadow:
            '0 1px 0 rgba(0,0,0,0.04), 0 8px 20px -14px rgba(31,27,22,0.35)',
        }}
      >
        <img
          src={app.markSrc}
          alt=""
          width={size}
          height={size}
          style={{ width: size, height: size, display: 'block' }}
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: r,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, color-mix(in srgb, var(${app.accentVar}) 30%, var(--surface-elevated)) 0%, color-mix(in srgb, var(${app.accentVar}) 14%, var(--surface-bg)) 100%)`,
        color: `var(${app.accentVar})`,
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        fontSize: Math.round(size * 0.32),
        letterSpacing: '0.02em',
        border: `1px solid color-mix(in srgb, var(${app.accentVar}) 25%, transparent)`,
      }}
    >
      {app.glyph}
    </span>
  );
}
