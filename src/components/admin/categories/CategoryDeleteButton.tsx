'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/admin/Modal';
import { deleteCategory } from '@/app/actions/categories';

/**
 * Two-step delete affordance for a category. Opens a small confirm
 * modal so the founder doesn't lose work to an accidental click. The
 * server cascade unlinks every product in the category, but the
 * products themselves are not deleted.
 */
export function CategoryDeleteButton({
  storefrontSlug,
  categoryId,
  categoryName,
  productCount,
}: {
  storefrontSlug: string;
  categoryId: string;
  categoryName: string;
  productCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteCategory({
        storefrontSlug,
        id: categoryId,
      });
      if (result.status === 'error') {
        setError(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '6px 12px',
          border: '1px solid var(--surface-rule-strong)',
          borderRadius: 999,
          color: 'var(--ink-muted)',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        Delete
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Delete “${categoryName}”?`}
        subtitle={
          productCount === 0
            ? 'No products are linked to this category.'
            : `${productCount} product${productCount === 1 ? '' : 's'} will be unlinked. The products themselves stay in your catalogue.`
        }
        size="sm"
        dismissOnBackdrop={false}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={ghostButton}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              style={{
                ...dangerButton,
                opacity: pending ? 0.55 : 1,
                cursor: pending ? 'default' : 'pointer',
              }}
            >
              {pending ? 'Deleting…' : 'Delete category'}
            </button>
          </>
        }
      >
        {error ? (
          <p
            role="alert"
            style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: '#f1b1a1',
              letterSpacing: '0.03em',
            }}
          >
            {error}
          </p>
        ) : (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--ink-muted)',
              lineHeight: 1.55,
            }}
          >
            This action can&rsquo;t be undone.
          </p>
        )}
      </Modal>
    </>
  );
}

const ghostButton: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 999,
  border: '1px solid var(--surface-rule-strong)',
  background: 'transparent',
  color: 'var(--ink-strong)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  letterSpacing: '0.04em',
  cursor: 'pointer',
};

const dangerButton: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 999,
  border: 'none',
  background: 'var(--accent)',
  color: 'var(--ink-on-accent)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  letterSpacing: '0.04em',
  cursor: 'pointer',
};
