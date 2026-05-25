import type { ReactNode } from 'react';

type Tone = 'maroon' | 'gold';

type Props = {
  children: ReactNode;
  tone?: Tone;
  className?: string;
};

const toneClass: Record<Tone, string> = {
  maroon: 'text-[color:var(--color-maroon)] before:bg-[color:var(--color-maroon)]',
  gold: 'text-[color:var(--color-gold)] before:bg-[color:var(--color-gold)]',
};

/**
 * Editorial eyebrow: mono 11px, uppercase, prefixed by a 24×1px rule.
 * The rule shifts to a trailing rule in RTL so it always reads outward
 * from the start of the heading.
 */
export function Eyebrow({ children, tone = 'maroon', className = '' }: Props) {
  return (
    <div
      className={`flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.12em] ${toneClass[tone]} before:block before:h-px before:w-6 before:content-[''] ${className}`}
    >
      <span>{children}</span>
    </div>
  );
}
