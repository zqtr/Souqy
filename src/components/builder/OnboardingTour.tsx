'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const STORAGE_KEY = 'souqna:builder:tour-seen';
const REPLAY_EVENT = 'souqna:tour:replay';

type Step = {
  /** Short title rendered in the action bar. */
  title: string;
  /** One-line body rendered beneath the title. */
  body: string;
  /**
   * CSS selector for the element to spotlight. When omitted (or the
   * selector doesn't resolve at the time the step is shown), the action
   * bar still renders but no spotlight outline is drawn — the bar acts
   * as a centered intro / outro slide.
   */
  target?: string;
};

/**
 * 13-step builder onboarding (rewritten 2026-04 from the original
 * 4-step modal).
 *
 * The list below is the contract — each entry maps 1:1 to a concept the
 * founder needs to know about to drive the canvas. Anchors are addressed
 * via `data-tour="<id>"` attributes added directly to `BuilderShell.tsx`.
 * If a future refactor moves an anchor, update both sides here so the
 * spotlight still lands on the right region.
 */
const STEPS: Step[] = [
  {
    title: 'Welcome to your studio.',
    body: 'A short tour of the builder — 13 quick steps. Use ←/→ or Skip at any time.',
  },
  {
    title: 'Pages.',
    body: 'Each page in this list is a route on your storefront. Click to switch pages.',
    target: '[data-tour="pages-tab"]',
  },
  {
    title: 'Library.',
    body: 'Drag any block from here onto your page — heroes, galleries, product grids, more.',
    target: '[data-tour="library-tab"]',
  },
  {
    title: 'Outline.',
    body: 'See and reorder every block on this page. Handy for long, content-rich layouts.',
    target: '[data-tour="outline-tab"]',
  },
  {
    title: 'The canvas.',
    body: 'A live preview of your storefront. Click any block to start editing it.',
    target: '[data-tour="canvas"]',
  },
  {
    title: 'Selection toolbar.',
    body: 'Once a block is selected, this floating bar gives you quick actions.',
    target: '[data-tour="selection-toolbar"]',
  },
  {
    title: 'Block inspector.',
    body: 'Edit the selected block\u2019s content, layout, and imagery in this tab.',
    target: '[data-tour="inspector-block"]',
  },
  {
    title: 'Site inspector.',
    body: 'Theme, palette, and template controls live in the Site tab.',
    target: '[data-tour="inspector-site"]',
  },
  {
    title: 'Device toggle.',
    body: 'Preview at any breakpoint — desktop, tablet, or phone.',
    target: '[data-tour="device-toggle"]',
  },
  {
    title: 'Save state.',
    body: 'Edits save automatically. This chip tells you whether your draft is saved or live.',
    target: '[data-tour="save-chip"]',
  },
  {
    title: 'Publish.',
    body: 'Push your draft live in one click. You can always Discard to revert.',
    target: '[data-tour="publish"]',
  },
  {
    title: 'Command palette.',
    body: 'Hit \u2318K (Ctrl+K on Windows) any time to jump anywhere fast.',
    target: '[data-tour="cmdk-hint"]',
  },
  {
    title: 'You\u2019re ready.',
    body: 'Start with the hero — pick a block on the canvas and edit it on the right.',
  },
];

/**
 * Public hook so any caller (top-bar Replay button, command palette,
 * etc.) can re-fire the tour without importing this module's internals.
 * The replay path also clears the localStorage flag so the persistence
 * contract stays consistent.
 */
export function replayBuilderTour() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort
  }
  window.dispatchEvent(new CustomEvent(REPLAY_EVENT));
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);
  return reduced;
}

/**
 * Track a target element's bounding rect across scroll, resize, and
 * step changes. Recomputes on a 250ms safety interval to catch layout
 * shifts the resize/scroll listeners miss (e.g. an inspector panel
 * collapsing). Returns null when no target is set or the element isn't
 * mounted yet — callers should treat that as "no spotlight, just the
 * action bar".
 */
function useTargetRect(target: string | undefined, open: boolean): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!open || !target || typeof window === 'undefined') {
      setRect(null);
      return;
    }
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const el = document.querySelector(target) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      const next = el.getBoundingClientRect();
      // Skip rerenders when the rect hasn't moved enough to matter.
      setRect((prev) => {
        if (
          prev &&
          Math.abs(prev.x - next.x) < 0.5 &&
          Math.abs(prev.y - next.y) < 0.5 &&
          Math.abs(prev.width - next.width) < 0.5 &&
          Math.abs(prev.height - next.height) < 0.5
        ) {
          return prev;
        }
        return next;
      });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const id = window.setInterval(measure, 250);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      window.clearInterval(id);
    };
  }, [target, open]);
  return rect;
}

/**
 * Builder tour. Replaces the legacy center-screen modal with a bottom
 * action bar that walks the founder through 13 specific concepts and
 * spotlights the matching DOM region.
 *
 * Persistence contract: completion (Skip OR finishing the last step)
 * sets `localStorage['souqna:builder:tour-seen'] = '1'`. The key has
 * NOT changed from the legacy 4-step tour so existing founders who
 * already dismissed it will not see the new tour automatically — only
 * via the explicit Replay control in the top bar (or
 * `replayBuilderTour()` from anywhere else).
 */
