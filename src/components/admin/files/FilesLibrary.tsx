'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { upload } from '@vercel/blob/client';
import { deleteStorefrontFile } from '@/app/actions/files';

type FileItem = {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
  contentType: string | null;
  namespace: string;
  name: string;
};

type Props = {
  storefrontSlug: string;
  initialFiles: FileItem[];
  initialUsedBytes?: number;
  storageLimitBytes?: number;
};

const DEFAULT_STORAGE_LIMIT_BYTES = 1_073_741_824;
const MAX_FILE_BYTES = 52_428_800;

const NAMESPACE_LABELS: Record<string, string> = {
  logos: 'Logos',
  favicons: 'Favicons',
  products: 'Products',
  categories: 'Categories',
  'og-images': 'Social images',
  banners: 'Banners',
  brand: 'Brand',
  builder: 'Builder',
  storefronts: 'Storefronts',
  apps: 'Apps',
  misc: 'Other',
  uploads: 'Uploads',
};

/**
 * Files library — drag-and-drop uploader + grid of every blob owned
 * by this storefront. Files appear in the same order as they're
 * uploaded (newest first); category chips filter by namespace.
 *
 * Click a tile to copy the public URL. Click the trash to delete (and
 * record an audit entry). The grid uses the `<img>` tag for previews
 * because everything is already a CDN-cached public blob — `next/image`
 * adds nothing here and would force us to pre-declare the remote host.
 */
