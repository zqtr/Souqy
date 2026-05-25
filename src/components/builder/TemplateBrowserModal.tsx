'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion } from 'framer-motion';
import { type TemplateId } from '@/lib/brief';
import { templatePresets } from '@/lib/templates';
import { PLAN_LIMITS, planAtLeast, type Plan } from '@/lib/plans';
import { TemplatePreview } from '@/components/templates/previews';

type Props = {
  slug: string;
  /** Free templates listed first; pro listed under a divider. */
  freeTemplates: TemplateId[];
  proTemplates: TemplateId[];
  activeTemplate: TemplateId;
  /** Template currently queued for confirmation in the parent. Renders
   *  a faint highlight on the matching row so the founder sees their
   *  pending pick survive the confirm dialog. */
  pendingTemplate: TemplateId | null;
  currentPlan: Plan;
  onClose: () => void;
  /** "Use this template" CTA on an unlocked template. The parent feeds
   *  this into the same `setPendingTemplate` → `TemplateConfirm` flow
   *  the inspector carousel used. */
  onPick: (id: TemplateId) => void;
  /** Same CTA on a locked template — the parent surfaces an upsell. */
  onPickLocked: (id: TemplateId) => void;
};

/**
 * Full-screen "Browse all templates" modal for the Site inspector.
 *
 * Replaces the inspector's old gradient-swatch carousel with a true
 * preview of each template applied to the founder's actual storefront
 * — products, categories, policies and all — via the ephemeral
 * `/account/{slug}/preview/template/{templateId}` route iframed on the
 * right.
 *
 *  - Left rail: scrollable list of every template (free first, then
 *    pro), each row labelled with the template name, its plan tier and
 *    a lock glyph when the founder's plan can't reach it.
 *  - Right pane: large `<iframe>` keyed on `templateId` so React
 *    unmounts/remounts cleanly between switches and the server gets a
 *    fresh render every time.
 *  - Bottom action bar: prev / next arrows around the focused
 *    template's label, with "Use this template" as the rightmost CTA.
 *
 * Keyboard:
 *  - ← / → navigate the list (RTL-aware — in Arabic the visual
 *    "previous" arrow points to the next template).
 *  - Enter triggers the CTA on the focused template.
 *  - Esc closes the modal.
 */
