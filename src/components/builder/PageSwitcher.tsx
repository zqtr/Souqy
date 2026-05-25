'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  createStorefrontPage,
  deleteStorefrontPage,
  publishStorefrontPage,
  renameStorefrontPage,
  reorderStorefrontPages,
  setStorefrontHomePage,
  setStorefrontPageSeo,
  toggleStorefrontPageInNav,
} from '@/app/actions/pages';
import {
  isReservedPageSlug,
  normalizePageSlug,
  type StorefrontPage,
} from '@/lib/storefrontPages';
import { MediaUploader } from './MediaUploader';

type Props = {
  slug: string;
  pages: StorefrontPage[];
  activePageId: string;
  onBeforeSwitch?: () => Promise<void> | void;
  giphyStorefrontSlug?: string;
};

type Toast = { id: number; kind: 'ok' | 'err'; message: string };

type PageMutation =
  | { kind: 'create' }
  | { kind: 'rename'; page: StorefrontPage }
  | { kind: 'seo'; page: StorefrontPage }
  | { kind: 'delete'; page: StorefrontPage };

/**
 * PageSwitcher — left-rail multi-page management panel.
 *
 * Lists every page in `storefront_pages` (home pinned, others sortable),
 * surfaces draft/published status, and exposes the page lifecycle
 * actions (create, rename, set-as-home, toggle-in-nav, edit SEO,
 * publish, delete) backed by `src/app/actions/pages.ts`.
 *
 * Drag-and-drop reorder uses a separate `DndContext` from the
 * BuilderShell's main canvas DnD — the two never share active items
 * (canvas drags blocks; this drags `page:<id>` ids), so collisions are
 * impossible and isolating the context keeps the implementations
 * independent.
 */
