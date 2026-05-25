'use client';

import { useCallback, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';

type Props = {
  value: string;
  onChange: (url: string) => void;
  /** Sub-folder under which the upload is namespaced. */
  namespace: string;
  /** Optional accept hint; defaults to images. */
  accept?: string;
  /** Optional helper text shown under the dropzone. */
  helper?: string;
  /** Optional aria label for the dropzone button. */
  ariaLabel?: string;
  /** Max file size in bytes. Defaults to 50 MB; favicon callers pass 1 MB. */
  maxSize?: number;
};

/**
 * Theme-aware admin upload widget.
 *
 * Light + dark parity using the `--surface-*` and `--ink-*` tokens.
 * Streams to `/api/upload-blob` via the same single-shot Vercel Blob
 * client token as the builder's MediaUploader, so all the upload
 * gating (mime types, 50MB cap, namespace prefix sanitisation) is
 * shared.
 *
 * Used everywhere the founder picks an asset from inside the admin
 * chrome — Brand → Logo, Apps → custom icons, Settings → email header
 * graphic, etc. The builder still uses MediaUploader (different visual
 * vocabulary).
 */
export function AdminUploadField({
  value,
  onChange,
  namespace,
  accept = 'image/png,image/jpeg,image/jpg,image/webp,image/svg+xml',
  helper,
  ariaLabel = 'Upload an image',
  maxSize = 52_428_800,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOver, setIsOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > maxSize) {
        const mb = Math.round(maxSize / 1_048_576);
        setError(`File too large. Maximum ${mb} MB.`);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const safe = sanitizeUploadName(file.name);
        const result = await upload(`${namespace}/${safe}`, file, {
          access: 'public',
          handleUploadUrl: '/api/upload-blob',
          clientPayload: JSON.stringify({
            storefrontSlug: storefrontSlugFromNamespace(namespace),
            size: file.size,
            contentType: file.type || null,
          }),
        });
        onChange(result.url);
      } catch (err) {
        console.error('[AdminUploadField] upload failed', err);
        setError('Upload failed. Try a different image — PNG, JPG, WEBP or SVG.');
      } finally {
        setBusy(false);
      }
    },
    [namespace, onChange, maxSize],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: 14,
          borderRadius: 10,
          border: `1px dashed ${
            isOver
              ? 'var(--admin-accent)'
              : 'var(--surface-rule-strong)'
          }`,
          background: isOver
            ? 'color-mix(in srgb, var(--admin-accent) 8%, transparent)'
            : 'var(--surface-bg)',
          cursor: busy ? 'wait' : 'pointer',
          transition: 'border-color 120ms ease, background 120ms ease',
          minHeight: 96,
          color: 'var(--ink-strong)',
        }}
      >
        {value ? (
          <>
            <img
              src={value}
              alt=""
              width={64}
              height={64}
              style={{
                width: 64,
                height: 64,
                borderRadius: 8,
                objectFit: 'contain',
                background: 'var(--surface-elevated)',
                border: '1px solid var(--surface-rule)',
                flex: '0 0 64px',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-muted)',
                  marginBottom: 4,
                }}
              >
                {busy ? 'Uploading…' : 'Click to replace · or drop a new file'}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--ink-faint)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {value.replace(/^https?:\/\//, '')}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setError(null);
              }}
              style={{
                background: 'transparent',
                color: 'var(--ink-muted)',
                border: '1px solid var(--surface-rule-strong)',
                borderRadius: 6,
                padding: '6px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.04em',
                cursor: 'pointer',
              }}
            >
              Remove
            </button>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              textAlign: 'center',
              padding: '8px 0',
            }}
          >
            <span
              aria-hidden
              style={{
                fontSize: 22,
                color: 'var(--admin-accent)',
                lineHeight: 1,
              }}
            >
              ⇪
            </span>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 500,
                color: 'var(--ink-strong)',
              }}
            >
              {busy ? 'Uploading…' : 'Drop an image, or click to browse'}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.06em',
                color: 'var(--ink-muted)',
              }}
            >
              {helper ?? 'PNG · JPG · WEBP · SVG · up to 50 MB'}
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.currentTarget.value = '';
          }}
          style={{ display: 'none' }}
        />
      </div>
      {error ? (
        <div
          role="alert"
          style={{
            fontSize: 12,
            color: 'var(--color-maroon, #8b3a3a)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}

function storefrontSlugFromNamespace(namespace: string): string | undefined {
  const [, slug] = namespace.split('/').filter(Boolean);
  return slug;
}

function sanitizeUploadName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 80) || 'asset'
  );
}
