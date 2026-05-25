'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { DeleteStorefrontButton } from '@/components/dashboard/DeleteStorefrontButton';
import { unpublishStorefrontAction, publishStorefront } from '@/app/actions/builder';

type Row = {
  slug: string;
  businessName: string;
  isPublished: boolean;
  templateId: string;
  locale: 'en' | 'ar';
  createdAt: string;
};

type Props = {
  storefronts: Row[];
  rootDomain: string;
};

/**
 * Websites manager — a flat list of every storefront on the account.
 * Each row carries the live URL, a status pill, and two destructive
 * affordances:
 *
 *   - Unpublish / Republish (reversible) — flips `is_published`. The
 *     public renderer 404s when false, so an unpublished store is
 *     hidden from buyers but the published block tree is kept intact
 *     for republishing.
 *   - Delete (irreversible) — uses the existing `<DeleteStorefrontButton>`
 *     so the slug-confirm UX matches the dashboard delete CTA.
 *
 * After any mutation we `router.refresh()` so the list re-renders
 * from the server with the new state. The Next.js Router Cache keys
 * by pathname, so without an explicit refresh the row's pill would
 * still read "live" until the next hard navigation.
 */
export function WebsitesManager({ storefronts, rootDomain }: Props) {
  if (storefronts.length === 0) {
    return (
      <div
        style={{
          padding: '40px 24px',
          border: '1px solid var(--surface-rule-strong)',
          borderRadius: 12,
          textAlign: 'center',
          color: 'var(--ink-muted)',
          fontSize: 14,
        }}
      >
        You don&apos;t have any storefronts yet.{' '}
        <Link href="/begin" style={{ color: 'var(--admin-accent)' }}>
          Create your first one
        </Link>
        .
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {storefronts.map((s) => (
        <WebsiteRow key={s.slug} row={s} rootDomain={rootDomain} />
      ))}
    </div>
  );
}

function WebsiteRow({ row, rootDomain }: { row: Row; rootDomain: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const liveHref = `https://${row.slug}.${rootDomain}`;
  const live = row.isPublished;

  function togglePublish() {
    setError(null);
    startTransition(async () => {
      const action = live
        ? unpublishStorefrontAction({ slug: row.slug })
        : publishStorefront({ slug: row.slug });
      const result = await action;
      if (result.status === 'error') {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 16,
        padding: '16px 18px',
        border: '1px solid var(--surface-rule-strong)',
        borderRadius: 12,
        background: 'var(--surface-elevated, var(--surface-bg))',
      }}
    >
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--ink-strong)',
            }}
          >
            {row.businessName}
          </span>
          <StatusPill live={live} />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--ink-muted)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {row.templateId} · {row.locale.toUpperCase()}
          </span>
        </div>
        <a
          href={liveHref}
          target="_blank"
          rel="noreferrer"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--ink-muted)',
            textDecoration: 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.slug}.{rootDomain} ↗
        </a>
        {error ? (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: '#c45656',
              marginTop: 4,
            }}
          >
            {error}
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Link
          href={`/account/builder?store=${row.slug}`}
          style={{
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '6px 10px',
            borderRadius: 999,
            border: '1px solid var(--surface-rule-strong)',
            background: 'transparent',
            color: 'var(--ink-strong)',
            textDecoration: 'none',
            lineHeight: 1,
          }}
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={togglePublish}
          disabled={pending}
          style={{
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '6px 10px',
            borderRadius: 999,
            border: '1px solid color-mix(in srgb, var(--admin-accent) 35%, transparent)',
            background: 'transparent',
            color: 'var(--admin-accent)',
            cursor: pending ? 'default' : 'pointer',
            lineHeight: 1,
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? '…' : live ? 'Unpublish' : 'Republish'}
        </button>
        <DeleteStorefrontButton
          slug={row.slug}
          businessName={row.businessName}
          briefRootDomain={rootDomain}
        />
      </div>
    </div>
  );
}

function StatusPill({ live }: { live: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 999,
        border: '1px solid color-mix(in srgb, currentColor 35%, transparent)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: live ? '#3f8a5c' : 'var(--ink-muted)',
        background: live
          ? 'color-mix(in srgb, #3f8a5c 8%, transparent)'
          : 'transparent',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: live ? '#3f8a5c' : 'var(--ink-muted)',
        }}
      />
      {live ? 'Live' : 'Paused'}
    </span>
  );
}
