'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Iframe-side companion to BuilderShell. Mounted only inside
 * /account/[slug]/preview. Two responsibilities:
 *
 *   1. Reload the route when the parent posts `souqna:reload` so saved
 *      drafts show up without a full document reload.
 *   2. Map clicks on `[data-block-id]` elements to a `souqna:select`
 *      message back to the parent so the inspector follows the click.
 *   3. Visually highlight the currently-selected block when the parent
 *      posts `souqna:highlight`.
 */
export function PreviewBridge() {
  const router = useRouter();

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (ev.source && ev.source !== window.parent && ev.origin !== window.location.origin) return;
      const data = ev.data as { type?: string; blockId?: string | null } | null;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'souqna:reload') {
        router.refresh();
      } else if (data.type === 'souqna:highlight') {
        applyHighlight(typeof data.blockId === 'string' ? data.blockId : null);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [router]);

  useEffect(() => {
    function onClick(ev: MouseEvent) {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      const node = target.closest<HTMLElement>('[data-block-id]');
      if (!node) return;
      const blockId = node.dataset.blockId;
      if (!blockId) return;
      ev.preventDefault();
      ev.stopPropagation();
      window.parent?.postMessage(
        { type: 'souqna:select', blockId },
        '*',
      );
      applyHighlight(blockId);
    }
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true } as never);
  }, []);

  return null;
}

function applyHighlight(blockId: string | null) {
  document.querySelectorAll<HTMLElement>('[data-block-id]').forEach((el) => {
    if (el.dataset.blockId === blockId) {
      el.style.outline = '2px solid #E8DCC4';
      el.style.outlineOffset = '4px';
      el.style.cursor = 'pointer';
    } else {
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.cursor = 'pointer';
    }
  });
}
