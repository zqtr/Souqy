import Link from 'next/link';
import { Surface, StatusBadge } from '@/components/admin/primitives';

export function GiphyPanel({
  storefrontSlug,
  installedAt,
}: {
  storefrontSlug: string;
  installedAt: string;
}) {
  return (
    <Surface padding={20}>
      <header style={{ marginBottom: 12 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--admin-accent)',
          }}
        >
          ◈ Giphy in the builder
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
          Pick a GIF, drop it in
        </h3>
      </header>
      <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--ink-strong)', lineHeight: 1.6 }}>
        Open the builder for this storefront. Every Image and Gallery block now has a{' '}
        <strong style={{ fontWeight: 500 }}>Pick a GIF</strong> button next to its image
        picker. Search the Giphy library, click a result, and the GIF auto-saves to the
        block — no copy-paste, no Giphy account login.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Link
          href={`/account/builder?store=${storefrontSlug}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '9px 16px',
            borderRadius: 8,
            background: 'var(--ink-strong)',
            color: 'var(--surface-bg)',
            fontSize: 13,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Open builder
        </Link>
        <StatusBadge tone="success">
          installed {new Date(installedAt).toLocaleDateString('en-GB')}
        </StatusBadge>
      </div>
    </Surface>
  );
}
