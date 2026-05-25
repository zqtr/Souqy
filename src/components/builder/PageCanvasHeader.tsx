'use client';

import { useCallback, useEffect, useState } from 'react';
import { setStorefrontPageSeo } from '@/app/actions/pages';
import type { StorefrontPage } from '@/lib/storefrontPages';
import { MediaUploader } from './MediaUploader';

type Props = {
  slug: string;
  page: StorefrontPage;
  onlyPage: boolean;
  onSetHome: () => Promise<void> | void;
  giphyStorefrontSlug?: string;
};

/**
 * Page-edit affordances rendered above the canvas device frame when
 * the founder is editing a page that *isn't* the storefront's home.
 *
 * Two surfaces, both collapsible:
 *
 *   • SEO mini-form (title / description / og image), debounced and
 *     wired to `setStorefrontPageSeo`.
 *   • "Set as homepage" inline action — duplicates the menu entry in
 *     the PageSwitcher so the founder doesn't have to bounce back to
 *     the rail when they decide their secondary page is actually the
 *     better landing.
 *
 * Hidden entirely on the home page; the home row in the PageSwitcher
 * handles the analogous SEO surface there. Founders edit the home
 * SEO via the Site inspector's existing storefront-level SEO panel.
 */
export function PageCanvasHeader({
  slug,
  page,
  onlyPage,
  onSetHome,
  giphyStorefrontSlug,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(page.seo.title ?? '');
  const [description, setDescription] = useState(page.seo.description ?? '');
  const [image, setImage] = useState(page.seo.image ?? '');

  // Reset whenever the active page changes — the parent shell remounts
  // us via `key` on page swap, but we still resync explicitly so an
  // in-place SEO update from the rail's PageSeoModal flows back here
  // without forcing a remount.
  useEffect(() => {
    setTitle(page.seo.title ?? '');
    setDescription(page.seo.description ?? '');
    setImage(page.seo.image ?? '');
  }, [page.id, page.seo.title, page.seo.description, page.seo.image]);

  const save = useCallback(
    async (next: { title: string; description: string; image: string }) => {
      setBusy(true);
      setError(null);
      const res = await setStorefrontPageSeo({
        slug,
        pageId: page.id,
        seo: {
          title: next.title.trim() || null,
          description: next.description.trim() || null,
          image: next.image.trim() || null,
        },
      });
      setBusy(false);
      if (res.status === 'error') {
        setError(res.message);
      } else {
        setSavedAt(Date.now());
      }
    },
    [page.id, slug],
  );

  // Debounce SEO writes so the founder typing into the title doesn't
  // hammer the server action with one request per keystroke.
  useEffect(() => {
    if (!open) return;
    const initial =
      title === (page.seo.title ?? '') &&
      description === (page.seo.description ?? '') &&
      image === (page.seo.image ?? '');
    if (initial) return;
    const timer = setTimeout(() => {
      void save({ title, description, image });
    }, 600);
    return () => clearTimeout(timer);
  }, [description, image, open, page.seo.description, page.seo.image, page.seo.title, save, title]);

  return (
    <div
      role="region"
      aria-label={`Page edit affordances for ${page.title}`}
      style={{
        marginInline: 'clamp(12px, 2vw, 24px)',
        marginTop: 12,
        border: '1px solid var(--bld-divider)',
        borderRadius: 8,
        background: 'var(--bld-surface)',
        color: 'var(--bld-text)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          borderBottom: open ? '1px solid var(--bld-divider)' : 'none',
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`page-seo-${page.id}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            border: 'none',
            color: 'var(--bld-text)',
            cursor: 'pointer',
            padding: 0,
            flex: 1,
            minWidth: 0,
            textAlign: 'start',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 16,
              height: 16,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 160ms',
              color: 'var(--bld-text-muted)',
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="currentColor"
              aria-hidden
            >
              <path d="M3 1l5 4-5 4z" />
            </svg>
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--bld-text-muted)',
            }}
          >
            Page · /{page.slug}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 14,
              color: 'var(--bld-text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            SEO &amp; settings
          </span>
          {busy ? (
            <SaveLabel>Saving…</SaveLabel>
          ) : error ? (
            <SaveLabel danger>{error}</SaveLabel>
          ) : savedAt ? (
            <SaveLabel>Saved</SaveLabel>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onSetHome}
          disabled={onlyPage}
          title={
            onlyPage
              ? 'Add another page first.'
              : 'Promote this page to the storefront home.'
          }
          style={{
            padding: '6px 10px',
            border: '1px solid var(--bld-accent-line)',
            borderRadius: 999,
            background: 'transparent',
            color: 'var(--bld-accent)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: onlyPage ? 'not-allowed' : 'pointer',
            opacity: onlyPage ? 0.45 : 1,
          }}
        >
          Set as home
        </button>
      </div>
      {open ? (
        <div
          id={`page-seo-${page.id}`}
          style={{
            padding: '14px 16px',
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          }}
        >
          <Field label="SEO title" hint="Defaults to the page title.">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={page.title}
              maxLength={140}
              style={inputStyle()}
            />
          </Field>
          <Field
            label="Description"
            hint="One or two sentences for search snippets."
          >
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={260}
              style={{ ...inputStyle(), resize: 'vertical' }}
            />
          </Field>
          <Field
            label="Open Graph image"
            hint="Used when this page is shared on social."
          >
            <MediaUploader
              value={image}
              onChange={setImage}
              namespace={`storefronts/${slug}/seo`}
              storefrontSlug={slug}
              giphyStorefrontSlug={giphyStorefrontSlug}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--bld-text-muted)',
        }}
      >
        {label}
      </span>
      {children}
      {hint ? (
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            color: 'var(--bld-text-muted)',
            fontStyle: 'italic',
          }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function SaveLabel({
  children,
  danger,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: danger ? '#E68A8A' : 'var(--bld-text-muted)',
        marginInlineStart: 8,
      }}
    >
      {children}
    </span>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '7px 10px',
    background: 'var(--bld-input-bg)',
    color: 'var(--bld-input-text)',
    border: '1px solid var(--bld-input-border)',
    borderRadius: 5,
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    outline: 'none',
  };
}
