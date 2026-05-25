'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { GiphyPicker } from './GiphyPicker';
import { StorageImagePicker } from './StorageImagePicker';
import { useBuilderCopy } from './BuilderCopyContext';

type Props = {
  value: string;
  onChange: (url: string) => void;
  /** Context used for Storage uploads under builder/<store>/<context>. */
  namespace: string;
  /** Active storefront slug; required so builder uploads are reusable Storage assets. */
  storefrontSlug: string;
  /** Optional accept hint kept for API compatibility. */
  accept?: string;
  /** When set, shows a "Pick a GIF" button that opens the Giphy picker
   *  scoped to this storefront. The Giphy app must be installed (the
   *  /api/apps/giphy/search proxy enforces it). */
  giphyStorefrontSlug?: string;
};

/**
 * Builder image picker. It no longer uploads directly into a block.
 * Founders choose from the store-scoped Storage library, and the modal
 * can upload into Storage before selecting the new asset.
 */
export function MediaUploader({
  value,
  onChange,
  namespace,
  storefrontSlug,
  giphyStorefrontSlug,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [giphyOpen, setGiphyOpen] = useState(false);
  const { builder: copy, locale } = useBuilderCopy();
  const ar = locale === 'ar';
  const fallback = {
    change: ar ? 'تغيير' : 'Change',
    choose: ar ? 'اختر من التخزين' : 'Choose from Storage',
    hint: ar ? 'ارفع في التخزين ثم استخدم الصورة في أي مكان' : 'Upload in Storage, then reuse anywhere',
  };
  const mediaCopy = copy.media as typeof copy.media & {
    replaceFromStorage?: string;
    chooseFromStorage?: string;
    storageHint?: string;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        style={{
          position: 'relative',
          border: '1px solid var(--bld-input-border)',
          borderRadius: 12,
          padding: value ? 8 : 12,
          background: 'var(--bld-input-bg)',
          cursor: 'pointer',
          minHeight: value ? undefined : 104,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          overflow: 'hidden',
          color: 'var(--bld-text)',
          transition: 'border-color 120ms ease, background 120ms ease',
        }}
      >
        {value ? (
          <>
            <img
              src={value}
              alt=""
              style={{
                width: '100%',
                maxHeight: 154,
                borderRadius: 8,
                objectFit: 'contain',
                background:
                  'repeating-conic-gradient(rgba(255,255,255,0.08) 0% 25%, transparent 0% 50%) 50% / 14px 14px',
              }}
            />
            <span style={floatingBadgeStyle()}>{mediaCopy.replaceFromStorage ?? fallback.change}</span>
          </>
        ) : (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.08em',
              color: 'var(--bld-text-muted)',
              textAlign: 'center',
              lineHeight: 1.5,
              textTransform: 'uppercase',
            }}
          >
            {mediaCopy.chooseFromStorage ?? fallback.choose}
            <br />
            <span style={{ fontSize: 9, color: 'var(--bld-text-faint)' }}>
              {mediaCopy.storageHint ?? fallback.hint}
            </span>
          </div>
        )}
      </button>
      {value ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--bld-text-faint)',
              textDecoration: 'none',
              maxWidth: 220,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            ↗ {value.replace(/^https?:\/\//, '')}
          </a>
          <button
            type="button"
            onClick={() => onChange('')}
            style={{
              background: 'transparent',
              color: '#E68A8A',
              border: '1px solid #E68A8A55',
              borderRadius: 3,
              padding: '4px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {copy.media.remove}
          </button>
        </div>
      ) : null}
      {giphyStorefrontSlug ? (
        <button
          type="button"
          onClick={() => setGiphyOpen(true)}
          style={{
            alignSelf: 'flex-start',
            background: 'transparent',
            color: 'var(--bld-text-muted)',
            border: '1px dashed var(--bld-input-border)',
            borderRadius: 4,
            padding: '5px 10px',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {copy.media.pickGif}
        </button>
      ) : null}
      <StorageImagePicker
        open={pickerOpen}
        storefrontSlug={storefrontSlug}
        context={namespace}
        currentUrl={value}
        locale={locale}
        onClose={() => setPickerOpen(false)}
        onPick={onChange}
      />
      {giphyStorefrontSlug ? (
        <GiphyPicker
          storefrontSlug={giphyStorefrontSlug}
          open={giphyOpen}
          onClose={() => setGiphyOpen(false)}
          onPick={(url) => onChange(url)}
        />
      ) : null}
    </div>
  );
}

function floatingBadgeStyle(): CSSProperties {
  return {
    position: 'absolute',
    right: 12,
    bottom: 12,
    borderRadius: 999,
    padding: '6px 10px',
    background: 'color-mix(in srgb, var(--bld-surface) 82%, black)',
    border: '1px solid var(--bld-input-border)',
    color: 'var(--bld-text)',
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    boxShadow: '0 10px 26px rgba(0,0,0,0.28)',
  };
}
