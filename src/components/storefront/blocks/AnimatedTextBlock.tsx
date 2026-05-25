'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { BlockRenderProps } from './BlockContext';
import type { AnimatedTextProps, TextEffect } from '@/lib/blocks/types';
import { Kinetic } from '@/components/motion/Kinetic';
import { TextEffectRenderer } from './TextEffectRenderer';

/**
 * Pro-tier animated text block. The effect catalogue:
 *
 *   - `reveal`     : staggered word-by-word fade-up (uses Kinetic).
 *   - `kinetic`    : per-character hop with rotation (Kinetic, char split).
 *   - `wave`       : continuous wave/oscillation across characters.
 *   - `typewriter` : terminal-style char-by-char reveal with caret.
 *   - `glitch`     : RGB-split flicker on hover + every few seconds.
 *
 * All effects respect `prefers-reduced-motion` and degrade to a static
 * render of the same copy. SSR returns plain text so above-the-fold
 * content is never stranded at opacity:0 (mirrors the Kinetic
 * primitive's SSR-safe pattern).
 */
export function AnimatedTextBlock({
  block,
}: BlockRenderProps<AnimatedTextProps>) {
  const props = block.props;
  // Direction is derived from the *text content*, not the page locale —
  // splitting an LTR English string into inline-blocks inside an RTL
  // parent reverses the visual word order ("A line that moves" → "moves
  // that line A"), and the inverse mangles Arabic letter joining.
  const textIsRtl = detectRtl(props.text);
  const fontFamily = textIsRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const serifFamily = textIsRtl ? 'var(--font-arabic-serif), serif' : 'var(--font-serif), serif';
  const align = props.align ?? 'center';
  const emphasis = props.emphasis ?? 'display';
  const textAlign = align === 'end' ? 'right' : align === 'center' ? 'center' : 'left';
  const speedMs =
    props.speed === 'fast' ? 14 : props.speed === 'slow' ? 50 : 28;

  const splitBy = textIsRtl ? 'word' : 'char';
  const dir = textIsRtl ? 'rtl' : 'ltr';

  return (
    <section
      dir={dir}
      style={{
        padding: 'clamp(28px, 4vw, 64px) 0',
        textAlign,
        fontFamily: emphasis === 'display' ? serifFamily : fontFamily,
      }}
    >
      {props.eyebrow ? (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--sf-accent)',
            marginBottom: 18,
          }}
        >
          {props.eyebrow}
        </div>
      ) : null}
      <Effect
        effect={props.effect}
        text={props.text}
        loop={props.loop}
        speedMs={speedMs}
        splitBy={splitBy}
        emphasis={emphasis}
        premiumEffect={block.style?.textEffect}
      />
    </section>
  );
}

// Strong-RTL ranges: Arabic, Hebrew, Syriac, Thaana, NKo. Matches if the
// first strong-direction character is RTL — same heuristic the Unicode
// bidi algorithm uses to seed paragraph direction.
const RTL_RANGE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFC]/;
function detectRtl(text: string): boolean {
  return RTL_RANGE.test(text);
}

function Effect({
  effect,
  text,
  loop,
  speedMs,
  splitBy,
  emphasis,
  premiumEffect,
}: {
  effect: AnimatedTextProps['effect'];
  text: string;
  loop?: boolean;
  speedMs: number;
  splitBy: 'char' | 'word';
  emphasis: 'display' | 'body';
  premiumEffect?: TextEffect;
}) {
  const fontStyle = emphasis === 'display' ? 'italic' : 'normal';
  const fontSize =
    emphasis === 'display'
      ? 'clamp(28px, 6vw, 80px)'
      : 'clamp(18px, 2.4vw, 28px)';
  const baseStyle: React.CSSProperties = {
    fontStyle,
    fontWeight: emphasis === 'display' ? 400 : 300,
    fontSize,
    lineHeight: 1.1,
    margin: 0,
    color: 'var(--sf-ink)',
  };

  if (premiumEffect && premiumEffect !== 'none') {
    return (
      <TextEffectRenderer as="h2" effect={premiumEffect} style={baseStyle}>
        {text}
      </TextEffectRenderer>
    );
  }

  if (effect === 'reveal' || effect === 'kinetic') {
    return (
      <h2 style={baseStyle}>
        <Kinetic
          text={text}
          stagger={effect === 'kinetic' ? speedMs * 0.7 : speedMs}
          splitBy={effect === 'kinetic' ? splitBy : 'word'}
        />
      </h2>
    );
  }
  if (effect === 'wave') {
    return (
      <Wave
        text={text}
        loop={loop}
        speedMs={speedMs}
        splitBy={splitBy}
        style={baseStyle}
      />
    );
  }
  if (effect === 'typewriter') {
    return (
      <Typewriter
        text={text}
        loop={loop}
        speedMs={speedMs}
        style={baseStyle}
      />
    );
  }
  if (effect === 'glitch') {
    return <Glitch text={text} loop={loop} style={baseStyle} />;
  }
  return <h2 style={baseStyle}>{text}</h2>;
}

