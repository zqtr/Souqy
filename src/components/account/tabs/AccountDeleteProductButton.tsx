'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/locales';
import { deleteProduct } from '@/app/actions/products';

type Props = {
  slug: string;
  locale: Locale;
  productId: string;
  productTitle: string;
};

/**
 * Light-themed sibling of `<DeleteProductButton>` — same `deleteProduct`
 * server action, restyled for the sand `/account` surface (the dashboard
 * version is tuned for the dark Atelier chrome and reads pinkish on
 * light). Shows a native confirm dialog with the product title so the
 * founder can't fat-finger a delete on the wrong row.
 */
export function AccountDeleteProductButton({
  slug,
  locale,
  productId,
  productTitle,
}: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onClick() {
    if (pending) return;
    if (!window.confirm(`Delete "${productTitle}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteProduct({ slug, locale, id: productId });
      if (result.status === 'success') {
        router.refresh();
      } else if (result.status === 'error') {
        window.alert(result.message);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      style={{
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: '6px 10px',
        borderRadius: 999,
        border: '1px solid color-mix(in srgb, #b85c5c 35%, transparent)',
        background: 'transparent',
        color: pending ? 'color-mix(in srgb, #b85c5c 50%, transparent)' : '#b85c5c',
        cursor: pending ? 'default' : 'pointer',
        lineHeight: 1,
      }}
    >
      {pending ? 'Deleting…' : 'Delete'}
    </button>
  );
}
