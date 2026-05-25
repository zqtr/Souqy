'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { upload } from '@vercel/blob/client';
import { getStorefrontStorageLibrary, type SerializedStorefrontFile } from '@/app/actions/files';

type Props = {
  open: boolean;
  storefrontSlug: string;
  context: string;
  currentUrl?: string;
  locale?: string;
  onClose: () => void;
  onPick: (url: string) => void;
};

const MAX_FILE_BYTES = 52_428_800;
const DEFAULT_STORAGE_LIMIT_BYTES = 1_073_741_824;

type PickerLibraryState = {
  files: SerializedStorefrontFile[];
  usedBytes: number;
  limitBytes: number;
  loading: boolean;
  error: string | null;
};

export function StorageImagePicker({
  open,
  storefrontSlug,
  context,
  currentUrl,
  locale,
  onClose,
  onPick,
}: Props) {
  const [library, setLibrary] = useState<PickerLibraryState>({
    files: [],
    usedBytes: 0,
    limitBytes: DEFAULT_STORAGE_LIMIT_BYTES,
    loading: false,
    error: null,
  });
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const copy = useMemo(() => pickerCopy(locale), [locale]);
  const { files, usedBytes, limitBytes, loading, error } = library;

  const remainingBytes = Math.max(0, limitBytes - usedBytes);
  const usedPercent = Math.min(100, Math.round((usedBytes / limitBytes) * 100));

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setStorageOpen(false);
    setDragActive(false);
    setLibrary((prev) => ({ ...prev, loading: true, error: null }));
    void getStorefrontStorageLibrary({ storefrontSlug })
      .then((res) => {
        if (!alive) return;
        if (res.status === 'success') {
          setLibrary({
            files: res.files.filter(isImageFile),
            usedBytes: res.usedBytes,
            limitBytes: res.limitBytes,
            loading: false,
            error: null,
          });
        } else {
          setLibrary((prev) => ({ ...prev, loading: false, error: res.message }));
        }
      })
      .catch(() => {
        if (!alive) return;
        setLibrary((prev) => ({ ...prev, loading: false, error: copy.loadFailed }));
      });
    const id = window.setTimeout(() => titleRef.current?.focus(), 0);
    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [copy.loadFailed, open, storefrontSlug]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter(
      (file) =>
        file.name.toLowerCase().includes(q) ||
        file.namespace.toLowerCase().includes(q),
    );
  }, [files, query]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setLibrary((prev) => ({ ...prev, error: copy.fileTooLarge }));
      return;
    }
    if (file.size > remainingBytes) {
      setLibrary((prev) => ({
        ...prev,
        error: copy.quotaExceeded(humanSize(remainingBytes)),
      }));
      return;
    }
    setBusy(true);
    setLibrary((prev) => ({ ...prev, error: null }));
    try {
      const safe = sanitizeUploadName(file.name);
      const safeContext = sanitizeUploadName(context).slice(0, 48);
      const result = await upload(`builder/${storefrontSlug}/${safeContext}/${safe}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload-blob',
        clientPayload: JSON.stringify({
          storefrontSlug,
          size: file.size,
          contentType: file.type || null,
        }),
      });
      const nextFile: SerializedStorefrontFile = {
        url: result.url,
        pathname: result.pathname,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        contentType: file.type || null,
        namespace: 'builder',
        name: safe,
      };
      setLibrary((prev) => ({
        ...prev,
        files: [nextFile, ...prev.files],
        usedBytes: prev.usedBytes + file.size,
        error: null,
      }));
      onPick(result.url);
      onClose();
    } catch (err) {
      console.error('[StorageImagePicker] upload failed', err);
      setLibrary((prev) => ({ ...prev, error: copy.uploadFailed }));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 240,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        background: 'rgba(8, 7, 7, 0.64)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="storage-picker-title"
        style={{
          width: 'min(720px, calc(100vw - 28px))',
          maxHeight: 'min(760px, calc(100dvh - 28px))',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 22,
          border: '1px solid color-mix(in srgb, var(--bld-accent) 34%, var(--bld-divider))',
          background:
            'linear-gradient(145deg, color-mix(in srgb, var(--bld-surface) 96%, black), color-mix(in srgb, var(--bld-accent) 8%, var(--bld-surface)))',
          boxShadow: '0 32px 120px rgba(0,0,0,0.48)',
          color: 'var(--bld-text)',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 18,
            padding: '18px 20px',
            borderBottom: '1px solid var(--bld-divider)',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--bld-accent)',
                marginBottom: 7,
              }}
            >
              {copy.eyebrow}
            </div>
            <h2
              id="storage-picker-title"
              ref={titleRef}
              tabIndex={-1}
              style={{
                margin: 0,
                outline: 'none',
                fontFamily: 'var(--font-serif, var(--font-sans))',
                fontSize: 26,
                lineHeight: 1.08,
              }}
            >
              {copy.title}
            </h2>
            <p style={{ margin: '8px 0 0', color: 'var(--bld-text-muted)', fontSize: 13 }}>
              {copy.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            style={iconButtonStyle()}
          >
            x
          </button>
        </header>

        <div style={{ padding: 16, display: 'grid', gap: 12 }}>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              if (event.currentTarget === event.target) setDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              void handleFile(event.dataTransfer.files?.[0]);
            }}
            style={{
              width: '100%',
              minHeight: 148,
              borderRadius: 16,
              border: dragActive
                ? '1px solid var(--bld-accent)'
                : '1px dashed color-mix(in srgb, var(--bld-accent) 48%, var(--bld-input-border))',
              background: dragActive
                ? 'color-mix(in srgb, var(--bld-accent) 16%, var(--bld-input-bg))'
                : 'color-mix(in srgb, var(--bld-accent) 8%, var(--bld-input-bg))',
              color: 'var(--bld-text)',
              cursor: busy ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 9,
              fontWeight: 700,
              textAlign: 'center',
              padding: 18,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                display: 'grid',
                placeItems: 'center',
                border: '1px solid color-mix(in srgb, var(--bld-accent) 48%, transparent)',
                background: 'color-mix(in srgb, var(--bld-accent) 14%, transparent)',
                fontFamily: 'var(--font-mono)',
                fontSize: 20,
              }}
            >
              +
            </span>
            <span style={{ fontSize: 16 }}>{busy ? copy.uploading : copy.dropTitle}</span>
            <small
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--bld-text-muted)',
                letterSpacing: '0.06em',
                lineHeight: 1.45,
              }}
            >
              {copy.formats}
            </small>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
            onChange={(event) => void handleFile(event.currentTarget.files?.[0])}
            style={{ display: 'none' }}
          />
          <div
            style={{
              borderRadius: 14,
              border: '1px solid var(--bld-divider)',
              padding: '11px 12px',
              background: 'color-mix(in srgb, var(--bld-input-bg) 84%, transparent)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bld-text-muted)' }}>
                {copy.remaining}
              </span>
              <strong>{humanSize(remainingBytes)}</strong>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.08)',
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: `${usedPercent}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: 'linear-gradient(90deg, var(--bld-accent), #f2d69b)',
                }}
              />
            </div>
            <p style={{ margin: '8px 0 0', color: 'var(--bld-text-muted)', fontSize: 11 }}>
              {copy.usedOf(humanSize(usedBytes), humanSize(limitBytes))}
            </p>
          </div>
        </div>

        <div
          style={{
            minHeight: 0,
            overflow: 'auto',
            padding: '0 16px 16px',
            borderTop: '1px solid var(--bld-divider)',
          }}
        >
          {error ? (
            <p
              role="alert"
              style={{
                margin: '14px 0 0',
                borderRadius: 12,
                border: '1px solid rgba(230,138,138,0.35)',
                background: 'rgba(230,138,138,0.10)',
                color: '#f2aaaa',
                padding: '9px 11px',
                fontSize: 12,
              }}
            >
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setStorageOpen((value) => !value)}
            aria-expanded={storageOpen}
            style={{
              width: '100%',
              marginTop: 14,
              borderRadius: 14,
              border: '1px solid var(--bld-divider)',
              background: 'var(--bld-input-bg)',
              color: 'var(--bld-text)',
              padding: '12px 13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'grid', gap: 3 }}>
              <strong>{copy.storageTitle}</strong>
              <small style={{ color: 'var(--bld-text-muted)' }}>
                {loading ? copy.loadingShort : copy.storageCount(files.length)}
              </small>
            </span>
            <span
              aria-hidden="true"
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                display: 'grid',
                placeItems: 'center',
                border: '1px solid var(--bld-divider)',
                color: 'var(--bld-accent)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {storageOpen ? '-' : '+'}
            </span>
          </button>
          {storageOpen ? (
            <div style={{ paddingTop: 12 }}>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.search}
                style={{
                  width: '100%',
                  borderRadius: 999,
                  border: '1px solid var(--bld-input-border)',
                  background: 'var(--bld-input-bg)',
                  color: 'var(--bld-text)',
                  padding: '10px 13px',
                  marginBottom: 12,
                  outline: 'none',
                }}
              />
              {loading ? (
                <PickerState label={copy.loading} />
              ) : visible.length === 0 ? (
                <PickerState label={copy.empty} />
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))',
                    gap: 9,
                  }}
                >
                  {visible.map((file) => {
                    const active = currentUrl === file.url;
                    return (
                      <button
                        key={file.url}
                        type="button"
                        onClick={() => {
                          onPick(file.url);
                          onClose();
                        }}
                        style={{
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          borderRadius: 12,
                          border: active
                            ? '1px solid var(--bld-accent)'
                            : '1px solid var(--bld-divider)',
                          background: 'var(--bld-input-bg)',
                          color: 'var(--bld-text)',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          padding: 0,
                          textAlign: 'left',
                        }}
                      >
                        <span
                          style={{
                            position: 'relative',
                            display: 'block',
                            aspectRatio: '1 / 1',
                            background:
                              'repeating-conic-gradient(rgba(255,255,255,0.08) 0% 25%, transparent 0% 50%) 50% / 14px 14px',
                          }}
                        >
                          <img
                            src={file.url}
                            alt=""
                            loading="lazy"
                            style={{
                              position: 'absolute',
                              inset: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        </span>
                        <span
                          style={{
                            display: 'block',
                            padding: '0 7px 8px',
                            fontSize: 10,
                            color: 'var(--bld-text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {file.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>
        <style>{`
          @media (max-width: 680px) {
            #storage-picker-title { font-size: 22px !important; }
          }
        `}</style>
      </section>
    </div>,
    document.body,
  );
}

function PickerState({ label }: { label: string }) {
  return (
    <div
      style={{
        minHeight: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px dashed var(--bld-divider)',
        borderRadius: 16,
        color: 'var(--bld-text-muted)',
        fontSize: 13,
      }}
    >
      {label}
    </div>
  );
}

function isImageFile(file: SerializedStorefrontFile): boolean {
  return (
    !file.contentType ||
    file.contentType.startsWith('image/') ||
    /\.(png|jpe?g|webp|svg|gif|avif|ico)$/i.test(file.name)
  );
}

function iconButtonStyle(): CSSProperties {
  return {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: '1px solid var(--bld-divider)',
    background: 'var(--bld-input-bg)',
    color: 'var(--bld-text)',
    fontSize: 22,
    lineHeight: 1,
    cursor: 'pointer',
  };
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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

function pickerCopy(locale: string | undefined) {
  const ar = locale === 'ar';
  return {
    eyebrow: ar ? 'تخزين سوقنا' : 'Souqna Storage',
    title: ar ? 'اختر صورة' : 'Choose an image',
    subtitle: ar
      ? 'اختر صورة موجودة أو ارفع الصورة إلى التخزين أولا.'
      : 'Pick an existing asset or upload to Storage first.',
    close: ar ? 'إغلاق منتقي التخزين' : 'Close storage picker',
    dropTitle: ar ? 'ارفع صورة أو اسحبها هنا' : 'Upload picture or drop here',
    upload: ar ? 'رفع إلى التخزين' : 'Upload to Storage',
    uploading: ar ? 'جاري الرفع...' : 'Uploading...',
    formats: ar ? 'PNG / JPG / WEBP / SVG / حتى 50MB' : 'PNG / JPG / WEBP / SVG / max 50 MB',
    remaining: ar ? 'المتبقي' : 'Remaining',
    storageTitle: ar ? 'مكتبة التخزين' : 'Storage library',
    loadingShort: ar ? 'جاري التحميل...' : 'Loading...',
    storageCount: (count: number) =>
      ar ? `${count} صورة محفوظة` : `${count} saved image${count === 1 ? '' : 's'}`,
    search: ar ? 'ابحث في التخزين...' : 'Search storage...',
    loading: ar ? 'جاري تحميل التخزين...' : 'Loading storage...',
    loadFailed: ar ? 'تعذر تحميل مكتبة التخزين.' : 'Could not load storage files.',
    empty: ar ? 'لا توجد صور في التخزين بعد.' : 'No images in Storage yet.',
    fileTooLarge: ar ? 'هذا الملف أكبر من 50MB.' : 'This file is over 50 MB.',
    uploadFailed: ar
      ? 'تعذر الرفع. جرب صورة أصغر بصيغة PNG أو JPG أو WEBP أو SVG.'
      : 'Upload failed. Try a smaller PNG, JPG, WEBP, or SVG.',
    quotaExceeded: (remaining: string) =>
      ar
        ? `لا توجد مساحة كافية. المتبقي ${remaining}.`
        : `Not enough storage remaining. You have ${remaining} left.`,
    usedOf: (used: string, limit: string) =>
      ar ? `${used} مستخدم من ${limit}` : `${used} used of ${limit}`,
  };
}
