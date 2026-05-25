import type { Copy } from '@/content/copy';

type Props = {
  copy: Copy;
  bilingualFraming: string;
};

/**
 * Top editorial rail: framing + established (left) and the QNV 2030
 * pulse (right). Mono 11px throughout.
 */
export function HeroTopRail({ copy, bilingualFraming }: Props) {
  return (
    <div className="relative z-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 font-mono text-[11px] tracking-[0.02em] text-[color:var(--ink-faint)] pt-12 pb-[10vh]">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
        <span>{bilingualFraming}</span>
        <span aria-hidden className="opacity-40">·</span>
        <span>{copy.meta.established}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-gold)]"
            style={{ boxShadow: '0 0 12px var(--color-gold)' }}
          />
          {copy.meta.vision}
        </span>
      </div>
    </div>
  );
}