export function TemplateBrowserModal({
  slug,
  freeTemplates,
  proTemplates,
  activeTemplate,
  pendingTemplate,
  currentPlan,
  onClose,
  onPick,
  onPickLocked,
}: Props) {
  const allTemplates = useMemo(
    () => [...freeTemplates, ...proTemplates],
    [freeTemplates, proTemplates],
  );

  const initialFocus = useMemo(
    () => Math.max(0, allTemplates.findIndex((id) => id === activeTemplate)),
    [allTemplates, activeTemplate],
  );

  const [focusIdx, setFocusIdx] = useState(initialFocus);
  const [isRtl, setIsRtl] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setIsRtl(document.documentElement.dir === 'rtl');
    }
  }, []);

  // Reset the iframe loading veil whenever the focused template
  // changes — `key={focused}` triggers a remount, so onLoad fires
  // again and clears the skeleton.
  useEffect(() => {
    setIframeLoaded(false);
  }, [focusIdx]);

  // Lock body scroll while the modal is open. Restored on unmount.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const focused = allTemplates[focusIdx] ?? activeTemplate;
  const focusedPreset = templatePresets[focused];
  const focusedUnlocked = planAtLeast(currentPlan, focusedPreset.tier);
  const isCurrent = focused === activeTemplate;

  const goPrev = useCallback(() => {
    setFocusIdx((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setFocusIdx((i) => Math.min(allTemplates.length - 1, i + 1));
  }, [allTemplates.length]);

  const handleUse = useCallback(() => {
    if (isCurrent) return;
    if (focusedUnlocked) onPick(focused);
    else onPickLocked(focused);
  }, [focused, focusedUnlocked, isCurrent, onPick, onPickLocked]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement | null;
        // Don't hijack Enter when the focused element is itself a
        // button/link/input — the user clearly meant to activate it.
        if (target && /^(BUTTON|A|INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) {
          return;
        }
        e.preventDefault();
        handleUse();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (isRtl) goNext();
        else goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (isRtl) goPrev();
        else goNext();
      }
    },
    [goNext, goPrev, handleUse, isRtl, onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  // Keep the focused row in view as the user arrows through the list.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-template-row="${focused}"]`,
    );
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focused]);

  const [latinLabel, arabicLabel] = focusedPreset.label
    .split('·')
    .map((s) => s.trim());

  const ctaLabel = isCurrent
    ? 'Currently active'
    : focusedUnlocked
      ? 'Use this template'
      : 'Upgrade to use';
  const ctaDisabled = isCurrent;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Browse templates"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 130,
        background: 'rgba(0,0,0,0.62)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid var(--bld-divider)',
          background: 'var(--bld-surface)',
          color: 'var(--bld-input-text)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--bld-accent)',
            }}
          >
            Browse templates
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              color: 'var(--bld-text-muted)',
            }}
          >
            Live previews using your products + categories
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close template browser"
          style={{
            width: 32,
            height: 32,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            borderRadius: 6,
            border: '1px solid var(--bld-input-border)',
            background: 'transparent',
            color: 'var(--bld-input-text)',
            cursor: 'pointer',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 280px) 1fr',
          background: 'var(--bld-canvas, #1a1816)',
        }}
      >
        <aside
          ref={listRef}
          style={{
            borderInlineEnd: '1px solid var(--bld-divider)',
            background: 'var(--bld-surface)',
            overflow: 'auto',
            padding: '12px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <SectionLabel>Free</SectionLabel>
          {freeTemplates.map((id) =>
            renderRow(id, currentPlan, focused, activeTemplate, pendingTemplate, isRtl, (next) => {
              const i = allTemplates.indexOf(next);
              if (i >= 0) setFocusIdx(i);
            }),
          )}
          {proTemplates.length ? <SectionLabel>Paid templates</SectionLabel> : null}
          {proTemplates.map((id) =>
            renderRow(id, currentPlan, focused, activeTemplate, pendingTemplate, isRtl, (next) => {
              const i = allTemplates.indexOf(next);
              if (i >= 0) setFocusIdx(i);
            }),
          )}
        </aside>

        <main
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'center',
            padding: 16,
            minHeight: 0,
          }}
        >
          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 0,
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid var(--bld-iframe-border, rgba(255,255,255,0.08))',
              background: '#fff',
              display: 'flex',
            }}
          >
            <iframe
              key={focused}
              src={`/account/${slug}/preview/template/${focused}`}
              title={`Template preview · ${focusedPreset.label}`}
              onLoad={() => setIframeLoaded(true)}
              style={{
                flex: 1,
                width: '100%',
                height: '100%',
                border: 'none',
                background: '#fff',
              }}
            />
            {!iframeLoaded ? (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background:
                    'linear-gradient(135deg, rgba(26,24,22,0.04) 0%, rgba(26,24,22,0.10) 100%)',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    width: 220,
                    height: 6,
                    borderRadius: 999,
                    background:
                      'linear-gradient(90deg, transparent 0%, var(--bld-accent-line) 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'souqna-shimmer 1.4s linear infinite',
                  }}
                />
              </div>
            ) : null}
          </div>
        </main>
      </div>

      <footer
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center',
          gap: 12,
          padding: '12px 18px',
          borderTop: '1px solid var(--bld-divider)',
          background: 'var(--bld-surface)',
          color: 'var(--bld-input-text)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'inline-flex', gap: 4 }}>
          <ArrowButton
            direction="prev"
            isRtl={isRtl}
            disabled={focusIdx <= 0}
            onClick={goPrev}
          />
          <ArrowButton
            direction="next"
            isRtl={isRtl}
            disabled={focusIdx >= allTemplates.length - 1}
            onClick={goNext}
          />
        </div>
        <div
          aria-live="polite"
          style={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 18,
              lineHeight: 1.2,
              color: 'var(--bld-input-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {latinLabel ?? focused}
            {arabicLabel ? (
              <span
                style={{
                  marginInlineStart: 8,
                  fontSize: 14,
                  color: 'var(--bld-text-muted)',
                }}
              >
                · {arabicLabel}
              </span>
            ) : null}
            {isCurrent ? (
              <span
                style={{
                  marginInlineStart: 10,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'var(--bld-accent)',
                  color: 'var(--bld-accent-ink)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  verticalAlign: 'middle',
                  fontWeight: 600,
                }}
              >
                Current
              </span>
            ) : null}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              color: 'var(--bld-text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {focusedPreset.description}
          </span>
        </div>
        <button
          type="button"
          onClick={handleUse}
          disabled={ctaDisabled}
          style={{
            padding: '10px 18px',
            borderRadius: 6,
            border: `1px solid ${
              !focusedUnlocked
                ? 'var(--bld-accent)'
                : isCurrent
                  ? 'var(--bld-input-border)'
                  : 'var(--bld-accent)'
            }`,
            background: !focusedUnlocked
              ? 'var(--bld-accent)'
              : isCurrent
                ? 'transparent'
                : 'var(--bld-accent)',
            color: !focusedUnlocked
              ? 'var(--bld-accent-ink)'
              : isCurrent
                ? 'var(--bld-text-muted)'
                : 'var(--bld-accent-ink)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: ctaDisabled ? 'default' : 'pointer',
            opacity: ctaDisabled ? 0.7 : 1,
            fontWeight: 600,
          }}
        >
          {ctaLabel}
        </button>
      </footer>
    </motion.div>
  );
}

