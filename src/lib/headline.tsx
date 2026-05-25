import type { CSSProperties, ReactNode } from 'react';

/**
 * Render a headline string that uses {italic}…{/italic} markers.
 *
 *   parseHeadline('Four pillars. {italic}One vision.{/italic} A console.')
 *
 * yields three nodes: the lead text, an italicised emphatic span, and
 * the trailing text. The italic span can be re-styled via accentStyle.
 *
 * Falls back to the raw string if no markers are found.
 */
const ITALIC_RE = /\{italic\}([\s\S]*?)\{\/italic\}/g;

type Options = {
  accentStyle?: CSSProperties;
  accentClassName?: string;
};

export function parseHeadline(text: string, opts: Options = {}): ReactNode {
  if (!text.includes('{italic}')) return text;

  const out: ReactNode[] = [];
  let lastIndex = 0;
  let i = 0;
  ITALIC_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ITALIC_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push(<span key={`t-${i}`}>{text.slice(lastIndex, match.index)}</span>);
    }
    out.push(
      <span key={`i-${i}`} className={opts.accentClassName} style={opts.accentStyle}>
        {match[1]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
    i += 1;
  }
  if (lastIndex < text.length) {
    out.push(<span key={`t-${i}`}>{text.slice(lastIndex)}</span>);
  }
  return out;
}
