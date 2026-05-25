'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { ProductForm } from '@/components/dashboard/ProductForm';
import type { Copy } from '@/content/copy';
import type { Locale } from '@/i18n/locales';
import type { Product } from '@/lib/products';
import type { Category } from '@/lib/categories';
import type { Plan } from '@/lib/plans';

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  storefrontSlug: string;
  storefrontName: string;
  locale: Locale;
  copy: Copy;
  initial?: Product;
  categories: Category[];
  initialCategoryIds: string[];
  currentPlan: Plan;
  closeHref: string;
};

export function ProductModal({
  open,
  mode,
  storefrontSlug,
  storefrontName,
  locale,
  copy,
  initial,
  categories,
  initialCategoryIds,
  currentPlan,
  closeHref,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        navigate(closeHref);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [closeHref, open]);

  if (!open) return null;

  const isRtl = locale === 'ar' || /[\u0600-\u06ff]/.test(copy.products.form.submit.create);
  const labels = isRtl
    ? {
        editMeta: 'تعديل منتج',
        newMeta: 'منتج جديد',
        title: 'أضف منتجاً',
        editDescription: 'حدّث الحقول واحفظ. تظهر التغييرات على المتجر مباشرة.',
        newDescription: 'املأ الأساسيات. تبقى المسودات مخفية حتى تغيّر الحالة إلى مباشر.',
        close: 'إغلاق',
      }
    : {
        editMeta: 'Edit product',
        newMeta: 'New product',
        title: 'Add a product',
        editDescription: 'Update fields and save. Changes appear on your storefront immediately.',
        newDescription: 'Fill in the basics. Drafts stay hidden until you flip status to Active.',
        close: 'Close',
      };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
      dir={isRtl ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) navigate(closeHref);
      }}
    >
      <section className="flex max-h-[min(92vh,820px)] w-full max-w-[min(960px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border bg-background shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b px-6 pb-4 pt-5 text-start">
          <div className="min-w-0">
            <p className="m-0 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {storefrontName} · {mode === 'edit' ? labels.editMeta : labels.newMeta}
            </p>
            <h2
              id="product-modal-title"
              className="mt-2 text-[22px] font-medium leading-tight tracking-tight"
            >
              {mode === 'edit' && initial ? initial.title : labels.title}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {mode === 'edit' ? labels.editDescription : labels.newDescription}
            </p>
          </div>
          <button
            type="button"
            aria-label={labels.close}
            onClick={() => navigate(closeHref)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <ProductForm
            mode={mode}
            storefrontSlug={storefrontSlug}
            locale={locale}
            copy={copy}
            initial={initial}
            categories={categories}
            initialCategoryIds={initialCategoryIds}
            currentPlan={currentPlan}
            noChrome
            onCancel={() => navigate(closeHref)}
            onSaved={() => navigate(closeHref)}
          />
        </div>
      </section>
    </div>
  );
}

function navigate(href: string) {
  window.location.assign(href);
}
