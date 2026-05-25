'use client';

import { useEffect } from 'react';

export function PrintControls() {
  return (
    <div className="controls">
      <button type="button" onClick={() => window.print()}>
        Print
      </button>
      <span style={{ marginInlineStart: 12, fontSize: 10, color: '#71717a' }}>
        Use your browser&apos;s &ldquo;Save as PDF&rdquo; to export.
      </span>
    </div>
  );
}

export function PrintAutoTrigger() {
  useEffect(() => {
    const id = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
