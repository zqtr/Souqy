'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { BellGlyph } from './glyphs';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationsRead,
} from '@/app/actions/notifications';
import type {
  Notification,
  NotificationStreamEvent,
} from '@/types/notification';

const PANEL_WIDTH = 380;
const MAX_ITEMS = 20;
const STREAM_URL = '/api/notifications/stream';
const PANEL_EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Top-bar notifications surface.
 *
 * Architecture notes:
 *   - Single `EventSource` opened on mount of the bell (not the
 *     dropdown) so the unread badge animates in real time even before
 *     the founder opens the panel. Stream tears down when the tab is
 *     hidden and re-establishes on visibility — Vercel keeps SSE
 *     connections cheap but a backgrounded tab burning a function
 *     instance for hours is wasteful.
 *   - Initial unread count is read from `getUnreadNotificationCount`
 *     so the badge is correct on hydration; the row list lazy-loads
 *     when the panel first opens.
 *   - `welcomeSeeded` gates the bell-shake to deltas that arrive
 *     AFTER the snapshot, so a refresh with existing unreads doesn't
 *     re-ring the bell.
 */
export function NotificationsBell() {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const reduce = useReducedMotion();
  const panelId = useId();

  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const welcomeSeeded = useRef(false);

  // Initial badge count (cheap, no row payload).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const n = await getUnreadNotificationCount();
        if (!cancelled) setUnread(n);
      } catch {
        // best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // SSE subscription, paused when tab is hidden.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let es: EventSource | null = null;
    let retry = 0;
    let retryTimer: number | null = null;
    let stopped = false;

    const mergeNew = (incoming: Notification[]) => {
      if (incoming.length === 0) return;
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const fresh = incoming.filter((n) => !seen.has(n.id));
        if (fresh.length === 0) return prev;
        return [...fresh, ...prev].slice(0, MAX_ITEMS);
      });
    };

    const open = () => {
      if (stopped) return;
      try {
        es = new EventSource(STREAM_URL);
      } catch {
        return;
      }
      es.onopen = () => {
        retry = 0;
      };
      es.onmessage = (ev) => {
        if (!ev.data) return;
        let parsed: NotificationStreamEvent | null = null;
        try {
          parsed = JSON.parse(ev.data) as NotificationStreamEvent;
        } catch {
          return;
        }
        if (!parsed) return;
        if (parsed.type === 'snapshot') {
          setUnread(parsed.unreadCount);
          mergeNew(parsed.latest);
          welcomeSeeded.current = true;
        } else if (parsed.type === 'delta') {
          const newOnes = parsed.new ?? [];
          if (newOnes.length === 0) return;
          mergeNew(newOnes);
          const unreadDelta = newOnes.filter((n) => !n.readAt).length;
          if (unreadDelta > 0) {
            setUnread((u) => u + unreadDelta);
            if (welcomeSeeded.current) setShakeKey((k) => k + 1);
          }
        }
      };
      es.onerror = () => {
        es?.close();
        es = null;
        if (stopped) return;
        retry += 1;
        const delay = Math.min(30_000, 1_000 * 2 ** Math.min(retry, 5));
        retryTimer = window.setTimeout(open, delay);
      };
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!es) open();
      } else {
        es?.close();
        es = null;
        if (retryTimer) {
          window.clearTimeout(retryTimer);
          retryTimer = null;
        }
      }
    };

    open();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibility);
      es?.close();
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, []);

  // Lazy-load the row list the first time the panel opens.
  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await getNotifications();
        if (cancelled) return;
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const merged = [...prev, ...rows.filter((r) => !seen.has(r.id))]
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )
            .slice(0, MAX_ITEMS);
          return merged;
        });
        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  // Click-outside + Esc to close, with focus return to bell.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (e.target instanceof Node && wrapRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      } else if (e.key === 'Tab' && panelRef.current) {
        // Lightweight focus trap: bounce focus between first/last
        // tabbable elements inside the panel.
        const tabbables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])',
        );
        if (tabbables.length === 0) return;
        const first = tabbables[0]!;
        const last = tabbables[tabbables.length - 1]!;
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleMarkAll = useCallback(async () => {
    if (unread === 0) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((r) => ({ ...r, readAt: r.readAt ?? now })));
    setUnread(0);
    try {
      await markAllNotificationsRead();
    } catch {
      // best-effort
    }
  }, [unread]);

  const handleRowRead = useCallback(
    async (id: string) => {
      setItems((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, readAt: r.readAt ?? new Date().toISOString() } : r,
        ),
      );
      const wasUnread = items.find((r) => r.id === id)?.readAt == null;
      if (wasUnread) setUnread((u) => Math.max(0, u - 1));
      try {
        await markNotificationsRead([id]);
      } catch {
        // best-effort
      }
    },
    [items],
  );

  const badgeText = unread > 9 ? '9+' : String(unread);
  const showBadge = unread > 0;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <motion.button
        ref={buttonRef}
        type="button"
        aria-label={`Notifications · التنبيهات${unread > 0 ? ` (${badgeText})` : ''}`}
        title="Notifications · التنبيهات"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="menu"
        onClick={() => setOpen((p) => !p)}
        animate={
          reduce
            ? undefined
            : shakeKey === 0
              ? undefined
              : { rotate: [-8, 6, -3, 0] }
        }
        transition={{ duration: 0.55, ease: 'easeOut' }}
        key={`bell-${shakeKey}`}
        style={{
          width: 36,
          height: 36,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          border: '1px solid transparent',
          background: open
            ? 'color-mix(in srgb, var(--ink-strong) 8%, transparent)'
            : 'transparent',
          color: 'var(--ink-strong)',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        <BellGlyph size={18} />
        <AnimatePresence>
          {showBadge ? (
            <motion.span
              aria-hidden
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                transition: reduce
                  ? { duration: 0.12 }
                  : { type: 'spring', stiffness: 520, damping: 18 },
              }}
              exit={{
                scale: 0.6,
                opacity: 0,
                transition: { duration: 0.18, ease: 'easeIn' },
              }}
              style={{
                position: 'absolute',
                top: 2,
                insetInlineEnd: 2,
                minWidth: 16,
                height: 16,
                padding: '0 4px',
                borderRadius: 999,
                background: 'var(--admin-accent, #b58a3a)',
                color: 'var(--ink-strong, #1f1b16)',
                fontFamily: 'var(--font-mono, ui-monospace)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 0 2px var(--surface-bg)',
                lineHeight: 1,
              }}
            >
              {badgeText}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.div
            ref={panelRef}
            id={panelId}
            role="menu"
            aria-label={isAr ? 'التنبيهات' : 'Notifications'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: PANEL_EASE }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              insetInlineEnd: 0,
              width: PANEL_WIDTH,
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 520,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 14,
              border:
                '1px solid color-mix(in srgb, var(--ink-strong) 12%, transparent)',
              background: 'var(--surface-bg)',
              boxShadow:
                '0 12px 36px -12px color-mix(in srgb, var(--ink-strong) 22%, transparent)',
              overflow: 'hidden',
              zIndex: 60,
            }}
          >
            <PanelHeader
              unread={unread}
              onMarkAll={handleMarkAll}
            />
            <div
              style={{
                overflowY: 'auto',
                padding: 6,
                flex: 1,
              }}
            >
              {items.length === 0 ? (
                <EmptyState />
              ) : (
                <ul
                  style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  {items.slice(0, MAX_ITEMS).map((row) => (
                    <li key={row.id} role="none">
                      <Row row={row} isAr={isAr} onRead={handleRowRead} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <PanelFooter />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PanelHeader({
  unread,
  onMarkAll,
}: {
  unread: number;
  onMarkAll: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '12px 14px',
        borderBottom:
          '1px solid color-mix(in srgb, var(--ink-strong) 10%, transparent)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        Notifications · <span lang="ar">التنبيهات</span>
      </span>
      <button
        type="button"
        disabled={unread === 0}
        onClick={onMarkAll}
        style={{
          fontSize: 11,
          padding: '4px 8px',
          borderRadius: 6,
          border: '1px solid transparent',
          background: 'transparent',
          color:
            unread === 0
              ? 'color-mix(in srgb, var(--ink-strong) 35%, transparent)'
              : 'var(--ink-strong)',
          cursor: unread === 0 ? 'default' : 'pointer',
          fontFamily: 'var(--font-sans)',
          whiteSpace: 'nowrap',
        }}
      >
        Mark all read · <span lang="ar">علّم الكل مقروءاً</span>
      </button>
    </div>
  );
}

function PanelFooter() {
  return (
    <Link
      href="/account/notifications"
      role="menuitem"
      style={{
        display: 'block',
        textAlign: 'center',
        padding: '10px 14px',
        borderTop:
          '1px solid color-mix(in srgb, var(--ink-strong) 10%, transparent)',
        fontSize: 12,
        color: 'var(--ink-strong)',
        textDecoration: 'none',
        background: 'color-mix(in srgb, var(--ink-strong) 3%, transparent)',
      }}
    >
      View all · <span lang="ar">عرض الكل</span>
    </Link>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '40px 16px',
        color: 'var(--ink-muted)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-serif), serif',
          fontStyle: 'italic',
          fontSize: 15,
        }}
      >
        All caught up
      </div>
      <div
        lang="ar"
        dir="rtl"
        style={{
          marginTop: 4,
          fontFamily: 'var(--font-arabic-serif), var(--font-arabic), serif',
          fontStyle: 'italic',
          fontSize: 14,
        }}
      >
        تمام الحال
      </div>
    </div>
  );
}

const ACCENT: Record<string, string> = {
  'billing.subscription.activated': 'var(--color-gold, #c9a24a)',
  'billing.subscription.updated': 'var(--color-gold, #c9a24a)',
  'billing.subscription.cancelled': 'var(--color-maroon, #7a2230)',
  'billing.subscription.suspended': 'var(--color-maroon, #7a2230)',
  'billing.subscription.expired': 'var(--color-maroon, #7a2230)',
  'billing.payment.failed': 'var(--color-maroon, #7a2230)',
  'billing.payment.succeeded': 'var(--admin-accent, #b58a3a)',
  'system.welcome': 'var(--ink-muted, #6c6256)',
};

function Row({
  row,
  isAr,
  onRead,
}: {
  row: Notification;
  isAr: boolean;
  onRead: (id: string) => Promise<void>;
}) {
  const reduce = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [fadingTint, setFadingTint] = useState(false);
  const unread = row.readAt == null;
  const accent = ACCENT[row.kind] ?? 'var(--ink-muted, #6c6256)';
  const title = isAr ? row.titleAr : row.title;
  const body = isAr ? row.bodyAr : row.body;

  const onClick = async (e: React.MouseEvent) => {
    if (unread) {
      setFadingTint(true);
      await onRead(row.id);
    }
    if (!row.href) {
      e.preventDefault();
    }
  };

  const tintAlpha = unread && !fadingTint ? 14 : 0;

  const inner: CSSProperties = {
    display: 'flex',
    gap: 10,
    padding: '10px 10px 10px 0',
    paddingInlineStart: 12,
    borderRadius: 10,
    background: hovered
      ? 'color-mix(in srgb, var(--ink-strong) 5%, transparent)'
      : `color-mix(in srgb, var(--color-gold, #c9a24a) ${tintAlpha}%, transparent)`,
    transition: 'background 320ms ease',
    position: 'relative',
    color: 'inherit',
    textDecoration: 'none',
  };

  const content = (
    <div
      role="menuitem"
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={inner}
    >
      <span
        aria-hidden
        style={{
          width: 4,
          alignSelf: 'stretch',
          borderRadius: 2,
          background: accent,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--ink-strong)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>
          <RelativeTime iso={row.createdAt} isAr={isAr} />
        </div>
        {body ? (
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--ink-muted)',
              marginTop: 2,
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {body}
          </div>
        ) : null}
      </div>
      {unread && !fadingTint ? (
        <motion.span
          aria-hidden
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: 'var(--admin-accent, #b58a3a)',
            alignSelf: 'center',
            flexShrink: 0,
            marginInlineEnd: 4,
          }}
        />
      ) : null}
    </div>
  );

  if (row.href) {
    const isExternal = row.href.startsWith('http');
    return isExternal ? (
      <a
        href={row.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
      >
        {content}
      </a>
    ) : (
      <Link
        href={row.href}
        onClick={onClick}
        style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: 'unset',
        display: 'block',
        width: '100%',
        cursor: 'pointer',
      }}
    >
      {content}
    </button>
  );
}

function RelativeTime({ iso, isAr }: { iso: string; isAr: boolean }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const label = formatRelative(iso, isAr ? 'ar-QA' : 'en');
  return (
    <span
      style={{
        fontSize: 10.5,
        color: 'var(--ink-muted)',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        fontFamily: 'var(--font-mono)',
      }}
    >
      {label}
    </span>
  );
}

function formatRelative(iso: string, locale: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  let value = diffSec;
  let unit: Intl.RelativeTimeFormatUnit = 'second';
  if (abs >= 60) {
    value = Math.round(diffSec / 60);
    unit = 'minute';
  }
  if (Math.abs(value) >= 60 && unit === 'minute') {
    value = Math.round(value / 60);
    unit = 'hour';
  }
  if (Math.abs(value) >= 24 && unit === 'hour') {
    value = Math.round(value / 24);
    unit = 'day';
  }
  if (Math.abs(value) >= 7 && unit === 'day') {
    value = Math.round(value / 7);
    unit = 'week';
  }
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      value,
      unit,
    );
  } catch {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      value,
      unit,
    );
  }
}
