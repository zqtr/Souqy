'use client';

import type { CSSProperties, ReactNode } from 'react';

/**
 * Destination-aware loading skeleton.
 *
 * Pattern-matches on the target pathname and returns a wireframe of
 * roughly the layout the user is navigating to. Built from a single
 * `<Bone />` primitive (shimmering rounded rectangle, theme-aware) so
 * adding a new variant is mostly a layout exercise.
 *
 * Lives in `src/components/system/` because it's app-shell furniture
 * shared across every route group, not feature-specific.
 */

type Variant =
  | 'builder'
  | 'admin'
  | 'intake'
  | 'storefront'
  | 'auth'
  | 'marketing'
  | 'fallback';

export function RouteSkeleton({ pathname }: { pathname: string }) {
  const variant = pickVariant(pathname);
  switch (variant) {
    case 'builder':
      return <BuilderSkeleton />;
    case 'admin':
      return <AdminSkeleton />;
    case 'intake':
      return <IntakeSkeleton />;
    case 'storefront':
      return <StorefrontSkeleton />;
    case 'auth':
      return <AuthSkeleton />;
    case 'marketing':
      return <MarketingSkeleton />;
    case 'fallback':
    default:
      return <FallbackSkeleton />;
  }
}

function pickVariant(pathname: string): Variant {
  if (!pathname) return 'fallback';
  // Strip a leading locale segment so `/ar/begin` matches the same as `/begin`.
  const stripped = pathname.replace(/^\/(en|ar)(?=\/|$)/, '') || '/';

  if (stripped.startsWith('/account/builder')) return 'builder';
  if (stripped === '/account' || stripped.startsWith('/account/')) return 'admin';
  if (stripped.startsWith('/begin')) return 'intake';
  if (stripped.startsWith('/brief/')) return 'storefront';
  if (stripped.startsWith('/sign-in') || stripped.startsWith('/sign-up')) {
    return 'auth';
  }
  if (stripped === '/') return 'marketing';
  // Any other apex path under /[locale]/* (atelier, journal, brand…)
  return 'marketing';
}

/* ─────────────────────── primitives ─────────────────────── */

/**
 * Skeleton bone. Theme-aware (uses --surface-rule for the base, and a
 * shimmer driven by --surface-elevated). Honors prefers-reduced-motion
 * by dropping the shimmer to a static fill — the wireframe still
 * communicates layout, just without movement.
 */
