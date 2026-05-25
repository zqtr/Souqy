'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Listing } from '@/lib/apps/souqnasource/types';
import { ImportModal } from './import-modal';
import { QuoteModal } from './quote-modal';
import { SupplierDrawer } from './supplier-drawer';

export function ListingCard({
  listing,
  slug,
  locale,
}: {
  listing: Listing;
  slug: string;
  locale: 'en' | 'ar';
}) {
  const [openImport, setOpenImport] = useState(false);
  const [openQuote, setOpenQuote] = useState(false);
  const [openSupplier, setOpenSupplier] = useState(false);
  const t = useTranslations('apps.souqnasource.card');
  const isPriced = listing.listingType === 'priced';

  return (
    <article
      style={{
        display: 'flex',
        gap: 14,
        padding: 14,
        border: '1px solid var(--surface-rule)',
        borderRadius: 10,
        background: 'var(--surface-elevated, var(--surface-bg))',
        transition: 'border-color 120ms ease, transform 120ms ease',
      }}
    >
      {listing.imageUrl ? (
        <img
          src={listing.imageUrl}
          alt=""
          style={{
            width: 80,
            height: 80,
            objectFit: 'cover',
            borderRadius: 8,
            background: 'color-mix(in srgb, var(--ink-strong) 5%, transparent)',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 8,
            background: 'color-mix(in srgb, var(--ink-strong) 5%, transparent)',
            flexShrink: 0,
          }}
        />
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 14.5,
            fontWeight: 500,
            color: 'var(--ink-strong)',
            lineHeight: 1.35,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {listing.title}
        </h3>

        <div
          style={{
            fontSize: 13,
            color: 'var(--ink-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {isPriced ? (
            <span style={{ color: 'var(--ink-strong)', fontWeight: 500 }}>
              {listing.price} {listing.currency}
            </span>
          ) : (
            <span style={{ fontStyle: 'italic' }}>—</span>
          )}
          {listing.moq ? (
            <>
              <span aria-hidden>·</span>
              <span>
                {t('moq')} {listing.moq}
              </span>
            </>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setOpenSupplier(true)}
          style={{
            alignSelf: 'flex-start',
            padding: 0,
            background: 'transparent',
            border: 'none',
            color: 'var(--ink-muted)',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            cursor: 'pointer',
          }}
        >
          {t('trust')}: —
        </button>

        <div style={{ marginTop: 8 }}>
          {isPriced ? (
            <button
              type="button"
              onClick={() => setOpenImport(true)}
              style={primaryBtn}
            >
              {t('addToStore')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setOpenQuote(true)}
              style={secondaryBtn}
            >
              {t('getQuote')}
            </button>
          )}
        </div>
      </div>

      {openImport && (
        <ImportModal
          listing={listing}
          slug={slug}
          locale={locale}
          onClose={() => setOpenImport(false)}
        />
      )}
      {openQuote && (
        <QuoteModal
          listing={listing}
          slug={slug}
          locale={locale}
          onClose={() => setOpenQuote(false)}
        />
      )}
      {openSupplier && (
        <SupplierDrawer
          supplierId={listing.supplierId}
          slug={slug}
          locale={locale}
          onClose={() => setOpenSupplier(false)}
        />
      )}
    </article>
  );
}

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '7px 14px',
  borderRadius: 8,
  background: 'var(--ink-strong)',
  color: 'var(--surface-bg)',
  fontSize: 13,
  fontWeight: 500,
  border: 'none',
  cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '7px 14px',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--ink-strong)',
  fontSize: 13,
  fontWeight: 500,
  border: '1px solid var(--surface-rule)',
  cursor: 'pointer',
};
