'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  style?: CSSProperties;
  once?: boolean;
  /** Reserved for future use; currently has no effect. */
  eager?: boolean;
};

type Mode = 'ssr' | 'plain' | 'animate';

/**
 * Reveal-on-view wrapper. Renders plain content during SSR and first
 * client paint to avoid framer-motion v11 baking opacity:0 into the
 * markup (which strands content invisible if the post-hydration
 * variant swap fails). Only elements that mount BELOW the fold get
 * the motion treatment — they animate when the user scrolls to them.
 * Above-the-fold content is rendered visible immediately, no entry
 * animation, no risk of stuck hidden state.
 */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  style,
  once = true,
}: Props) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
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
      <div ref={ref} className={className} style={style}>
        {children}
      </div>
    );
  }

  const variants: Variants = {
    hidden: { opacity: 0, y, filter: 'blur(6px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: 0.9,
        ease: [0.2, 0.7, 0.15, 1],
        delay: delay / 1000,
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.15 }}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}