function Bone({
  width = '100%',
  height = 14,
  radius = 8,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: CSSProperties;
}) {
  return (
    <span
      className="souqna-skel-bone"
      style={{
        display: 'block',
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

function Stack({
  children,
  gap = 12,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
      {children}
    </div>
  );
}

function Row({
  children,
  gap = 12,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap, ...style }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────── variants ─────────────────────── */

function AdminSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        minHeight: '100dvh',
        width: '100%',
        background: 'var(--surface-bg)',
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          padding: '20px 16px',
          borderInlineEnd: '1px solid var(--surface-rule)',
          background: 'var(--surface-elevated)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <Row gap={10}>
          <Bone width={28} height={28} radius={8} />
          <Bone width={110} height={14} />
        </Row>
        <Stack gap={8} style={{ marginTop: 8 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <Row key={i} gap={10}>
              <Bone width={18} height={18} radius={6} />
              <Bone
                width={`${60 + ((i * 13) % 35)}%`}
                height={12}
              />
            </Row>
          ))}
        </Stack>
        <Stack gap={8} style={{ marginTop: 'auto' }}>
          <Bone width="55%" height={10} />
          <Bone width={36} height={36} radius={999} />
        </Stack>
      </aside>

      {/* Right column */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 24px',
            borderBlockEnd: '1px solid var(--surface-rule)',
            background: 'var(--surface-bg)',
          }}
        >
          <Row gap={12}>
            <Bone width={140} height={14} />
            <Bone width={64} height={22} radius={999} />
          </Row>
          <Row gap={10}>
            <Bone width={24} height={24} radius={999} />
            <Bone width={24} height={24} radius={999} />
            <Bone width={32} height={32} radius={999} />
          </Row>
        </header>

        {/* Content */}
        <main
          style={{
            flex: 1,
            padding: 'clamp(20px, 3vw, 36px) clamp(20px, 4vw, 48px) 80px',
            maxWidth: 1320,
            width: '100%',
            margin: '0 auto',
          }}
        >
          <Stack gap={10} style={{ marginBlockEnd: 28 }}>
            <Bone width={180} height={12} />
            <Bone width="55%" height={28} radius={10} />
            <Bone width="35%" height={14} />
          </Stack>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 18,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

function Card() {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 14,
        border: '1px solid var(--surface-rule)',
        background: 'var(--surface-elevated)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <Row gap={10}>
        <Bone width={32} height={32} radius={8} />
        <Stack gap={6} style={{ flex: 1 }}>
          <Bone width="70%" height={12} />
          <Bone width="40%" height={10} />
        </Stack>
      </Row>
      <Bone width="100%" height={120} radius={10} />
      <Stack gap={6}>
        <Bone width="90%" height={10} />
        <Bone width="60%" height={10} />
      </Stack>
    </div>
  );
}

function BuilderSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        width: '100%',
        background: 'var(--surface-bg)',
      }}
    >
      {/* Top publish bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBlockEnd: '1px solid var(--surface-rule)',
          background: 'var(--surface-elevated)',
        }}
      >
        <Row gap={12}>
          <Bone width={28} height={28} radius={8} />
          <Bone width={120} height={14} />
          <Bone width={70} height={20} radius={999} />
        </Row>
        <Row gap={10}>
          <Bone width={80} height={28} radius={999} />
          <Bone width={100} height={28} radius={999} />
        </Row>
      </header>

      {/* 3-pane editor */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Library rail */}
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            borderInlineEnd: '1px solid var(--surface-rule)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: 'var(--surface-elevated)',
          }}
        >
          <Bone width="60%" height={12} />
          {Array.from({ length: 8 }).map((_, i) => (
            <Row key={i} gap={10}>
              <Bone width={28} height={28} radius={6} />
              <Bone width={`${50 + ((i * 11) % 40)}%`} height={12} />
            </Row>
          ))}
        </aside>

        {/* Canvas */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: 'clamp(24px, 4vw, 56px)',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 880,
              display: 'flex',
              flexDirection: 'column',
              gap: 22,
            }}
          >
            <Bone width="50%" height={32} radius={10} />
            <Bone width="80%" height={14} />
            <Bone width="100%" height={220} radius={14} />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 14,
              }}
            >
              <Bone height={120} radius={12} />
              <Bone height={120} radius={12} />
              <Bone height={120} radius={12} />
            </div>
            <Stack gap={8}>
              <Bone width="95%" height={12} />
              <Bone width="85%" height={12} />
              <Bone width="60%" height={12} />
            </Stack>
          </div>
        </main>

        {/* Inspector */}
        <aside
          style={{
            width: 280,
            flexShrink: 0,
            borderInlineStart: '1px solid var(--surface-rule)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            background: 'var(--surface-elevated)',
          }}
        >
          <Bone width="55%" height={12} />
          {Array.from({ length: 5 }).map((_, i) => (
            <Stack key={i} gap={6}>
              <Bone width="45%" height={10} />
              <Bone width="100%" height={32} radius={8} />
            </Stack>
          ))}
        </aside>
      </div>
    </div>
  );
}

function IntakeSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        minHeight: '100dvh',
        width: '100%',
        background: 'var(--surface-bg)',
        padding: 'clamp(40px, 8vw, 96px) 20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          padding: 28,
          borderRadius: 18,
          background: 'var(--surface-elevated)',
          border: '1px solid var(--surface-rule)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <Stack gap={10}>
          <Bone width={120} height={10} />
          <Bone width="70%" height={26} radius={10} />
          <Bone width="90%" height={12} />
        </Stack>
        {Array.from({ length: 4 }).map((_, i) => (
          <Stack key={i} gap={6}>
            <Bone width="35%" height={10} />
            <Bone width="100%" height={40} radius={10} />
          </Stack>
        ))}
        <Row gap={10} style={{ justifyContent: 'flex-end', marginTop: 6 }}>
          <Bone width={80} height={36} radius={999} />
          <Bone width={120} height={36} radius={999} />
        </Row>
      </div>
    </div>
  );
}

