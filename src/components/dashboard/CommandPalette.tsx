'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { palette } from '@/lib/tokens';
import { useTheme } from '@/components/theme/ThemeProvider';

export type Command = {
  id: string;
  label: string;
  /** Optional secondary text shown right-aligned (e.g. keyboard hint). */
  hint?: string;
  /** Optional category eyebrow shown above the first item of each group. */
  group?: string;
  onSelect: () => void;
};

type Props = {
  /**
   * Extra commands to merge in (e.g. block jumps from the builder). The
   * default set always includes navigation + theme controls.
   */
  extraCommands?: Command[];
  /**
   * The dashboard slug, used to build navigation commands. Pass the
   * empty string to omit nav commands.
   */
  slug?: string;
};

/**
 * Cmd-K command palette. Mounts a globally-listened keyboard shortcut
 * (Ctrl/Cmd + K) and renders an overlay with fuzzy-filtered commands.
 *
 * Designed to be the single keyboard surface across dashboard pages —
 * navigation, theme, builder block jumps, etc. The default command set
 * covers navigation + theme; additional commands can be passed in
 * (e.g. the builder injects "Jump to Hero" / "Jump to Banner" entries).
 */
export function CommandPalette({ extraCommands = [], slug }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Global Cmd-K / Ctrl-K → toggle the palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Focus the input every time the palette opens.
  useEffect(() => {
    if (open) {
      setQuery('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const baseCommands = useMemo<Command[]>(() => {
    const commands: Command[] = [];
    if (slug) {
      // Each command lands on the unified workspace at /account with the
      // appropriate `?tab=...` pre-selected. The retired per-storefront
      // dashboard pages are gone; "Storefront profile" maps to the
      // overview tab where the roster + delete affordance live.
      const store = encodeURIComponent(slug);
      commands.push(
        {
          id: 'nav-builder',
          group: 'Navigate',
          label: 'Open Builder',
          onSelect: () => router.push(`/account/builder?store=${store}`),
        },
        {
          id: 'nav-products',
          group: 'Navigate',
          label: 'Open Products',
          onSelect: () => router.push(`/account?tab=products&store=${store}`),
        },
        {
          id: 'nav-account',
          group: 'Navigate',
          label: 'Back to Account',
          onSelect: () => router.push('/account?tab=overview'),
        },
      );
    }
    commands.push(
      {
        id: 'theme-toggle',
        group: 'Theme',
        label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
        hint: theme === 'dark' ? '☼' : '☾',
        onSelect: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      },
    );
    return commands;
  }, [slug, router, theme, setTheme]);

  const allCommands = useMemo(() => [...baseCommands, ...extraCommands], [baseCommands, extraCommands]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCommands;
    return allCommands.filter((c) => {
      const hay = `${c.label} ${c.group ?? ''}`.toLowerCase();
      // Tiny fuzzy: every char in q must appear in order in hay.
      let i = 0;
      for (const ch of q) {
        const found = hay.indexOf(ch, i);
        if (found === -1) return false;
        i = found + 1;
      }
      return true;
    });
  }, [allCommands, query]);

  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  if (!open) return null;

  function handleSelect(cmd: Command) {
    cmd.onSelect();
    setOpen(false);
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Command palette"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(15,12,10,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 'min(18vh, 140px)',
      }}
    >
      <div
        style={{
          width: 'min(560px, 92vw)',
          background: '#1f1c19',
          border: `1px solid ${palette.maroon}33`,
          borderRadius: 10,
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
          color: 'var(--color-sand-pale)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 18px',
            borderBottom: '1px solid rgba(232,220,196,0.10)',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'rgba(232,220,196,0.5)' }}
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const cmd = filtered[activeIndex];
                if (cmd) handleSelect(cmd);
              }
            }}
            placeholder="Type a command…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'inherit',
              fontFamily: 'inherit',
              fontSize: 15,
            }}
          />
          <kbd
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.08em',
              color: 'rgba(232,220,196,0.45)',
              border: '1px solid rgba(232,220,196,0.18)',
              borderRadius: 4,
              padding: '2px 6px',
              textTransform: 'uppercase',
            }}
          >
            esc
          </kbd>
        </div>
        <div style={{ maxHeight: '52vh', overflowY: 'auto', padding: 6 }}>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '20px 14px',
                color: 'rgba(232,220,196,0.5)',
                fontSize: 13,
              }}
            >
              No matches.
            </div>
          ) : (
            filtered.map((cmd, i) => {
              const prev = filtered[i - 1];
              const showGroup = cmd.group && cmd.group !== prev?.group;
              const active = i === activeIndex;
              return (
                <div key={cmd.id}>
                  {showGroup ? (
                    <div
                      style={{
                        padding: '10px 10px 4px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        letterSpacing: '0.14em',
                        color: 'rgba(232,220,196,0.45)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {cmd.group}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => handleSelect(cmd)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: active ? 'rgba(232,220,196,0.06)' : 'transparent',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      color: 'var(--color-sand-pale)',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      textAlign: 'left',
                    }}
                  >
                    <span>{cmd.label}</span>
                    {cmd.hint ? (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          letterSpacing: '0.05em',
                          color: 'rgba(232,220,196,0.5)',
                        }}
                      >
                        {cmd.hint}
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid rgba(232,220,196,0.10)',
            display: 'flex',
            gap: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.1em',
            color: 'rgba(232,220,196,0.4)',
            textTransform: 'uppercase',
          }}
        >
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>⌘K toggle</span>
        </div>
      </div>
    </div>
  );
}