export function PageSwitcher({
  slug,
  pages,
  activePageId,
  onBeforeSwitch,
  giphyStorefrontSlug,
}: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [mutation, setMutation] = useState<PageMutation | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [, startTransition] = useTransition();
  // Local optimistic order so the dragged row settles immediately
  // instead of snapping back while we wait for the server action +
  // refresh. Synced from props on every props.pages change so external
  // mutations (publish, rename) propagate.
  const [localOrder, setLocalOrder] = useState<string[]>(() =>
    pages.map((p) => p.id),
  );
  useEffect(() => {
    setLocalOrder(pages.map((p) => p.id));
  }, [pages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const byId = useMemo(() => {
    const map = new Map<string, StorefrontPage>();
    for (const p of pages) map.set(p.id, p);
    return map;
  }, [pages]);

  const orderedPages = useMemo<StorefrontPage[]>(() => {
    const home = pages.find((p) => p.isHome);
    const rest = localOrder
      .map((id) => byId.get(id))
      .filter((p): p is StorefrontPage => Boolean(p) && !p!.isHome);
    return home ? [home, ...rest] : rest;
  }, [byId, localOrder, pages]);

  const sortableIds = useMemo(
    () => orderedPages.filter((p) => !p.isHome).map((p) => p.id),
    [orderedPages],
  );

  const pushToast = useCallback((kind: Toast['kind'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3500);
  }, []);

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  const goToPage = useCallback(
    async (pageSlug: string) => {
      if (onBeforeSwitch) await onBeforeSwitch();
      const params = new URLSearchParams();
      params.set('store', slug);
      if (pageSlug !== 'home') params.set('page', pageSlug);
      router.push(`/account/builder?${params.toString()}`);
    },
    [onBeforeSwitch, router, slug],
  );

  // ---- mutations ---------------------------------------------------------

  const handleSetHome = useCallback(
    async (page: StorefrontPage) => {
      if (page.isHome) return;
      setBusyId(page.id);
      const res = await setStorefrontHomePage({ slug, pageId: page.id });
      setBusyId(null);
      if (res.status === 'error') {
        pushToast('err', res.message);
        return;
      }
      pushToast('ok', `“${page.title}” is now the home page.`);
      refresh();
    },
    [pushToast, refresh, slug],
  );

  const handleToggleNav = useCallback(
    async (page: StorefrontPage) => {
      setBusyId(page.id);
      const res = await toggleStorefrontPageInNav({
        slug,
        pageId: page.id,
        showInNav: !page.showInNav,
      });
      setBusyId(null);
      if (res.status === 'error') {
        pushToast('err', res.message);
        return;
      }
      pushToast(
        'ok',
        page.showInNav
          ? `Hid “${page.title}” from the nav.`
          : `Showed “${page.title}” in the nav.`,
      );
      refresh();
    },
    [pushToast, refresh, slug],
  );

  const handlePublish = useCallback(
    async (page: StorefrontPage) => {
      setBusyId(page.id);
      const res = await publishStorefrontPage({ slug, pageId: page.id });
      setBusyId(null);
      if (res.status === 'error') {
        pushToast('err', res.message);
        return;
      }
      pushToast('ok', `Published “${page.title}”.`);
      refresh();
    },
    [pushToast, refresh, slug],
  );

  const handleDelete = useCallback(
    async (page: StorefrontPage) => {
      setBusyId(page.id);
      const res = await deleteStorefrontPage({ slug, pageId: page.id });
      setBusyId(null);
      setMutation(null);
      if (res.status === 'error') {
        pushToast('err', res.message);
        return;
      }
      pushToast('ok', `Deleted “${page.title}”.`);
      // If the founder deleted the page they were editing, route back
      // to home so the canvas doesn't 404 on next refresh.
      if (page.id === activePageId) {
        const params = new URLSearchParams();
        params.set('store', slug);
        router.push(`/account/builder?${params.toString()}`);
      } else {
        refresh();
      }
    },
    [activePageId, pushToast, refresh, router, slug],
  );

  const handleReorderEnd = useCallback(
    async (e: DragEndEvent) => {
      const activeId = String(e.active.id);
      const overId = e.over ? String(e.over.id) : null;
      if (!overId || overId === activeId) return;

      // Order tracked here is for the non-home portion only — DnD ids
      // are never the home row (it's not registered with sortable).
      const nonHome = localOrder.filter(
        (id) => byId.get(id) && !byId.get(id)!.isHome,
      );
      const from = nonHome.indexOf(activeId);
      const to = nonHome.indexOf(overId);
      if (from === -1 || to === -1) return;
      const reordered = arrayMove(nonHome, from, to);
      const home = pages.find((p) => p.isHome);
      const nextOrder = home ? [home.id, ...reordered] : reordered;
      setLocalOrder(nextOrder);

      const res = await reorderStorefrontPages({
        slug,
        pageIdsInOrder: nextOrder,
      });
      if (res.status === 'error') {
        pushToast('err', res.message);
        setLocalOrder(pages.map((p) => p.id));
        return;
      }
      refresh();
    },
    [byId, localOrder, pages, pushToast, refresh, slug],
  );

  // ---- render ------------------------------------------------------------

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 6,
          borderBottom: '1px solid var(--bld-divider)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--bld-text-muted)',
          }}
        >
          Pages · {pages.length}
        </span>
        <button
          type="button"
          onClick={() => setMutation({ kind: 'create' })}
          style={iconButtonStyle()}
          aria-label="Add page"
          title="Add page"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleReorderEnd}>
        <ul
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            margin: 0,
            padding: 0,
            listStyle: 'none',
          }}
        >
          {orderedPages.map((page) => {
            const isActive = page.id === activePageId;
            if (page.isHome) {
              return (
                <PageRow
                  key={page.id}
                  page={page}
                  isActive={isActive}
                  busy={busyId === page.id}
                  menuOpen={openMenuId === page.id}
                  onMenuToggle={() =>
                    setOpenMenuId((id) => (id === page.id ? null : page.id))
                  }
                  onMenuClose={() => setOpenMenuId(null)}
                  onSelect={() => {
                    if (!isActive) void goToPage(page.slug);
                  }}
                  onAction={(action) => {
                    setOpenMenuId(null);
                    if (action === 'rename') setMutation({ kind: 'rename', page });
                    if (action === 'seo') setMutation({ kind: 'seo', page });
                    if (action === 'toggle-nav') void handleToggleNav(page);
                    if (action === 'publish') void handlePublish(page);
                  }}
                  onlyPage={pages.length === 1}
                />
              );
            }
            return (
              <SortablePageRow
                key={page.id}
                page={page}
                isActive={isActive}
                busy={busyId === page.id}
                menuOpen={openMenuId === page.id}
                onMenuToggle={() =>
                  setOpenMenuId((id) => (id === page.id ? null : page.id))
                }
                onMenuClose={() => setOpenMenuId(null)}
                onSelect={() => {
                  if (!isActive) void goToPage(page.slug);
                }}
                onAction={(action) => {
                  setOpenMenuId(null);
                  if (action === 'rename') setMutation({ kind: 'rename', page });
                  if (action === 'seo') setMutation({ kind: 'seo', page });
                  if (action === 'toggle-nav') void handleToggleNav(page);
                  if (action === 'set-home') void handleSetHome(page);
                  if (action === 'publish') void handlePublish(page);
                  if (action === 'delete') setMutation({ kind: 'delete', page });
                }}
                onlyPage={pages.length === 1}
              />
            );
          })}
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            {/* Sortable items already rendered above in `orderedPages`
              — the SortableContext just registers their ids so the
              dnd-kit collision detector knows which ones to track. */}
            <span style={{ display: 'none' }} />
          </SortableContext>
        </ul>
      </DndContext>

      {mutation?.kind === 'create' ? (
        <PageFormModal
          mode="create"
          slug={slug}
          existingPages={pages}
          onClose={() => setMutation(null)}
          onSuccess={(newSlug, message) => {
            setMutation(null);
            pushToast('ok', message);
            const params = new URLSearchParams();
            params.set('store', slug);
            if (newSlug !== 'home') params.set('page', newSlug);
            router.push(`/account/builder?${params.toString()}`);
          }}
          onError={(message) => pushToast('err', message)}
        />
      ) : null}

      {mutation?.kind === 'rename' ? (
        <PageFormModal
          mode="rename"
          slug={slug}
          existingPages={pages}
          page={mutation.page}
          onClose={() => setMutation(null)}
          onSuccess={(_newSlug, message) => {
            setMutation(null);
            pushToast('ok', message);
            refresh();
          }}
          onError={(message) => pushToast('err', message)}
        />
      ) : null}

      {mutation?.kind === 'seo' ? (
        <PageSeoModal
          slug={slug}
          page={mutation.page}
          giphyStorefrontSlug={giphyStorefrontSlug}
          onClose={() => setMutation(null)}
          onSuccess={(message) => {
            setMutation(null);
            pushToast('ok', message);
            refresh();
          }}
          onError={(message) => pushToast('err', message)}
        />
      ) : null}

      {mutation?.kind === 'delete' ? (
        <ConfirmDialog
          title={`Delete “${mutation.page.title}”?`}
          body="This permanently removes the page and its draft + published blocks. This can’t be undone."
          confirmLabel="Delete page"
          danger
          busy={busyId === mutation.page.id}
          onCancel={() => setMutation(null)}
          onConfirm={() => handleDelete(mutation.page)}
        />
      ) : null}

      <ToastStack toasts={toasts} />
    </div>
  );
}

