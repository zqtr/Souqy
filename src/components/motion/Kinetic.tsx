'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

type SplitMode = 'char' | 'word';

type Props = {
  text: string;
  /** ms before the first piece starts. */
  delay?: number;
  /** ms between consecutive pieces. */
  stagger?: number;
  /**
   * Latin scripts can split per character without losing shaping.
   * Arabic / Persian / Urdu etc. MUST split by word — chars connect.
   */
  splitBy?: SplitMode;
  className?: string;
  style?: CSSProperties;
};

type Mode = 'ssr' | 'plain' | 'animate';

/**
 * Per-piece reveal. Renders plain text during SSR and first client
 * paint so above-the-fold copy is never stranded at opacity:0 (the
 * framer-motion v11 SSR + animate-after-mount pattern is unreliable
 * in production). Only kinetic instances that mount below the fold
 * receive the motion treatment, animating in when scrolled to.
 */
export function Kinetic({
  text,
  delay = 0,
  stagger = 22,
  splitBy = 'char',
  className,
  style,
}: Props) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement | null>(null);
  const [mode, setMode] = useState<Mode>('ssr');

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      setMode('plain');
      return;
    }
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const inView = r.top < vh && r.bottom > 0;
    setMode(inView ? 'plain' : 'animate');
  }, []);

  if (reduced || mode !== 'animate') {
    return (
      <span ref={ref} className={className} style={{ display: 'inline-block', ...style }}>
        {text}
      </span>
    );
  }

  const pieces = splitBy === 'word' ? splitByWord(text) : Array.from(text);

  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        delayChildren: delay / 1000,
        staggerChildren: stagger / 1000,
      },
    },
  };

  const piece: Variants = {
    hidden: { y: '0.55em', opacity: 0, rotate: -2 },
    visible: {
      y: 0,
      opacity: 1,
      rotate: 0,
      transition: {
        y: { duration: 0.7, ease: [0.2, 0.7, 0.15, 1] },
        opacity: { duration: 0.5 },
        rotate: { duration: 0.7, ease: [0.2, 0.7, 0.15, 1] },
      },
    },
  };

  return (
    <motion.span
      ref={ref}
      className={className}
      style={{ display: 'inline-block', ...style }}
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      aria-label={text}
    >
      {pieces.map((p, i) => (
        <motion.span
          key={`${p}-${i}`}
          variants={piece}
          aria-hidden
          style={{
            display: 'inline-block',
            whiteSpace: p === ' ' ? 'pre' : 'normal',
            willChange: 'transform, opacity',
          }}
        >
          {p}
        </motion.span>
      ))}
    </motion.span>
  );
}

/**
 * Split on spaces but keep the trailing space attached to each word so
 * inline layout still wraps naturally.
 */
function splitByWord(text: string): string[] {
  const out: string[] = [];
  const matches = text.match(/\S+\s*/g);
  if (!matches) return [text];
  for (const m of matches) out.push(m);
  return out;
}