function Wave({
  text,
  loop,
  speedMs,
  splitBy,
  style,
}: {
  text: string;
  loop?: boolean;
  speedMs: number;
  splitBy: 'char' | 'word';
  style: React.CSSProperties;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <h2 style={style}>{text}</h2>;
  // Arabic / Persian / Urdu must split by word — wrapping each character in
  // its own inline-block breaks letter-joining and visually inverts the run
  // because the bidi algorithm reorders the isolated boxes.
  const tokens =
    splitBy === 'word'
      ? text.split(/(\s+)/).filter((t) => t.length > 0)
      : Array.from(text);
  // Drive the wave with a CSS keyframe rather than framer-motion. With
  // `repeat: Infinity` framer drops the per-element `delay` on every
  // subsequent cycle, so the staggered phases collapse and individual
  // letters appear "frozen" when they happen to land on the rest frame.
  // A CSS animation with `animation-delay` keeps each letter's phase
  // stable for the lifetime of the element.
  const stagger = (speedMs / 1000) * 0.08;
  const animationName = 'souqna-wave-bounce';
  const iteration = loop !== false ? 'infinite' : '1';
  return (
    <>
      <style>{`
        @keyframes ${animationName} {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
      <h2 style={style} aria-label={text}>
        {tokens.map((token, i) => {
          const isWhitespace = /^\s+$/.test(token);
          return (
            <span
              key={`${i}-${token}`}
              aria-hidden
              style={{
                display: 'inline-block',
                whiteSpace: isWhitespace ? 'pre' : 'normal',
                animation: isWhitespace
                  ? undefined
                  : `${animationName} 1.4s ease-in-out ${i * stagger}s ${iteration} both`,
              }}
            >
              {token}
            </span>
          );
        })}
      </h2>
    </>
  );
}

function Typewriter({
  text,
  loop,
  speedMs,
  style,
}: {
  text: string;
  loop?: boolean;
  speedMs: number;
  style: React.CSSProperties;
}) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? text.length : 0);
  const dirRef = useRef<1 | -1>(1);

  useEffect(() => {
    if (reduced) return;
    const t = window.setInterval(() => {
      setN((prev) => {
        const next = prev + dirRef.current;
        if (next >= text.length) {
          if (!loop) {
            window.clearInterval(t);
            return text.length;
          }
          dirRef.current = -1;
          return prev;
        }
        if (next < 0) {
          dirRef.current = 1;
          return 0;
        }
        return next;
      });
    }, speedMs);
    return () => window.clearInterval(t);
  }, [reduced, text, speedMs, loop]);

  return (
    <h2 style={style} aria-label={text}>
      <span aria-hidden>{text.slice(0, n)}</span>
      <motion.span
        aria-hidden
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{ display: 'inline-block', marginInlineStart: 4, color: 'var(--sf-accent)' }}
      >
        |
      </motion.span>
    </h2>
  );
}

function Glitch({
  text,
  loop,
  style,
}: {
  text: string;
  loop?: boolean;
  style: React.CSSProperties;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <h2 style={style}>{text}</h2>;
  return (
    <h2
      style={{ ...style, position: 'relative', display: 'inline-block' }}
      aria-label={text}
    >
      <span style={{ position: 'relative', zIndex: 1 }}>{text}</span>
      <motion.span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          color: 'var(--sf-accent)',
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
        animate={{ x: [0, -2, 2, 0], opacity: [0.6, 0.9, 0.4, 0.7] }}
        transition={{
          duration: 0.18,
          repeat: loop !== false ? Infinity : 0,
          repeatDelay: 2.2,
          ease: 'linear',
        }}
      >
        {text}
      </motion.span>
      <motion.span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          color: 'rgba(120, 60, 60, 0.85)',
          mixBlendMode: 'multiply',
          pointerEvents: 'none',
        }}
        animate={{ x: [0, 2, -2, 0] }}
        transition={{
          duration: 0.18,
          repeat: loop !== false ? Infinity : 0,
          repeatDelay: 2.2,
          ease: 'linear',
        }}
      >
        {text}
      </motion.span>
    </h2>
  );
}