function StorefrontSkeleton() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        width: '100%',
        background: 'var(--surface-bg)',
      }}
    >
      <main
        style={{
          maxWidth: 'min(1280px, 92vw)',
          marginInline: 'auto',
          paddingBlock: 'clamp(24px, 4vw, 56px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(36px, 5vw, 64px)',
        }}
      >
        {/* Hero */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
            gap: 32,
            alignItems: 'center',
          }}
        >
          <Stack gap={14}>
            <Bone width={120} height={10} />
            <Bone width="90%" height={48} radius={12} />
            <Bone width="70%" height={48} radius={12} />
            <Bone width="80%" height={14} />
            <Bone width="50%" height={14} />
            <Row gap={10} style={{ marginTop: 8 }}>
              <Bone width={140} height={40} radius={999} />
              <Bone width={120} height={40} radius={999} />
            </Row>
          </Stack>
          <Bone height={360} radius={18} />
        </section>

        {/* Section heading */}
        <Stack gap={10}>
          <Bone width={140} height={10} />
          <Bone width="40%" height={24} radius={10} />
        </Stack>

        {/* Product grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 22,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Stack key={i} gap={10}>
              <Bone height={240} radius={14} />
              <Bone width="80%" height={12} />
              <Bone width="40%" height={10} />
            </Stack>
          ))}
        </div>
      </main>
    </div>
  );
}

function AuthSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        width: '100%',
        background: 'var(--surface-bg)',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          padding: 32,
          borderRadius: 14,
          background: 'var(--surface-elevated)',
          border: '1px solid var(--surface-rule)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <Stack gap={8} style={{ alignItems: 'center' }}>
          <Bone width={48} height={48} radius={12} />
          <Bone width="60%" height={16} radius={8} />
          <Bone width="80%" height={12} />
        </Stack>
        <Bone width="100%" height={40} radius={8} />
        <Row gap={10} style={{ justifyContent: 'center' }}>
          <Bone width="40%" height={1} />
          <Bone width={32} height={10} />
          <Bone width="40%" height={1} />
        </Row>
        <Stack gap={10}>
          <Stack gap={6}>
            <Bone width="30%" height={10} />
            <Bone width="100%" height={36} radius={6} />
          </Stack>
          <Stack gap={6}>
            <Bone width="30%" height={10} />
            <Bone width="100%" height={36} radius={6} />
          </Stack>
        </Stack>
        <Bone width="100%" height={40} radius={8} />
      </div>
    </div>
  );
}

function MarketingSkeleton() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        width: '100%',
        background: 'var(--surface-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top nav */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px clamp(20px, 5vw, 56px)',
          borderBlockEnd: '1px solid var(--surface-rule)',
        }}
      >
        <Row gap={12}>
          <Bone width={36} height={36} radius={10} />
          <Bone width={110} height={14} />
        </Row>
        <Row gap={20}>
          <Bone width={70} height={12} />
          <Bone width={70} height={12} />
          <Bone width={70} height={12} />
          <Bone width={110} height={36} radius={999} />
        </Row>
      </header>

      {/* Hero */}
      <section
        style={{
          padding: 'clamp(48px, 8vw, 112px) clamp(20px, 5vw, 56px)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
          gap: 48,
          alignItems: 'center',
          maxWidth: 1280,
          marginInline: 'auto',
          width: '100%',
        }}
      >
        <Stack gap={16}>
          <Bone width={140} height={10} />
          <Bone width="95%" height={56} radius={14} />
          <Bone width="80%" height={56} radius={14} />
          <Bone width="80%" height={14} style={{ marginTop: 8 }} />
          <Bone width="60%" height={14} />
          <Row gap={12} style={{ marginTop: 12 }}>
            <Bone width={140} height={44} radius={999} />
            <Bone width={120} height={44} radius={999} />
          </Row>
        </Stack>
        <Bone height={420} radius={20} />
      </section>

      {/* Section bands */}
      {Array.from({ length: 2 }).map((_, i) => (
        <section
          key={i}
          style={{
            padding: 'clamp(48px, 6vw, 96px) clamp(20px, 5vw, 56px)',
            borderBlockStart: '1px solid var(--surface-rule)',
            maxWidth: 1280,
            marginInline: 'auto',
            width: '100%',
          }}
        >
          <Stack gap={12}>
            <Bone width={120} height={10} />
            <Bone width="50%" height={28} radius={10} />
            <Bone width="80%" height={14} />
          </Stack>
          <div
            style={{
              marginTop: 32,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 20,
            }}
          >
            {Array.from({ length: 3 }).map((_, j) => (
              <Stack key={j} gap={10}>
                <Bone height={160} radius={14} />
                <Bone width="70%" height={12} />
                <Bone width="40%" height={10} />
              </Stack>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FallbackSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        minHeight: '100dvh',
        width: '100%',
        background: 'var(--surface-bg)',
      }}
    >
      <div
        className="souqna-skel-spinner"
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '3px solid var(--surface-rule)',
          borderTopColor: 'var(--ink-strong)',
        }}
      />
      <Bone width={120} height={10} />
    </div>
  );
}
