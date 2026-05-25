'use client';

import { useEffect, useState } from 'react';

/**
 * Small metadata strip rendered under an `AdminUploadField`. Shows the
 * uploaded asset's filename, format, and human-readable byte size so
 * the founder can confirm what was sent without leaving the page.
 *
 * Reads the file size via a HEAD on the Vercel Blob URL and the format
 * via the URL's extension. Both are best-effort — if the network call
 * fails (offline, CORS), the chip falls back to just the format.
 */
type Props = {
  url: string | null;
  className?: string;
};

export function UploadedFileMeta({ url, className }: Props) {
  const [bytes, setBytes] = useState<number | null>(null);

  useEffect(() => {
    setBytes(null);
    if (!url) return;
    let cancelled = false;
    fetch(url, { method: 'HEAD' })
      .then((res) => {
        if (cancelled) return;
        const len = res.headers.get('content-length');
        if (len) setBytes(Number(len));
      })
      .catch(() => {
        // Network/CORS failure — leave bytes null; the format chip is
        // enough confirmation for the founder.
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url) return null;
  const filename = url.split('/').pop() ?? '';
  const extDot = filename.lastIndexOf('.');
  const format = extDot >= 0 ? filename.slice(extDot + 1).toUpperCase() : '';

  return (
    <div
      className={className}
      style={{
        marginTop: 8,
        display: 'inline-flex',
        gap: 6,
        flexWrap: 'wrap',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--ink-muted)',
      }}
    >
      {format ? <Chip>{format}</Chip> : null}
      {bytes !== null ? <Chip>{formatBytes(bytes)}</Chip> : null}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        background: 'color-mix(in srgb, var(--ink-strong) 6%, transparent)',
        letterSpacing: '0.06em',
      }}
    >
      {children}
    </span>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1_048_576).toFixed(2)} MB`;
}
