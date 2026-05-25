'use client';

import { APP_REGISTRY } from '@/lib/apps/registry';
import { AppMark } from '@/components/admin/apps/AppMark';

/**
 * Builder sidebar panel that lists every customizable installed app
 * for the active store. Tiles are click-only — they invoke `onOpen`
 * with the app id, which the BuilderShell uses to mount the
 * AppSettingsModal (an iframe of `/account/apps/[id]/configure?embed=1`).
 *
 * Apps without `customizable: true` (Giphy, Cloudflare, etc.) are
 * intentionally hidden here; they remain reachable from the marketplace
 * at /account/apps. The empty state nudges the user to install one.
 */
export function AppsPanel({
  installedAppIds,
  storeSlug,
  onOpen,
}: {
  installedAppIds: string[];
  storeSlug: string;
  onOpen: (appId: string) => void;
}) {
  const installed = new Set(installedAppIds);
  const apps = APP_REGISTRY.filter(
    (a) => installed.has(a.id) && a.customizable === true,
  );

  if (apps.length === 0) {
    return (
      <div
        style={{
          padding: '20px 4px',
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          lineHeight: 1.6,
          color: 'var(--bld-text-muted)',
        }}
      >
        <p style={{ margin: '0 0 10px' }}>
          No customizable apps are installed on this store yet.
        </p>
        <a
          href={`/account/apps?store=${encodeURIComponent(storeSlug)}`}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--bld-text-muted)',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          Browse marketplace →
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {apps.map((app) => (
        <button
          key={app.id}
          type="button"
          onClick={() => onOpen(app.id)}
          className="souqna-builder-app-tile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: '100%',
            padding: 10,
            background: 'var(--surface-elevated, transparent)',
            border: '1px solid color-mix(in srgb, var(--ink-strong) 10%, transparent)',
            borderRadius: 10,
            cursor: 'pointer',
            textAlign: 'start',
          }}
        >
          <AppMark app={app} size={36} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span
              style={{
                display: 'block',
                fontFamily: 'var(--font-serif, var(--font-sans))',
                fontSize: 14,
                fontWeight: 400,
                color: 'var(--bld-text, var(--ink-strong))',
                lineHeight: 1.2,
              }}
            >
              {app.name}
            </span>
            <span
              style={{
                display: 'block',
                marginTop: 2,
                fontSize: 11,
                color: 'var(--bld-text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {app.tagline}
            </span>
          </span>
        </button>
      ))}
      <style>{`
        .souqna-builder-app-tile:hover {
          background: color-mix(in srgb, var(--ink-strong) 5%, transparent);
        }
      `}</style>
    </div>
  );
}