// ---- row components -----------------------------------------------------

type RowAction =
  | 'rename'
  | 'set-home'
  | 'toggle-nav'
  | 'seo'
  | 'publish'
  | 'delete';

type RowProps = {
  page: StorefrontPage;
  isActive: boolean;
  busy: boolean;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onSelect: () => void;
  onAction: (action: RowAction) => void;
  /** True when this is the storefront's only page — disables Delete /
   *  Set-as-home tooltips that would otherwise leave the storefront
   *  without a home page. */
  onlyPage: boolean;
};

function SortablePageRow(props: RowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.page.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };
  return (
    <PageRow
      {...props}
      sortRef={setNodeRef}
      sortStyle={style}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

function PageRow({
  page,
  isActive,
  busy,
  menuOpen,
  onMenuToggle,
  onMenuClose,
  onSelect,
  onAction,
  onlyPage,
  sortRef,
  sortStyle,
  dragHandleProps,
}: RowProps & {
  sortRef?: (node: HTMLElement | null) => void;
  sortStyle?: React.CSSProperties;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(ev: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(ev.target as Node)) onMenuClose();
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen, onMenuClose]);

  const hasDraftChanges =
    page.publishedBlocks == null ||
    JSON.stringify(page.draftBlocks) !== JSON.stringify(page.publishedBlocks);

  return (
    <li
      ref={sortRef}
      style={{
        ...(sortStyle ?? {}),
        position: 'relative',
        listStyle: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          borderRadius: 6,
          border: `1px solid ${
            isActive ? 'var(--bld-accent-line)' : 'var(--bld-divider)'
          }`,
          background: isActive ? 'var(--bld-accent-soft)' : 'var(--bld-tile-bg)',
          transition: 'background 140ms, border-color 140ms',
        }}
      >
        {dragHandleProps ? (
          <button
            type="button"
            {...dragHandleProps}
            aria-label="Drag to reorder"
            title="Drag to reorder"
            style={{
              ...iconButtonStyle(),
              width: 18,
              height: 22,
              cursor: 'grab',
              color: 'var(--bld-text-muted)',
              border: 'none',
              background: 'transparent',
            }}
          >
            <svg
              width="10"
              height="14"
              viewBox="0 0 10 14"
              fill="currentColor"
              aria-hidden
            >
              <circle cx="2" cy="2" r="1" />
              <circle cx="2" cy="7" r="1" />
              <circle cx="2" cy="12" r="1" />
              <circle cx="8" cy="2" r="1" />
              <circle cx="8" cy="7" r="1" />
              <circle cx="8" cy="12" r="1" />
            </svg>
          </button>
        ) : (
          <span
            aria-hidden
            style={{
              width: 18,
              height: 22,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--bld-text-muted)',
            }}
            title="Home is pinned"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 2 4 9v11h5v-6h6v6h5V9z" />
            </svg>
          </span>
        )}

        <button
          type="button"
          onClick={onSelect}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 2,
            padding: 0,
            background: 'transparent',
            border: 'none',
            color: 'var(--bld-text)',
            cursor: 'pointer',
            textAlign: 'start',
            minWidth: 0,
          }}
          aria-current={isActive ? 'page' : undefined}
          aria-label={`Edit ${page.title}`}
        >
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 13,
              lineHeight: 1.2,
              fontWeight: isActive ? 600 : 500,
              color: 'var(--bld-text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 180,
            }}
          >
            {page.title}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.06em',
              color: 'var(--bld-text-muted)',
            }}
          >
            <span style={{ opacity: 0.85 }}>/{page.slug}</span>
            <StatusDot
              status={page.status}
              hasDraftChanges={hasDraftChanges}
            />
            {page.isHome ? <Badge kind="home">home</Badge> : null}
            {page.showInNav ? <Badge kind="nav">nav</Badge> : null}
            {isActive ? <Badge kind="editing">editing</Badge> : null}
          </span>
        </button>

        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Page actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          disabled={busy}
          style={{
            ...iconButtonStyle(),
            opacity: busy ? 0.4 : 1,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <circle cx="5" cy="12" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="19" cy="12" r="1.7" />
          </svg>
        </button>
      </div>

      {menuOpen ? (
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'absolute',
            insetInlineEnd: 4,
            top: 'calc(100% + 4px)',
            zIndex: 30,
            minWidth: 180,
            padding: 4,
            background: 'var(--bld-surface)',
            border: '1px solid var(--bld-divider)',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.32)',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <MenuItem onSelect={() => onAction('rename')}>Rename</MenuItem>
          {!page.isHome ? (
            <MenuItem
              disabled={onlyPage}
              tooltip={
                onlyPage ? 'Only one page exists.' : undefined
              }
              onSelect={() => onAction('set-home')}
            >
              Set as homepage
            </MenuItem>
          ) : null}
          {!page.isHome ? (
            <MenuItem onSelect={() => onAction('toggle-nav')}>
              {page.showInNav ? 'Hide from nav' : 'Show in nav'}
            </MenuItem>
          ) : null}
          <MenuItem onSelect={() => onAction('seo')}>Edit SEO</MenuItem>
          <MenuItem
            disabled={!hasDraftChanges}
            tooltip={
              !hasDraftChanges ? 'No draft changes to publish.' : undefined
            }
            onSelect={() => onAction('publish')}
          >
            Publish page
          </MenuItem>
          {!page.isHome ? (
            <>
              <span
                style={{
                  height: 1,
                  background: 'var(--bld-divider)',
                  margin: '2px 0',
                }}
              />
              <MenuItem danger onSelect={() => onAction('delete')}>
                Delete page
              </MenuItem>
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function MenuItem({
  children,
  onSelect,
  disabled,
  danger,
  tooltip,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
  tooltip?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!disabled) onSelect();
      }}
      role="menuitem"
      title={tooltip}
      disabled={disabled}
      style={{
        textAlign: 'start',
        padding: '7px 10px',
        background: 'transparent',
        border: 'none',
        borderRadius: 4,
        color: disabled
          ? 'var(--bld-text-faint)'
          : danger
            ? '#E68A8A'
            : 'var(--bld-text)',
        fontFamily: 'var(--font-sans)',
        fontSize: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLButtonElement).style.background =
          'var(--bld-tile-bg)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

function Badge({
  kind,
  children,
}: {
  kind: 'home' | 'nav' | 'editing';
  children: React.ReactNode;
}) {
  const styles: Record<string, React.CSSProperties> = {
    home: {
      color: 'var(--bld-accent)',
      borderColor: 'var(--bld-accent-line)',
      background: 'var(--bld-accent-soft)',
    },
    nav: {
      color: 'var(--bld-text)',
      borderColor: 'var(--bld-divider)',
      background: 'var(--bld-tile-bg)',
    },
    editing: {
      color: '#E8DCC4',
      borderColor: '#E8DCC477',
      background: 'rgba(232,220,196,0.08)',
    },
  };
  return (
    <span
      style={{
        ...styles[kind],
        borderWidth: 1,
        borderStyle: 'solid',
        borderRadius: 3,
        padding: '0 4px',
        fontSize: 8,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

function StatusDot({
  status,
  hasDraftChanges,
}: {
  status: StorefrontPage['status'];
  hasDraftChanges: boolean;
}) {
  // Three states:
  //   • published, no draft changes → solid green
  //   • published, has draft changes → amber dot ("draft ahead")
  //   • never published → grey dot ("draft only")
  const color =
    status === 'published' && !hasDraftChanges
      ? '#7FB069'
      : status === 'published'
        ? '#D9A24A'
        : 'var(--bld-text-faint)';
  const label =
    status === 'published' && !hasDraftChanges
      ? 'Published'
      : status === 'published'
        ? 'Draft ahead of published'
        : 'Draft only';
  return (
    <span
      title={label}
      aria-label={label}
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        display: 'inline-block',
      }}
    />
  );
}

// ---- modals -------------------------------------------------------------

function PageFormModal({
  mode,
  slug,
  existingPages,
  page,
  onClose,
  onSuccess,
  onError,
}: {
  mode: 'create' | 'rename';
  slug: string;
  existingPages: StorefrontPage[];
  page?: StorefrontPage;
  onClose: () => void;
  onSuccess: (pageSlug: string, message: string) => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState(page?.title ?? '');
  const [pageSlug, setPageSlug] = useState(page?.slug ?? '');
  // Whether the founder has hand-edited the slug. Until they do, every
  // keystroke in the title pane regenerates the slug from the title so
  // they don't have to think about URL safety.
  const [slugDirty, setSlugDirty] = useState(mode === 'rename');
  const [duplicateFromPageId, setDuplicateFromPageId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slugDirty) return;
    setPageSlug(normalizePageSlug(title));
  }, [slugDirty, title]);

  const isHome = page?.isHome === true;
  const slugLocked = mode === 'rename' && isHome;
  const reserved = !slugLocked && isReservedPageSlug(pageSlug || '');

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Give the page a title.');
      return;
    }
    if (!slugLocked) {
      if (!pageSlug || !/^[a-z0-9-]+$/.test(pageSlug)) {
        setError('Slug can only contain lowercase letters, numbers, and dashes.');
        return;
      }
      if (reserved) {
        setError('That slug is reserved by Souqna. Pick another.');
        return;
      }
    }
    setBusy(true);
    if (mode === 'create') {
      const res = await createStorefrontPage({
        slug,
        title: title.trim(),
        pageSlug,
        duplicateFromPageId: duplicateFromPageId || undefined,
      });
      setBusy(false);
      if (res.status === 'success' && 'page' in res) {
        onSuccess(res.page.slug, `Created “${res.page.title}”.`);
      } else if (res.status === 'error') {
        if (res.field) setError(res.message);
        else onError(res.message);
        if (!res.field) onClose();
      }
      return;
    }
    if (!page) return;
    const res = await renameStorefrontPage({
      slug,
      pageId: page.id,
      title: title.trim(),
      pageSlug: slugLocked ? undefined : pageSlug,
    });
    setBusy(false);
    if (res.status === 'success' && 'page' in res) {
      onSuccess(res.page.slug, `Renamed to “${res.page.title}”.`);
    } else if (res.status === 'error') {
      if (res.field) setError(res.message);
      else onError(res.message);
    }
  }

  return (
    <ModalShell onClose={onClose} ariaLabel={mode === 'create' ? 'Add page' : 'Rename page'}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ModalHeader title={mode === 'create' ? 'Add page' : 'Rename page'} />
        <Field label="Title">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            placeholder="About"
            style={inputStyle()}
          />
        </Field>
        <Field
          label="Slug"
          hint={
            slugLocked
              ? 'The home page slug is fixed.'
              : 'Lowercase letters, numbers, dashes.'
          }
        >
          <input
            type="text"
            value={pageSlug}
            disabled={slugLocked}
            onChange={(e) => {
              setSlugDirty(true);
              setPageSlug(e.target.value.toLowerCase());
            }}
            onBlur={(e) =>
              setPageSlug(normalizePageSlug(e.target.value))
            }
            placeholder="about"
            style={{
              ...inputStyle(),
              fontFamily: 'var(--font-mono)',
              opacity: slugLocked ? 0.6 : 1,
            }}
          />
        </Field>
        {mode === 'create' && existingPages.length > 0 ? (
          <Field
            label="Duplicate from"
            hint="Optional — copies blocks + SEO from another page."
          >
            <select
              value={duplicateFromPageId}
              onChange={(e) => setDuplicateFromPageId(e.target.value)}
              style={inputStyle()}
            >
              <option value="">(blank)</option>
              {existingPages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} (/{p.slug})
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {error ? <ErrorLine>{error}</ErrorLine> : null}
        <ModalFooter
          busy={busy}
          onCancel={onClose}
          submitLabel={mode === 'create' ? 'Add page' : 'Save'}
        />
      </form>
    </ModalShell>
  );
}

function PageSeoModal({
  slug,
  page,
  giphyStorefrontSlug,
  onClose,
  onSuccess,
  onError,
}: {
  slug: string;
  page: StorefrontPage;
  giphyStorefrontSlug?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState(page.seo.title ?? '');
  const [description, setDescription] = useState(page.seo.description ?? '');
  const [image, setImage] = useState(page.seo.image ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    setBusy(true);
    const res = await setStorefrontPageSeo({
      slug,
      pageId: page.id,
      seo: {
        title: title.trim() || null,
        description: description.trim() || null,
        image: image.trim() || null,
      },
    });
    setBusy(false);
    if (res.status === 'error') {
      if (res.field) setError(res.message);
      else onError(res.message);
      return;
    }
    onSuccess(`Updated SEO on “${page.title}”.`);
  }

  return (
    <ModalShell onClose={onClose} ariaLabel={`Edit SEO for ${page.title}`}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ModalHeader title={`SEO · ${page.title}`} />
        <Field label="Title" hint="Shown in search results and the browser tab.">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={page.title}
            maxLength={140}
            style={inputStyle()}
          />
        </Field>
        <Field label="Description" hint="One or two sentences for search snippets.">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={260}
            style={{ ...inputStyle(), resize: 'vertical' }}
          />
        </Field>
        <Field label="Open Graph image" hint="Shown when the page is shared on social networks.">
          <MediaUploader
            value={image}
            onChange={setImage}
            namespace={`storefronts/${slug}/seo`}
            storefrontSlug={slug}
            giphyStorefrontSlug={giphyStorefrontSlug}
          />
        </Field>
        {error ? <ErrorLine>{error}</ErrorLine> : null}
        <ModalFooter busy={busy} onCancel={onClose} submitLabel="Save SEO" />
      </form>
    </ModalShell>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell onClose={onCancel} ariaLabel={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ModalHeader title={title} />
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-serif)',
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--bld-text)',
          }}
        >
          {body}
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={secondaryButtonStyle()}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={
              danger
                ? { ...primaryButtonStyle(), background: '#A33A3A', borderColor: '#A33A3A' }
                : primaryButtonStyle()
            }
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ---- shared primitives --------------------------------------------------

function ModalShell({
  children,
  onClose,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClose: () => void;
  ariaLabel: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bld-surface)',
          color: 'var(--bld-text)',
          border: '1px solid var(--bld-divider)',
          borderRadius: 8,
          padding: 18,
          width: 'min(440px, 100%)',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 18px 48px rgba(0,0,0,0.4)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title }: { title: string }) {
  return (
    <h2
      style={{
        margin: 0,
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
        fontSize: 20,
        lineHeight: 1.2,
        color: 'var(--bld-text)',
      }}
    >
      {title}
    </h2>
  );
}

function ModalFooter({
  busy,
  onCancel,
  submitLabel,
}: {
  busy: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 4,
      }}
    >
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        style={secondaryButtonStyle()}
      >
        Cancel
      </button>
      <button type="submit" disabled={busy} style={primaryButtonStyle()}>
        {busy ? 'Saving…' : submitLabel}
      </button>
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

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: '#E68A8A',
      }}
    >
      {children}
    </div>
  );
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 18,
        insetInlineStart: 18,
        zIndex: 120,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            pointerEvents: 'auto',
            padding: '8px 12px',
            background: 'var(--bld-surface)',
            color: 'var(--bld-text)',
            border: `1px solid ${
              t.kind === 'err' ? '#E68A8A' : 'var(--bld-accent-line)'
            }`,
            borderRadius: 6,
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            boxShadow: '0 8px 22px rgba(0,0,0,0.32)',
            maxWidth: 320,
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ---- style helpers ------------------------------------------------------

function iconButtonStyle(): React.CSSProperties {
  return {
    width: 26,
    height: 26,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    color: 'var(--bld-text-muted)',
    border: '1px solid var(--bld-divider)',
    borderRadius: 5,
    cursor: 'pointer',
    flex: '0 0 auto',
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '8px 10px',
    background: 'var(--bld-input-bg)',
    color: 'var(--bld-input-text)',
    border: '1px solid var(--bld-input-border)',
    borderRadius: 5,
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    outline: 'none',
  };
}

function primaryButtonStyle(): React.CSSProperties {
  return {
    padding: '7px 14px',
    border: '1px solid var(--bld-accent-line)',
    borderRadius: 999,
    background: 'var(--bld-accent)',
    color: 'var(--bld-accent-ink)',
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  };
}

function secondaryButtonStyle(): React.CSSProperties {
  return {
    padding: '7px 14px',
    border: '1px solid var(--bld-input-border)',
    borderRadius: 5,
    background: 'transparent',
    color: 'var(--bld-input-text)',
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  };
}
