'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type DeletedWebsitesToggleProps = {
  checked: boolean;
  deletedCount: number;
  visibleCount: number;
  totalCount: number;
};

export function DeletedWebsitesToggle({
  checked,
  deletedCount,
  visibleCount,
  totalCount,
}: DeletedWebsitesToggleProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasDeletedWebsites = deletedCount > 0;

  function handleToggle(nextChecked: boolean) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextChecked) {
      params.set('showDeleted', '1');
    } else {
      params.delete('showDeleted');
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        width: 'fit-content',
        minHeight: 42,
        marginBottom: 14,
        padding: '9px 12px',
        borderRadius: 8,
        border: '1px solid color-mix(in srgb, var(--ink-strong) 12%, transparent)',
        background: 'var(--surface-overlay)',
        color: 'var(--ink-strong)',
        cursor: hasDeletedWebsites ? 'pointer' : 'not-allowed',
        opacity: hasDeletedWebsites ? 1 : 0.62,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={!hasDeletedWebsites}
        aria-label="Show deleted websites"
        onChange={(event) => handleToggle(event.currentTarget.checked)}
        style={{
          width: 16,
          height: 16,
          margin: 0,
          accentColor: 'var(--color-maroon, #8b3a3a)',
          flex: '0 0 auto',
          cursor: hasDeletedWebsites ? 'pointer' : 'not-allowed',
        }}
      />
      <span style={{ display: 'grid', gap: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Show deleted websites</span>
        <span style={{ color: 'var(--ink-muted)', fontSize: 12 }}>
          {hasDeletedWebsites
            ? checked
              ? `Showing ${visibleCount} of ${totalCount} websites.`
              : `${deletedCount} deleted websites hidden.`
            : 'No deleted websites.'}
        </span>
      </span>
    </label>
  );
}
