'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { SouqyLogo } from '../admin/SouqyLogo';
import { useBuilderCopy } from './BuilderCopyContext';

/**
 * Floating selection toolbar — Shopify-style action rail that appears
 * whenever a block is selected in the builder. Replaces the inline accent
 * breadcrumb so move/duplicate/edit/delete are always one tap away,
 * even on phones where the right inspector is hidden behind a drawer.
 *
 * Two modes:
 *
 *   • `idle`   — the original action rail (move / duplicate / edit /
 *     delete) plus a Souqy star button at the end when AI editing is
 *     available for the founder's plan.
 *   • `prompt` / `loading` / `error` — Souqy "AI mode": the icon rail
 *     collapses behind a back chevron and a glowing inline input slides
 *     in. The founder types a natural-language change ("make the
 *     headline larger", "use a darker background") and a shimmer
 *     covers the latency until the patched block lands.
 *
 * Positioning lives in the parent (sticky inside the canvas on desktop,
 * fixed to the viewport on mobile) — this component just renders the pill.
 */
export type SouqyEditResult =
  | { ok: true }
  | { ok: false; message: string; refused?: boolean };

export type SelectionToolbarProps = {
  /** Friendly block-type name, e.g. "Hero". */
  blockLabel: string;
  /** 1-based index in the page (rendered zero-padded as "01"). */
  blockIndex: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  /**
   * Toggles the inspector. On desktop the right rail is already inline
   * so this is effectively a no-op the parent can ignore; on mobile it
   * opens the right drawer so the founder can edit content.
   */
  onEdit: () => void;
  onDelete: () => void;
  /** Optional status snippet shown next to the block label ("saved 4s ago"). */
  status?: string;
  /**
   * Souqy availability. When false the toolbar renders a locked AI
   * affordance that routes the founder to the plan upgrade surface.
   */
  souqyEnabled?: boolean;
  /** Billing page used by the locked Souqy affordance for non-Pro founders. */
  souqyUpgradeHref?: string;
  /**
   * Async edit callback. The parent runs the server action and either
   * returns `{ ok: true }` (state already updated) or
   * `{ ok: false, message, refused? }` so the toolbar can render a
   * tailored error / refusal line. Required when `souqyEnabled` is true.
   */
  onSouqyEdit?: (request: string) => Promise<SouqyEditResult>;
};

type Mode = 'idle' | 'prompt' | 'loading' | 'error' | 'upgrade';
type PromptMode = Exclude<Mode, 'idle' | 'upgrade'>;
type SouqySuggestion = { label: string; prompt: string; lang: 'en' | 'ar' };
type CopySuggestion = { label: string; prompt: string; lang: string };