function renderRow(
  id: TemplateId,
  currentPlan: Plan,
  focused: TemplateId,
  activeTemplate: TemplateId,
  pendingTemplate: TemplateId | null,
  isRtl: boolean,
  onSelect: (id: TemplateId) => void,
) {
  const preset = templatePresets[id];
  const unlocked = planAtLeast(currentPlan, preset.tier);
  const isFocused = id === focused;
  const isActive = id === activeTemplate;
  const isPending = id === pendingTemplate && !isActive;
  const [latin] = preset.label.split('·').map((s) => s.trim());
  return (
    <motion.button
      key={id}
      type="button"
      data-template-row={id}
      onClick={() => onSelect(id)}
      aria-current={isFocused ? 'true' : undefined}
      animate={!unlocked ? { y: [0, -2, 0] } : undefined}
      transition={!unlocked ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: 10,
        padding: '10px 10px',
        background: isFocused
          ? 'var(--bld-accent-soft)'
          : isPending
            ? 'var(--bld-accent-softer)'
            : 'transparent',
        border: `1px solid ${
          !unlocked
            ? 'var(--bld-accent-line)'
            : isFocused
              ? 'var(--bld-accent-line)'
              : 'transparent'
        }`,
        borderRadius: 6,
        cursor: 'pointer',
        textAlign: 'start',
        color: 'var(--bld-input-text)',
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-flex',
          borderRadius: 4,
          overflow: 'hidden',
          border: '1px solid var(--bld-divider)',
          flexShrink: 0,
        }}
      >
        <TemplatePreview
          templateId={id}
          paletteId={preset.palette}
          variant="rail"
          locale={isRtl ? 'ar' : 'en'}
          dimmed={!unlocked}
        />
      </span>
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 13,
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {latin ?? id}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--bld-text-faint)',
          }}
        >
          {PLAN_LIMITS[preset.tier].label}
        </span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {!unlocked ? (
          <span
            style={{
              padding: '2px 6px',
              borderRadius: 999,
              background: 'var(--bld-accent-soft)',
              border: '1px solid var(--bld-accent-line)',
              color: 'var(--bld-accent)',
              fontFamily: 'var(--font-mono)',
              fontSize: 8,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            Upgrade
          </span>
        ) : null}
        {!unlocked ? (
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--bld-accent)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-label="Locked — requires plan upgrade"
          >
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 1 1 8 0v4" />
          </svg>
        ) : null}
        {isActive ? (
          <span
            style={{
              padding: '2px 6px',
              borderRadius: 999,
              background: 'var(--bld-accent)',
              color: 'var(--bld-accent-ink)',
              fontFamily: 'var(--font-mono)',
              fontSize: 8,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Current
          </span>
        ) : null}
      </span>
    </motion.button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '8px 10px 4px',
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--bld-text-faint)',
      }}
    >
      {children}
    </div>
  );
}

function ArrowButton({
  direction,
  isRtl,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next';
  isRtl: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  // Arrow points the visual direction. RTL flips the chevron so "next"
  // (advance forward through the list) still reads correctly.
  const points =
    (direction === 'next') !== isRtl
      ? '9 18 15 12 9 6'
      : '15 18 9 12 15 6';
  const label = direction === 'next' ? 'Next template' : 'Previous template';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        width: 36,
        height: 36,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        borderRadius: 6,
        border: '1px solid var(--bld-input-border)',
        background: 'var(--bld-input-bg)',
        color: disabled ? 'var(--bld-text-faint)' : 'var(--bld-input-text)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <polyline points={points} />
      </svg>
    </button>
  );
}
