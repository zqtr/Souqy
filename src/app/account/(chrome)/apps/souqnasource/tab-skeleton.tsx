export function TabSkeleton({ variant }: { variant: string }) {
  if (variant === 'browse') {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 220px minmax(0, 1fr)',
          gap: 20,
        }}
      >
        <div>
          <Bar width={80} height={11} />
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Bar key={i} width="100%" height={28} radius={6} />
            ))}
          </div>
        </div>
        <div>
          <Bar width={64} height={11} />
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Bar width="100%" height={28} radius={6} />
            <Bar width="60%" height={32} radius={6} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Row key={i} />
          ))}
        </div>
        <ShimmerKeyframes />
      </div>
    );
  }
  if (variant === 'settings') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 480 }}>
        <Bar width={120} height={11} />
        <Bar width="100%" height={28} radius={6} />
        <Bar width={160} height={14} />
        <Bar width={160} height={14} />
        <Bar width={80} height={36} radius={8} />
        <ShimmerKeyframes />
      </div>
    );
  }
  // imports / quotes — table shape
  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 12,
          padding: '10px 12px',
          borderBottom: '1px solid var(--surface-rule)',
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Bar key={i} width={64} height={11} />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: 12,
            padding: 12,
            borderBottom: '1px solid color-mix(in srgb, var(--ink-strong) 5%, transparent)',
          }}
        >
          {Array.from({ length: 5 }).map((_, j) => (
            <Bar key={j} width="80%" height={12} />
          ))}
        </div>
      ))}
      <ShimmerKeyframes />
    </div>
  );
}

function Bar({
  width,
  height,
  radius = 4,
}: {
  width: number | string;
  height: number;
  radius?: number;
}) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width,
        height,
        borderRadius: radius,
        background:
          'linear-gradient(90deg, color-mix(in srgb, var(--ink-strong) 6%, transparent) 0%, color-mix(in srgb, var(--ink-strong) 12%, transparent) 50%, color-mix(in srgb, var(--ink-strong) 6%, transparent) 100%)',
        backgroundSize: '200% 100%',
        animation: 'souqnasource-shimmer 1.4s ease-in-out infinite',
      }}
    />
  );
}

function Row() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        padding: 14,
        border: '1px solid var(--surface-rule)',
        borderRadius: 10,
      }}
    >
      <Bar width={80} height={80} radius={8} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Bar width="60%" height={14} />
        <Bar width="35%" height={12} />
        <Bar width={120} height={28} radius={8} />
      </div>
    </div>
  );
}

function ShimmerKeyframes() {
  return (
    <style>{`
      @keyframes souqnasource-shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  );
}
