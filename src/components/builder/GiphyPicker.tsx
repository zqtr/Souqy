'use client';

import { useEffect, useRef, useState } from 'react';

type GiphyHit = {
  id: string;
  title: string;
  previewUrl: string;
  previewWidth: number;
  previewHeight: number;
  fullUrl: string;
};

/**
 * Modal GIF picker shown when the founder taps "Pick a GIF" on any
 * MediaUploader inside the builder. Calls our `/api/apps/giphy/search`
 * proxy, debounces input by 300ms, and on selection passes the hit's
 * full-resolution URL back to the parent via `onPick`.
 */
export function GiphyPicker({
  storefrontSlug,
  open,
  onClose,
  onPick,
}: {
  storefrontSlug: string;
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
}) {
  const [q, setQ] = useState('joy');
  const [hits, setHits] = useState<GiphyHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 1) {
      setHits([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/apps/giphy/search?store=${encodeURIComponent(storefrontSlug)}&q=${encodeURIComponent(q.trim())}&limit=24`,
          { cache: 'no-store' },
        );
        const json = (await res.json()) as {
          ok: boolean;
          results?: GiphyHit[];
          error?: string;
        };
        if (!res.ok || !json.ok) {
          setError(json.error ?? 'Search failed');
          setHits([]);
        } else {
          setHits(json.results ?? []);
        }
      } catch {
        setError('Network error.');
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, open, storefrontSlug]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick a GIF"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '80vh',
          background: '#1a1612',
          color: '#f1e9d7',
          border: '1px solid rgba(232,220,196,0.18)',
          borderRadius: 14,
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        }}
      >
        <header style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span
            aria-hidden
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.18em',
              color: '#a8893f',
              textTransform: 'uppercase',
            }}
          >
            ◈ Giphy
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search GIFs… joy, oud, qatar"
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 8,
              border: '1px solid rgba(232,220,196,0.2)',
              background: 'rgba(0,0,0,0.35)',
              color: '#f1e9d7',
              fontSize: 13.5,
              outline: 'none',
            }}
            autoFocus
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              padding: '9px 12px',
              borderRadius: 8,
              background: 'transparent',
              color: '#f1e9d7',
              border: '1px solid rgba(232,220,196,0.2)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </header>

        {error ? (
          <p
            role="alert"
            style={{
              margin: 0,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(230,138,138,0.12)',
              color: '#E68A8A',
              fontSize: 12.5,
            }}
          >
            {error}
          </p>
        ) : null}

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8,
            paddingRight: 4,
          }}
        >
          {loading && hits.length === 0 ? (
            <p
              style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                margin: '40px 0',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.16em',
                color: 'rgba(232,220,196,0.55)',
              }}
            >
              SEARCHING…
            </p>
          ) : hits.length === 0 ? (
            <p
              style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                margin: '40px 0',
                fontSize: 13,
                color: 'rgba(232,220,196,0.55)',
              }}
            >
              No GIFs to show. Try another search.
            </p>
          ) : (
            hits.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  onPick(g.fullUrl);
                  onClose();
                }}
                aria-label={g.title}
                style={{
                  display: 'block',
                  padding: 0,
                  border: '1px solid rgba(232,220,196,0.12)',
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: 'rgba(0,0,0,0.5)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#a8893f';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(232,220,196,0.12)';
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.previewUrl}
                  alt={g.title}
                  width={g.previewWidth}
                  height={g.previewHeight}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                  }}
                />
              </button>
            ))
          )}
        </div>

        <footer
          style={{
            paddingTop: 6,
            borderTop: '1px solid rgba(232,220,196,0.08)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.06em',
            color: 'rgba(232,220,196,0.45)',
            textTransform: 'uppercase',
            textAlign: 'right',
          }}
        >
          Powered by Giphy · Souqna proxy
        </footer>
      </div>
    </div>
  );
}