export function FilesLibrary({
  storefrontSlug,
  initialFiles,
  initialUsedBytes,
  storageLimitBytes = DEFAULT_STORAGE_LIMIT_BYTES,
}: Props) {
  const router = useRouter();
  const locale = useLocale();
  const copy = storageCopy(locale);
  const [files, setFiles] = useState<FileItem[]>(initialFiles);
  const [trackedUsedBytes, setTrackedUsedBytes] = useState(
    initialUsedBytes ?? initialFiles.reduce((acc, file) => acc + file.size, 0),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const namespaces = useMemo(() => {
    const set = new Set<string>();
    for (const f of files) set.add(f.namespace);
    return ['all', ...Array.from(set).sort()];
  }, [files]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return files.filter((f) => {
      if (activeCategory !== 'all' && f.namespace !== activeCategory) return false;
      if (q && !f.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [files, activeCategory, search]);

  const usedBytes = trackedUsedBytes;
  const remainingBytes = Math.max(0, storageLimitBytes - usedBytes);
  const usagePercent = Math.min(100, Math.round((usedBytes / storageLimitBytes) * 100));

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const picked = Array.from(list);
    const pickedBytes = picked.reduce((acc, file) => acc + file.size, 0);
    if (pickedBytes > remainingBytes) {
      setError(copy.quotaExceeded(humanSize(remainingBytes)));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const uploaded: FileItem[] = [];
      for (const file of picked) {
        if (file.size > MAX_FILE_BYTES) {
          setError(copy.fileTooLarge(file.name));
          continue;
        }
        const safe = sanitizeUploadName(file.name);
        const result = await upload(`uploads/${storefrontSlug}/${safe}`, file, {
          access: 'public',
          handleUploadUrl: '/api/upload-blob',
          clientPayload: JSON.stringify({
            storefrontSlug,
            size: file.size,
            contentType: file.type || null,
          }),
        });
        uploaded.push({
          url: result.url,
          pathname: result.pathname,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          contentType: file.type || null,
          namespace: 'uploads',
          name: safe,
        });
      }
      setFiles((prev) => [...uploaded, ...prev]);
      setTrackedUsedBytes((prev) => prev + uploaded.reduce((acc, file) => acc + file.size, 0));
      router.refresh();
    } catch (err) {
      console.error('[FilesLibrary] upload failed', err);
      setError(copy.uploadFailed);
    } finally {
      setBusy(false);
    }
  }

  function copyUrl(url: string) {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(url);
        setTimeout(() => setCopied((v) => (v === url ? null : v)), 1400);
      })
      .catch(() => setError(copy.copyFailed));
  }

  function deleteFile(url: string) {
    if (typeof window !== 'undefined' && !window.confirm(copy.deleteConfirm))
      return;
    const fileSize = files.find((file) => file.url === url)?.size ?? 0;
    startTransition(async () => {
      const res = await deleteStorefrontFile({ storefrontSlug, url });
      if (res.status === 'success') {
        setFiles((prev) => prev.filter((f) => f.url !== url));
        setTrackedUsedBytes((prev) => Math.max(0, prev - fileSize));
      } else if (res.status === 'error') {
        setError(res.message);
      }
    });
  }

  return (
    <>
      <section
        aria-label={copy.usageLabel}
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 18,
          border: '1px solid color-mix(in srgb, var(--admin-accent) 24%, var(--surface-rule))',
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--surface-elevated) 92%, white), color-mix(in srgb, var(--admin-accent) 10%, var(--surface-bg)))',
          boxShadow: '0 24px 70px rgba(52, 24, 28, 0.10)',
          padding: 18,
          marginBottom: 16,
          color: 'var(--ink-strong)',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, transparent 0, color-mix(in srgb, var(--admin-accent) 8%, transparent) 50%, transparent 100%)',
            opacity: 0.55,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(180px, 260px)',
            gap: 18,
            alignItems: 'center',
          }}
          className="souqna-storage-hero-grid"
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--admin-accent)',
                marginBottom: 8,
              }}
            >
              {copy.eyebrow}
            </div>
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--font-serif, var(--font-sans))',
                fontWeight: 500,
                fontSize: 28,
                lineHeight: 1.08,
              }}
            >
              {copy.title}
            </h2>
            <p
              style={{
                margin: '10px 0 0',
                maxWidth: 620,
                color: 'var(--ink-muted)',
                fontSize: 14,
                lineHeight: 1.65,
              }}
            >
              {copy.subtitle}
            </p>
          </div>
          <div
            style={{
              borderRadius: 16,
              border: '1px solid var(--surface-rule)',
              background: 'color-mix(in srgb, var(--surface-bg) 70%, transparent)',
              padding: 14,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-muted)',
                }}
              >
                {copy.remaining}
              </span>
              <strong style={{ fontSize: 22 }}>{humanSize(remainingBytes)}</strong>
            </div>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                overflow: 'hidden',
                background: 'color-mix(in srgb, var(--ink-strong) 8%, transparent)',
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: `${usagePercent}%`,
                  height: '100%',
                  borderRadius: 999,
                  background:
                    'linear-gradient(90deg, var(--admin-accent), color-mix(in srgb, var(--color-maroon, #5b1f2a) 82%, var(--admin-accent)))',
                }}
              />
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                marginTop: 12,
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                color: 'var(--ink-muted)',
              }}
            >
              <span>{copy.used}: {humanSize(usedBytes)}</span>
              <span>{copy.limit}: {humanSize(storageLimitBytes)}</span>
              <span>{copy.files}: {files.length}</span>
            </div>
          </div>
        </div>
        <style>{`
          @media (max-width: 760px) {
            .souqna-storage-hero-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </section>

      <div
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label={copy.uploadFiles}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        style={{
          padding: 18,
          borderRadius: 12,
          border: '1px dashed color-mix(in srgb, var(--admin-accent) 35%, var(--surface-rule-strong))',
          background: 'color-mix(in srgb, var(--admin-accent) 5%, var(--surface-bg))',
          color: 'var(--ink-strong)',
          textAlign: 'center',
          cursor: busy ? 'wait' : 'pointer',
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span aria-hidden style={{ fontSize: 26, color: 'var(--admin-accent)', lineHeight: 1 }}>
          ⇪
        </span>
        <div style={{ fontSize: 14, fontWeight: 500 }}>
          {busy ? copy.uploading : copy.dropOrBrowse}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.06em',
            color: 'var(--ink-muted)',
          }}
        >
          {copy.formats}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.currentTarget.value = '';
          }}
          style={{ display: 'none' }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={copy.search}
          placeholder={copy.search}
          style={{
            flex: '1 1 220px',
            minWidth: 200,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--surface-rule-strong)',
            background: 'var(--surface-bg)',
            color: 'var(--ink-strong)',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {namespaces.map((ns) => {
            const active = activeCategory === ns;
            return (
              <button
                key={ns}
                type="button"
                onClick={() => setActiveCategory(ns)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: active
                    ? 'color-mix(in srgb, var(--admin-accent) 18%, transparent)'
                    : 'transparent',
                  border: `1px solid ${
                    active ? 'var(--admin-accent)' : 'var(--surface-rule-strong)'
                  }`,
                  color: active ? 'var(--admin-accent)' : 'var(--ink-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  textTransform: ns === 'all' ? 'uppercase' : 'none',
                }}
              >
                {ns === 'all' ? copy.all : NAMESPACE_LABELS[ns] ?? ns}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          style={{
            margin: '0 0 12px',
            color: 'var(--color-maroon, #8b3a3a)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            background: 'color-mix(in srgb, var(--color-maroon, #8b3a3a) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-maroon, #8b3a3a) 35%, transparent)',
            padding: '8px 10px',
            borderRadius: 8,
          }}
        >
          {error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div
          style={{
            padding: '36px 20px',
            textAlign: 'center',
            color: 'var(--ink-muted)',
            fontSize: 14,
            border: '1px dashed var(--surface-rule)',
            borderRadius: 12,
          }}
        >
          {files.length === 0
            ? copy.empty
            : copy.noMatches}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          {visible.map((f) => (
            <FileTile
              key={f.url}
              file={f}
              copied={copied === f.url}
              pending={pending}
              labels={copy}
              onCopy={() => copyUrl(f.url)}
              onDelete={() => deleteFile(f.url)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function FileTile({
  file,
  copied,
  pending,
  labels,
  onCopy,
  onDelete,
}: {
  file: FileItem;
  copied: boolean;
  pending: boolean;
  labels: ReturnType<typeof storageCopy>;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const isImage =
    !file.contentType ||
    file.contentType.startsWith('image/') ||
    /\.(png|jpe?g|webp|svg|gif|avif)$/i.test(file.name);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 10,
        border: '1px solid var(--surface-rule)',
        background: 'var(--surface-bg)',
        overflow: 'hidden',
        color: 'var(--ink-strong)',
      }}
    >
      <button
        type="button"
        onClick={onCopy}
        title={labels.copyUrl}
        aria-label={`${labels.copyUrl} ${file.name}`}
        style={{
          position: 'relative',
          aspectRatio: '4 / 3',
          background:
            'repeating-conic-gradient(color-mix(in srgb, var(--ink-strong) 4%, transparent) 0% 25%, transparent 0% 50%) 50% / 16px 16px',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          overflow: 'hidden',
        }}
      >
        {isImage ? (
          <img
            src={file.url}
            alt=""
            loading="lazy"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        ) : (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ink-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            {file.contentType?.split('/')[1] ?? 'file'}
          </span>
        )}
        {copied ? (
          <span
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              padding: '4px 8px',
              borderRadius: 999,
              background: 'var(--admin-accent)',
              color: 'var(--ink-on-gold)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              letterSpacing: '0.06em',
            }}
          >
            {labels.copied}
          </span>
        ) : null}
      </button>
      <div
        style={{
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={file.name}
        >
          {file.name}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            color: 'var(--ink-muted)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span>{NAMESPACE_LABELS[file.namespace] ?? file.namespace}</span>
          <span>{humanSize(file.size)}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          <button
            type="button"
            onClick={onCopy}
            style={{
              flex: 1,
              padding: '6px 0',
              borderRadius: 6,
              background: 'transparent',
              border: '1px solid var(--surface-rule-strong)',
              color: 'var(--ink-strong)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {labels.copy}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            aria-label={labels.delete}
            title={labels.delete}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              background: 'transparent',
              border: '1px solid color-mix(in srgb, var(--color-maroon, #8b3a3a) 30%, transparent)',
              color: 'var(--color-maroon, #8b3a3a)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              cursor: pending ? 'default' : 'pointer',
              opacity: pending ? 0.6 : 1,
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
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

function storageCopy(locale: string | undefined) {
  const ar = locale === 'ar';
  return {
    eyebrow: ar ? 'مكتبة التخزين' : 'Storage library',
    title: ar ? 'كل صور متجرك في مكان واحد' : 'One visual vault for your storefront',
    subtitle: ar
      ? 'ارفع الصور مرة واحدة، ثم استخدمها في المنتجات والبنّاء والهوية بدون فقدان الروابط.'
      : 'Upload once, then reuse images across products, the builder, brand assets, and share previews without losing the source file.',
    usageLabel: ar ? 'استخدام التخزين' : 'Storage usage',
    remaining: ar ? 'المتبقي' : 'Remaining',
    used: ar ? 'المستخدم' : 'Used',
    limit: ar ? 'الحد' : 'Limit',
    files: ar ? 'الملفات' : 'Files',
    uploading: ar ? 'جاري الرفع...' : 'Uploading...',
    dropOrBrowse: ar ? 'اسحب الصور هنا أو اضغط للاختيار' : 'Drop files here or click to browse',
    formats: ar
      ? 'PNG · JPG · WEBP · SVG · حتى 50MB · يمكن رفع أكثر من ملف'
      : 'PNG · JPG · WEBP · SVG · up to 50 MB · multiple files at once',
    uploadFailed: ar
      ? 'تعذر رفع الصورة. جرّب صورة أصغر بصيغة PNG أو JPG أو WEBP أو SVG.'
      : 'Upload failed. Try a smaller image (PNG, JPG, WEBP, SVG).',
    search: ar ? 'ابحث في الملفات...' : 'Search files...',
    all: ar ? 'الكل' : 'All',
    empty: ar
      ? 'المكتبة فارغة. ارفع أول صورة للبدء.'
      : 'Your library is empty. Drop a file above to get started.',
    noMatches: ar ? 'لا توجد ملفات مطابقة.' : 'No files match the filter.',
    copyUrl: ar ? 'نسخ رابط الملف' : 'Click to copy URL',
    copied: ar ? 'تم نسخ الرابط' : 'URL copied',
    copyFailed: ar ? 'تعذر نسخ الرابط من المتصفح.' : 'Could not copy the URL from this browser.',
    copy: ar ? 'نسخ الرابط' : 'Copy URL',
    delete: ar ? 'حذف الملف' : 'Delete file',
    deleteConfirm: ar ? 'حذف هذا الملف؟ لا يمكن التراجع.' : 'Delete this file? This cannot be undone.',
    uploadFiles: ar ? 'رفع ملفات' : 'Upload files',
    quotaExceeded: (remaining: string) =>
      ar
        ? `لا توجد مساحة كافية. المتبقي ${remaining}.`
        : `Not enough storage remaining. You have ${remaining} left.`,
    fileTooLarge: (name: string) =>
      ar ? `"${name}" أكبر من 50MB وتم تخطيه.` : `"${name}" is over 50 MB and was skipped.`,
  };
}