export function SelectionToolbar({
  blockLabel,
  blockIndex,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onEdit,
  onDelete,
  status,
  souqyEnabled = false,
  souqyUpgradeHref = '/account/settings/plan?feature=souqy',
  onSouqyEdit,
}: SelectionToolbarProps) {
  const { builder: copy } = useBuilderCopy();
  const toolbarCopy = copy.selectionToolbar;
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [request, setRequest] = useState('');
  const [lastError, setLastError] = useState<{ message: string; refused: boolean } | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState('');
  const [suggestions, setSuggestions] = useState<SouqySuggestion[]>([]);

  // Reset Souqy state whenever the selection changes (the parent
  // remounts us via the block id, but we still defensively clear so a
  // stale prompt never bleeds across blocks).
  useEffect(() => {
    setMode('idle');
    setRequest('');
    setLastError(null);
    setLastSubmitted('');
    setSuggestions([]);
  }, [blockLabel, blockIndex]);

  // Autofocus the input when entering prompt mode and after a retry
  // so the founder can keep typing without grabbing the mouse.
  useEffect(() => {
    if (mode === 'prompt') {
      const id = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [mode]);

  const openSouqy = useCallback(() => {
    setSuggestions(pickSouqySuggestions(blockLabel, toolbarCopy.suggestions));
    setMode('prompt');
    setLastError(null);
  }, [blockLabel, toolbarCopy.suggestions]);

  const openUpgrade = useCallback(() => {
    setMode('upgrade');
    setRequest('');
    setLastError(null);
    setLastSubmitted('');
  }, []);

  const closeSouqy = useCallback(() => {
    setMode('idle');
    setRequest('');
    setLastError(null);
    setLastSubmitted('');
    setSuggestions([]);
  }, []);

  const submitSouqy = useCallback(async () => {
    const value = request.trim();
    if (!value || !onSouqyEdit) return;
    setLastSubmitted(value);
    setMode('loading');
    setLastError(null);
    try {
      const result = await onSouqyEdit(value);
      if (result.ok) {
        setMode('idle');
        setRequest('');
        setLastError(null);
        setLastSubmitted('');
      } else {
        setMode('error');
        setLastError({ message: result.message, refused: result.refused === true });
      }
    } catch (err) {
      setMode('error');
      setLastError({
        message: err instanceof Error ? err.message : toolbarCopy.fallbackError,
        refused: false,
      });
    }
  }, [onSouqyEdit, request, toolbarCopy.fallbackError]);

  const onFormSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      void submitSouqy();
    },
    [submitSouqy],
  );

  const onInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSouqy();
      }
    },
    [closeSouqy],
  );

  const showsAiSurface = mode !== 'idle';

  return (
    <div
      role="toolbar"
      aria-label={`${blockLabel} ${toolbarCopy.actionsAria}`}
      className={`souqna-selection-toolbar${showsAiSurface ? ' souqna-selection-toolbar--ai' : ''}`}
      data-mode={mode}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0,
        padding: 3,
        background: 'color-mix(in srgb, var(--bld-surface-strong) 94%, transparent)',
        border: '1px solid var(--bld-accent-line)',
        borderRadius: 999,
        boxShadow: showsAiSurface
          ? '0 12px 34px var(--bld-panel-shadow), 0 0 0 1px var(--bld-accent-line), 0 0 26px var(--bld-accent-soft)'
          : '0 12px 34px var(--bld-panel-shadow)',
        // Lift above iframe selection ring (z=1) and any sibling overlays.
        zIndex: 5,
        transition: 'box-shadow 200ms ease, padding 160ms ease',
        animation: mode === 'loading' ? 'souqna-toolbar-pulse 1.6s ease-in-out infinite' : undefined,
        maxWidth: showsAiSurface ? 'min(500px, calc(100vw - 24px))' : undefined,
      }}
    >
      <SouqyStyles />

      {showsAiSurface ? (
        <BackButton onClick={closeSouqy} ariaLabel={toolbarCopy.exitSouqy} />
      ) : null}

      <span
        className="souqna-selection-toolbar__pill"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: showsAiSurface ? '5px 8px' : '5px 10px',
          marginInlineStart: showsAiSurface ? 4 : 0,
          marginInlineEnd: 4,
          background: 'var(--bld-accent)',
          color: 'var(--bld-accent-ink)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          borderRadius: 999,
          maxWidth: showsAiSurface ? 104 : 220,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          flexShrink: 0,
        }}
      >
        <span className="souqna-selection-toolbar__index" aria-hidden style={{ opacity: 0.6 }}>
          {String(blockIndex).padStart(2, '0')}
        </span>
        <span className="souqna-selection-toolbar__sep" aria-hidden style={{ opacity: 0.4 }}>·</span>
        <span className="souqna-selection-toolbar__label">{blockLabel}</span>
        {status && !showsAiSurface ? (
          <>
            <span className="souqna-selection-toolbar__status-sep" aria-hidden style={{ opacity: 0.4 }}>·</span>
            <span className="souqna-selection-toolbar__status" style={{ opacity: 0.7 }}>{status}</span>
          </>
        ) : null}
      </span>

      {showsAiSurface ? (
        mode === 'upgrade' ? (
          <SouqyUpgradeSurface href={souqyUpgradeHref} />
        ) : (
          <SouqyPromptSurface
            mode={mode}
            inputId={inputId}
            inputRef={inputRef}
            request={request}
            setRequest={setRequest}
            suggestions={suggestions}
            onSubmit={onFormSubmit}
            onKeyDown={onInputKeyDown}
            blockLabel={blockLabel}
            lastError={lastError}
            lastSubmitted={lastSubmitted}
            onRetry={() => setMode('prompt')}
            onDismiss={closeSouqy}
          />
        )
      ) : (
        <>
          <Separator />
          <ToolButton
            onClick={onMoveUp}
            disabled={!canMoveUp}
            title={toolbarCopy.moveUp}
            ariaLabel={`${toolbarCopy.moveUp} ${blockLabel}`}
          >
            <IconArrowUp />
          </ToolButton>
          <ToolButton
            onClick={onMoveDown}
            disabled={!canMoveDown}
            title={toolbarCopy.moveDown}
            ariaLabel={`${toolbarCopy.moveDown} ${blockLabel}`}
          >
            <IconArrowDown />
          </ToolButton>

          <Separator />
          <ToolButton
            onClick={onDuplicate}
            title={toolbarCopy.duplicate}
            ariaLabel={`${toolbarCopy.duplicate} ${blockLabel}`}
          >
            <IconDuplicate />
          </ToolButton>

          <Separator />
          <ToolButton
            onClick={onEdit}
            title={toolbarCopy.edit}
            ariaLabel={`${toolbarCopy.edit} ${blockLabel}`}
            // Edit is the secondary CTA on mobile — the only entry point to
            // the inspector when the right rail is collapsed. Keep it visible
            // at every breakpoint so muscle memory doesn't break on resize.
            className="souqna-selection-toolbar__edit"
          >
            <IconPencil />
          </ToolButton>

          <Separator />
          <ToolButton
            onClick={onDelete}
            title={toolbarCopy.delete}
            ariaLabel={`${toolbarCopy.delete} ${blockLabel}`}
            danger
          >
            <IconTrash />
          </ToolButton>

          {souqyEnabled && onSouqyEdit ? (
            <>
              <Separator />
              <SouqyStarButton onClick={openSouqy} />
            </>
          ) : (
            <>
              <Separator />
              <SouqyLockedButton onClick={openUpgrade} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function SouqyPromptSurface({
  mode,
  inputId,
  inputRef,
  request,
  setRequest,
  suggestions,
  onSubmit,
  onKeyDown,
  blockLabel,
  lastError,
  lastSubmitted,
  onRetry,
  onDismiss,
}: {
  mode: PromptMode;
  inputId: string;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  request: string;
  setRequest: (v: string) => void;
  suggestions: SouqySuggestion[];
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  blockLabel: string;
  lastError: { message: string; refused: boolean } | null;
  lastSubmitted: string;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const { builder: copy } = useBuilderCopy();
  const toolbarCopy = copy.selectionToolbar;
  const isLoading = mode === 'loading';
  const isError = mode === 'error';
  const labelSuffix = toolbarCopy.promptLabelSuffix
    ? ` ${toolbarCopy.promptLabelSuffix}`
    : '';

  return (
    <form
      onSubmit={onSubmit}
      className="souqna-souqy-form"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        flex: 1,
        minWidth: 0,
        gap: 4,
        position: 'relative',
        paddingInlineStart: 4,
        paddingInlineEnd: 2,
      }}
    >
      <label htmlFor={inputId} className="souqna-visually-hidden" style={visuallyHidden}>
        {`${toolbarCopy.promptLabelPrefix} ${blockLabel}${labelSuffix}`}
      </label>
      <div
        style={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          minWidth: 0,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 26,
            height: 26,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto',
          }}
        >
          <SouqyLogo size={22} />
        </span>
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          dir="auto"
          value={isLoading ? lastSubmitted : request}
          onChange={(e) => setRequest(e.target.value)}
          onKeyDown={onKeyDown}
          readOnly={isLoading}
          disabled={isLoading}
          placeholder={
            isError
              ? lastError?.message ?? toolbarCopy.errorPlaceholder
              : toolbarCopy.placeholder
          }
          maxLength={400}
          aria-busy={isLoading}
          style={{
            width: '100%',
            minWidth: 0,
            background: 'transparent',
            color: 'var(--bld-text)',
            border: `1px solid ${
              isError ? '#E68A8A55' : isLoading ? 'var(--bld-accent-strong)' : 'var(--bld-accent-line)'
            }`,
            borderRadius: 999,
            padding: '7px 12px',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 12.5,
            outline: 'none',
            transition: 'border-color 160ms ease, box-shadow 160ms ease',
            boxShadow: isLoading ? '0 0 0 3px var(--bld-accent-soft)' : undefined,
          }}
        />
        {/* Shimmer bar pinned to the bottom of the input while loading. */}
        {isLoading ? (
          <span
            aria-hidden
            style={{
              position: 'absolute',
            insetInline: 10,
              bottom: 2,
              height: 2,
              borderRadius: 2,
              overflow: 'hidden',
              background: 'var(--bld-accent-softer)',
            }}
          >
            <span
              style={{
                display: 'block',
                width: '40%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, var(--bld-accent), var(--bld-text), transparent)',
                animation: 'souqna-shimmer 1.4s linear infinite',
              }}
            />
          </span>
        ) : null}
        {isLoading ? (
          <span
            aria-live="polite"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--bld-text-muted)',
              paddingInline: 4,
              whiteSpace: 'nowrap',
            }}
          >
            {toolbarCopy.editing}
          </span>
        ) : isError ? (
          <>
            <ToolButton
              onClick={onRetry}
              title={toolbarCopy.retry}
              ariaLabel={toolbarCopy.retryAria}
              className="souqna-souqy-retry"
            >
              <IconRetry />
            </ToolButton>
            <ToolButton
              onClick={onDismiss}
              title={toolbarCopy.dismiss}
              ariaLabel={toolbarCopy.dismissAria}
            >
              <IconClose />
            </ToolButton>
          </>
        ) : (
          <button
            type="submit"
            disabled={request.trim().length < 3}
            aria-label={toolbarCopy.send}
            title={toolbarCopy.sendTitle}
            className="souqna-souqy-send"
            style={{
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 999,
              background:
                request.trim().length < 3
                  ? 'var(--bld-accent-softer)'
                  : 'var(--bld-accent)',
              color: request.trim().length < 3 ? 'var(--bld-text-faint)' : 'var(--bld-accent-ink)',
              cursor: request.trim().length < 3 ? 'not-allowed' : 'pointer',
              transition: 'background 160ms ease, transform 160ms ease',
              flexShrink: 0,
            }}
          >
            <IconSparkleSolid />
          </button>
        )}
      </div>

      {!isLoading && !isError && suggestions.length > 0 ? (
        <div
          aria-label={toolbarCopy.suggestionsAria}
          style={{
            display: 'flex',
            gap: 5,
            flexWrap: 'wrap',
            paddingInlineEnd: 34,
          }}
        >
          {suggestions.map((suggestion) => (
            <button
              key={`${suggestion.lang}:${suggestion.prompt}`}
              type="button"
              onClick={() => {
                setRequest(suggestion.prompt);
                inputRef.current?.focus();
              }}
              title={suggestion.prompt}
              style={{
                border: '1px solid var(--bld-accent-line)',
                background: 'var(--bld-accent-softer)',
                color: 'var(--bld-text-muted)',
                borderRadius: 999,
                padding: '4px 8px',
                fontFamily:
                  suggestion.lang === 'ar'
                    ? 'var(--font-arabic), var(--font-arabic-serif), ui-serif, Georgia, serif'
                    : 'var(--font-mono)',
                fontSize: 9.5,
                lineHeight: 1.2,
                cursor: 'pointer',
                maxWidth: 190,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
}

function SouqyStarButton({ onClick }: { onClick: () => void }) {
  const { builder: copy } = useBuilderCopy();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copy.selectionToolbar.askSouqy}
      title={copy.selectionToolbar.askSouqyTitle}
      className="souqna-souqy-star"
      data-tour="souqy-star"
      style={{
        width: 32,
        height: 32,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bld-surface-strong)',
        border: '1px solid var(--bld-accent-line)',
        borderRadius: 999,
        color: 'var(--bld-text)',
        cursor: 'pointer',
        flexShrink: 0,
        // Spec: thin animated gradient halo. The conic gradient lives
        // on the ::before pseudo (defined in <SouqyStyles/>), this
        // button is just the dark inner disc.
        zIndex: 0,
      }}
    >
      <SouqyLogo size={22} />
    </button>
  );
}

function SouqyLockedButton({ onClick }: { onClick: () => void }) {
  const { builder: copy } = useBuilderCopy();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copy.selectionToolbar.upgradeSouqy}
      title={copy.selectionToolbar.upgradeSouqyTitle}
      className="souqna-souqy-star souqna-souqy-star--locked"
      data-tour="souqy-upgrade"
      style={{
        width: 32,
        height: 32,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bld-accent-soft)',
        border: '1px solid var(--bld-accent-line)',
        borderRadius: 999,
        color: 'var(--bld-text-muted)',
        cursor: 'pointer',
        flexShrink: 0,
        zIndex: 0,
      }}
    >
      <SouqyLogo size={20} />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          insetInlineEnd: -2,
          insetBlockEnd: -2,
          width: 13,
          height: 13,
          borderRadius: '50%',
          background: 'var(--bld-accent)',
          color: 'var(--bld-accent-ink)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 8,
          fontWeight: 700,
        }}
      >
        +
      </span>
    </button>
  );
}

