'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Reusable searchable picker used by Mawid, Taqim and any future plugin
 * settings form that needs to pick storefront entities (products,
 * categories, etc.).
 *
 * Two modes:
 *  - mode="single" — `value` is `string | null`, `onChange` receives the
 *    new id (or null when cleared). Renders as a chip-style input that
 *    pops a search panel on focus.
 *  - mode="multi" — `value` is `string[]`, `onChange` receives the next
 *    list. Selected items show as removable chips above the input.
 *
 * The list area shows up to ~80 items, has a debounced search box with
 * thumbnail + label + optional sublabel, supports keyboard navigation
 * (Up/Down/Enter), and is keyboard-accessible. There's no virtualisation
 * yet — storefronts with hundreds of items will still render fast since
 * everything is filtered in memory.
 */

export type PickableEntity = {
  id: string;
  label: string;
  sublabel?: string | null;
  imageUrl?: string | null;
  glyph?: string;
};

type CommonProps = {
  options: PickableEntity[];
  placeholder?: string;
  emptyHint?: string;
  ariaLabel?: string;
};

type SingleProps = CommonProps & {
  mode: 'single';
  value: string | null;
  onChange: (next: string | null) => void;
  allowClear?: boolean;
};

type MultiProps = CommonProps & {
  mode: 'multi';
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
};

export function EntityPicker(props: SingleProps | MultiProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedIds = useMemo<string[]>(
    () =>
      props.mode === 'single'
        ? props.value
          ? [props.value]
          : []
        : props.value,
    [props],
  );

  const byId = useMemo(() => {
    const map = new Map<string, PickableEntity>();
    for (const o of props.options) map.set(o.id, o);
    return map;
  }, [props.options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = props.mode === 'multi'
      ? props.options.filter((o) => !selectedIds.includes(o.id))
      : props.options;
    if (!q) return list.slice(0, 80);
    return list
      .filter((o) => {
        return (
          o.label.toLowerCase().includes(q) ||
          (o.sublabel ?? '').toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q)
        );
      })
      .slice(0, 80);
  }, [props.mode, props.options, query, selectedIds]);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  function commitChoice(id: string) {
    if (props.mode === 'single') {
      props.onChange(id);
      setOpen(false);
      setQuery('');
      return;
    }
    if (props.max && props.value.length >= props.max) return;
    if (props.value.includes(id)) return;
    props.onChange([...props.value, id]);
    setQuery('');
    inputRef.current?.focus();
  }

  function removeChip(id: string) {
    if (props.mode === 'single') {
      props.onChange(null);
    } else {
      props.onChange(props.value.filter((v) => v !== id));
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = filtered[highlight];
      if (pick) commitChoice(pick.id);
    } else if (e.key === 'Backspace' && !query && props.mode === 'multi') {
      const last = props.value[props.value.length - 1];
      if (last) removeChip(last);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  const showSinglePicked =
    props.mode === 'single' && props.value && byId.has(props.value);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          minHeight: 44,
          borderRadius: 8,
          border: '1px solid var(--surface-rule-strong)',
          background: 'var(--surface-bg)',
          cursor: 'text',
        }}
      >
        {props.mode === 'multi'
          ? props.value.map((id) => {
              const o = byId.get(id);
              return (
                <Chip
                  key={id}
                  entity={o ?? { id, label: id }}
                  onRemove={() => removeChip(id)}
                />
              );
            })
          : showSinglePicked
          ? (() => {
              const o = byId.get(props.value as string)!;
              return (
                <Chip
                  entity={o}
                  onRemove={
                    (props as SingleProps).allowClear === false
                      ? undefined
                      : () => removeChip(o.id)
                  }
                />
              );
            })()
          : null}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={
            (props.mode === 'single' && showSinglePicked) ? '' : (props.placeholder ?? 'Search…')
          }
          aria-label={props.ariaLabel ?? props.placeholder ?? 'Search'}
          style={{
            flex: 1,
            minWidth: 80,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--ink-strong)',
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            padding: '4px 2px',
          }}
        />
      </div>

      {open ? (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            zIndex: 50,
            insetInlineStart: 0,
            insetInlineEnd: 0,
            top: 'calc(100% + 4px)',
            maxHeight: 280,
            overflow: 'auto',
            background: 'var(--surface-elevated, var(--surface-bg))',
            border: '1px solid var(--surface-rule-strong)',
            borderRadius: 10,
            boxShadow: '0 14px 40px -16px rgba(0,0,0,0.35)',
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '14px 12px',
                fontSize: 13,
                color: 'var(--ink-muted)',
              }}
            >
              {props.emptyHint ?? 'No matches.'}
            </div>
          ) : (
            filtered.map((o, i) => (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={i === highlight}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => commitChoice(o.id)}
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  background:
                    i === highlight
                      ? 'color-mix(in srgb, var(--ink-strong) 6%, transparent)'
                      : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid color-mix(in srgb, var(--ink-strong) 5%, transparent)',
                  textAlign: 'start',
                  cursor: 'pointer',
                }}
              >
                <Thumb entity={o} size={32} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 13.5,
                      color: 'var(--ink-strong)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {o.label}
                  </span>
                  {o.sublabel ? (
                    <span
                      style={{
                        display: 'block',
                        marginTop: 1,
                        fontSize: 11.5,
                        color: 'var(--ink-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {o.sublabel}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function Chip({
  entity,
  onRemove,
}: {
  entity: PickableEntity;
  onRemove?: () => void;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 6px 3px 4px',
        borderRadius: 999,
        background: 'color-mix(in srgb, var(--ink-strong) 7%, transparent)',
        border: '1px solid color-mix(in srgb, var(--ink-strong) 12%, transparent)',
        fontSize: 12.5,
        color: 'var(--ink-strong)',
        maxWidth: 220,
      }}
    >
      <Thumb entity={entity} size={20} />
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {entity.label}
      </span>
      {onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${entity.label}`}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--ink-muted)',
            fontSize: 14,
            lineHeight: 1,
            padding: 0,
            marginInlineStart: 2,
          }}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

function Thumb({ entity, size }: { entity: PickableEntity; size: number }) {
  if (entity.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={entity.imageUrl}
        alt=""
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          objectFit: 'cover',
          flex: `0 0 ${size}px`,
          background: 'color-mix(in srgb, var(--ink-strong) 6%, transparent)',
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        flex: `0 0 ${size}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'color-mix(in srgb, var(--ink-strong) 7%, transparent)',
        color: 'var(--ink-muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: Math.round(size * 0.5),
      }}
    >
      {entity.glyph ?? entity.label.slice(0, 1).toUpperCase()}
    </span>
  );
}