export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const reduced = usePrefersReducedMotion();

  const current = STEPS[step];
  const rect = useTargetRect(current?.target, open);
  const barRef = useRef<HTMLDivElement | null>(null);
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);

  // Initial open: respect the persisted flag.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY) !== '1') {
        setOpen(true);
      }
    } catch {
      // private mode / quota — silently skip the tour
    }
  }, []);

  // Listen for the explicit Replay event from the top bar (or
  // `replayBuilderTour()` from elsewhere).
  useEffect(() => {
    const handler = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(REPLAY_EVENT, handler);
    return () => window.removeEventListener(REPLAY_EVENT, handler);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // best-effort
    }
  }, []);

  const next = useCallback(() => {
    setStep((s) => (s + 1 >= STEPS.length ? s : s + 1));
  }, []);

  const back = useCallback(() => {
    setStep((s) => (s > 0 ? s - 1 : 0));
  }, []);

  const finalStep = step + 1 >= STEPS.length;

  // Keyboard: Esc closes, Right/Left navigate. We also trap focus in the
  // bar so screen-reader / keyboard users can move through controls
  // cleanly. The trap is constrained to the bar itself; the spotlight
  // overlay is `aria-hidden`.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (finalStep) close();
        else next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      } else if (e.key === 'Tab' && barRef.current) {
        const focusables = Array.from(
          barRef.current.querySelectorAll<HTMLElement>(
            'button, a, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute('disabled'));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !barRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, finalStep, next, back, close]);

  // On step change, send focus to the Next / Start-building button so
  // keyboard users can keep advancing without re-tabbing.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => nextBtnRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [step, open]);

  // Memoised spotlight box — the cutout in the dim overlay AND the glow
  // border share these coordinates. ~10px of breathing room around the
  // target keeps small icon buttons (replay, cmdK hint) from touching
  // the spotlight edge.
  const spot = useMemo(() => {
    if (!rect) return null;
    const pad = 10;
    return {
      x: Math.max(0, rect.x - pad),
      y: Math.max(0, rect.y - pad),
      w: rect.width + pad * 2,
      h: rect.height + pad * 2,
    };
  }, [rect]);

  if (!open || !current) return null;

  const transition = reduced ? undefined : 'inset 200ms ease, opacity 200ms ease';

  return (
    <div
      role="region"
      aria-label="Builder tour"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none' }}
    >
      {/* Dim overlay with optional cutout. Pointer-events: auto so a
          stray click anywhere outside the bar (including over the
          highlighted target) is a safe no-op rather than firing a real
          builder action. */}
      <svg
        aria-hidden
        width="100%"
        height="100%"
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'auto',
        }}
      >
        <defs>
          <mask id="souqna-tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spot ? (
              <rect
                x={spot.x}
                y={spot.y}
                width={spot.w}
                height={spot.h}
                rx="10"
                ry="10"
                fill="black"
              />
            ) : null}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(8,5,3,0.62)"
          mask="url(#souqna-tour-mask)"
        />
      </svg>

      {/* Decorative glow ring drawn over the target so it reads as
          "this is what we're talking about". Pointer-events: none so it
          never swallows clicks on the bar or interferes with the dim
          overlay's no-op behaviour. */}
      {spot ? (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            top: spot.y,
            insetInlineStart: spot.x,
            width: spot.w,
            height: spot.h,
            borderRadius: 10,
            pointerEvents: 'none',
            border: '1px solid var(--bld-accent)',
            boxShadow: '0 0 0 4px var(--bld-accent-soft), 0 0 24px 4px var(--bld-accent-line)',
            transition,
          }}
        />
      ) : null}

      {/* Bottom-pinned action bar. ~640px wide, dark glass surface
          matching the builder palette. Skip on inline-start, Next on
          inline-end so RTL parity falls out for free. */}
      <div
        ref={barRef}
        role="group"
        aria-label="Tour controls"
        style={{
          position: 'fixed',
          bottom: 'clamp(16px, 3vh, 28px)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(640px, calc(100vw - 32px))',
          background: 'rgba(20,17,13,0.96)',
          color: 'var(--color-sand-pale)',
          border: '1px solid var(--bld-accent-line)',
          borderRadius: 12,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          padding: 'clamp(14px, 2vw, 18px)',
          backdropFilter: 'blur(10px)',
          pointerEvents: 'auto',
          animation: reduced ? undefined : 'souqna-tour-bar-in 240ms ease both',
        }}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
@keyframes souqna-tour-bar-in {
  from { opacity: 0; transform: translate(-50%, 12px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}`,
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.16em',
              color: 'var(--bld-accent)',
              textTransform: 'uppercase',
            }}
          >
            ◈ Step {step + 1} of {STEPS.length}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              color: 'rgba(232,220,196,0.45)',
              textTransform: 'uppercase',
            }}
          >
            ⌘ Builder tour
          </span>
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-serif), serif',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(18px, 2.4vw, 22px)',
            lineHeight: 1.2,
            margin: '0 0 4px',
          }}
        >
          {current.title}
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            lineHeight: 1.55,
            color: 'rgba(232,220,196,0.78)',
            margin: 0,
          }}
        >
          {current.body}
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 14,
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={close}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(232,220,196,0.6)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              padding: '6px 4px',
            }}
          >
            Skip
          </button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={back}
              disabled={step === 0}
              style={{
                background: 'transparent',
                border: 'none',
                color: step === 0 ? 'rgba(232,220,196,0.25)' : 'rgba(232,220,196,0.7)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: step === 0 ? 'default' : 'pointer',
                textDecoration: step === 0 ? 'none' : 'underline',
                textUnderlineOffset: 4,
                padding: '6px 4px',
              }}
            >
              Back
            </button>
            <button
              ref={nextBtnRef}
              type="button"
              onClick={() => (finalStep ? close() : next())}
              style={{
                background: 'var(--bld-accent)',
                color: 'var(--bld-accent-ink)',
                border: 'none',
                borderRadius: 999,
                padding: '8px 18px',
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {finalStep ? 'Start building →' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