function SouqyUpgradeSurface({ href }: { href: string }) {
  const { builder: copy } = useBuilderCopy();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingInline: 6,
        minWidth: 0,
      }}
    >
      <span
        style={{
          color: 'var(--bld-text-muted)',
          fontFamily: 'var(--font-serif)',
          fontSize: 13,
          fontStyle: 'italic',
          whiteSpace: 'nowrap',
        }}
      >
        {copy.selectionToolbar.upgradeMessage}
      </span>
      <a
        href={href}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          padding: '7px 10px',
          background: 'var(--bld-accent)',
          color: 'var(--bld-accent-ink)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {copy.selectionToolbar.upgrade}
      </a>
    </div>
  );
}

function BackButton({ onClick, ariaLabel }: { onClick: () => void; ariaLabel: string }) {
  const { builder: copy } = useBuilderCopy();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={copy.selectionToolbar.exitSouqy}
      style={{
        width: 32,
        height: 32,
        marginInlineStart: 2,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: 999,
        color: 'var(--bld-text-muted)',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <IconChevronStart />
    </button>
  );
}

/**
 * Single inline <style> element carrying the keyframes + the conic
 * gradient halo for the star button. Defined here (vs the global
 * stylesheet) so the toolbar is self-contained and the animation only
 * lives on the page when the toolbar mounts.
 */
function SouqyStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
@keyframes souqna-souqy-spin {
  to { transform: rotate(360deg); }
}
@keyframes souqna-shimmer {
  from { transform: translateX(-100%); }
  to   { transform: translateX(350%); }
}
@keyframes souqna-toolbar-pulse {
  0%, 100% { box-shadow: 0 12px 34px var(--bld-panel-shadow), 0 0 0 1px var(--bld-accent-line), 0 0 20px var(--bld-accent-soft); }
  50%      { box-shadow: 0 14px 38px var(--bld-panel-shadow), 0 0 0 1px var(--bld-accent-strong), 0 0 34px var(--bld-accent-soft); }
}
.souqna-souqy-star {
  isolation: isolate;
}
.souqna-souqy-star::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 999px;
  padding: 2px;
  background: conic-gradient(from 0deg, var(--bld-accent-line), var(--bld-accent), var(--bld-text), var(--bld-accent-line));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  animation: souqna-souqy-spin 8s linear infinite;
  z-index: -1;
  opacity: 0.85;
  transition: opacity 200ms ease, filter 200ms ease;
}
.souqna-souqy-star:hover::before {
  opacity: 1;
  filter: drop-shadow(0 0 6px var(--bld-accent-line));
}
.souqna-souqy-star:focus-visible {
  outline: none;
}
.souqna-souqy-star:focus-visible::before {
  opacity: 1;
  filter: drop-shadow(0 0 8px var(--bld-accent-line));
}
.souqna-souqy-send:not(:disabled):hover {
  transform: scale(1.04);
}
@media (max-width: 767px) {
  .souqna-selection-toolbar[data-mode="idle"] {
    max-width: calc(100vw - 24px);
  }
  .souqna-selection-toolbar[data-mode="idle"] .souqna-selection-toolbar__pill {
    gap: 0 !important;
    margin-inline-end: 3px !important;
    max-width: none !important;
    padding: 6px 11px !important;
  }
  .souqna-selection-toolbar[data-mode="idle"] .souqna-selection-toolbar__index {
    opacity: 1 !important;
  }
  .souqna-selection-toolbar[data-mode="idle"] .souqna-selection-toolbar__sep,
  .souqna-selection-toolbar[data-mode="idle"] .souqna-selection-toolbar__label,
  .souqna-selection-toolbar[data-mode="idle"] .souqna-selection-toolbar__status-sep,
  .souqna-selection-toolbar[data-mode="idle"] .souqna-selection-toolbar__status {
    display: none !important;
  }
  .souqna-selection-toolbar[data-mode="idle"] button {
    min-width: 32px !important;
    width: 32px !important;
    height: 32px !important;
  }
}
@media (prefers-reduced-motion: reduce) {
  .souqna-souqy-star::before { animation: none; }
  .souqna-selection-toolbar[data-mode="loading"] { animation: none !important; }
  .souqna-selection-toolbar[data-mode="loading"] .souqna-souqy-form span span {
    animation: none !important;
  }
}
`,
      }}
    />
  );
}

function pickSouqySuggestions(
  blockLabel: string,
  copySuggestions: readonly CopySuggestion[],
): SouqySuggestion[] {
  const seed = blockLabel.length + Math.floor(Math.random() * 1000);
  const suggestions = copySuggestions.map((s) => ({
    label: s.label,
    prompt: s.prompt,
    lang: s.lang === 'ar' ? ('ar' as const) : ('en' as const),
  }));
  return pickFrom(suggestions, seed, Math.min(5, suggestions.length));
}

function pickFrom<T>(items: readonly T[], seed: number, count: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(items[(seed + i * 3) % items.length]!);
  }
  return out;
}

const visuallyHidden: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

function Separator() {
  return (
    <span
      aria-hidden
      style={{
        width: 1,
        height: 18,
        background: 'var(--bld-divider)',
        margin: '0 2px',
        flexShrink: 0,
      }}
    />
  );
}

function ToolButton({
  onClick,
  children,
  title,
  ariaLabel,
  disabled,
  danger,
  className,
}: {
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  ariaLabel: string;
  disabled?: boolean;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={className}
      style={{
        width: 32,
        height: 32,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: 999,
        color: disabled
          ? 'var(--bld-text-faint)'
          : danger
            ? '#E68A8A'
            : 'var(--bld-text-muted)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 120ms, color 120ms',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = danger
          ? 'rgba(230,138,138,0.18)'
          : 'var(--bld-accent-soft)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

function IconArrowUp() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 13V3" />
      <path d="M4 7l4-4 4 4" />
    </svg>
  );
}

function IconArrowDown() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v10" />
      <path d="M4 9l4 4 4-4" />
    </svg>
  );
}

function IconDuplicate() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={3} width={8} height={8} rx={1.2} />
      <path d="M5 13h6.5A1.5 1.5 0 0 0 13 11.5V5" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 2.5l2 2L6 12l-3 1 1-3z" />
      <path d="M10 4l2 2" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h10" />
      <path d="M5.5 4V3a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 10.5 3v1" />
      <path d="M4.5 4l.7 8.2A1.5 1.5 0 0 0 6.7 13.5h2.6a1.5 1.5 0 0 0 1.5-1.3L11.5 4" />
      <path d="M7 7v4M9 7v4" />
    </svg>
  );
}

/** Filled variant for the active "send" button — same geometry, more weight. */
function IconSparkleSolid() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden fill="currentColor">
      <path d="M8 0.5 9.4 5.4a3.6 3.6 0 0 0 2.2 2.2L16.5 9l-4.9 1.4a3.6 3.6 0 0 0-2.2 2.2L8 17.5 6.6 12.6a3.6 3.6 0 0 0-2.2-2.2L-0.5 9l4.9-1.4a3.6 3.6 0 0 0 2.2-2.2z" />
    </svg>
  );
}

function IconRetry() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
      <path d="M13.5 2v3h-3" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <path d="M3.5 3.5l9 9" />
      <path d="M12.5 3.5l-9 9" />
    </svg>
  );
}

/**
 * Locale-aware "go back" chevron — flips automatically because the
 * parent toolbar inherits `dir` from the document, and SVG paths
 * inside a `dir=rtl` ancestor get visually mirrored by the inline
 * `[dir=rtl]` rule the public stylesheet already sets.
 *
 * Belt-and-braces: we render a left-pointing triangle and let CSS
 * logical positioning handle the rest of the alignment.
 */
function IconChevronStart() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13L5 8l5-5" />
    </svg>
  );
}
