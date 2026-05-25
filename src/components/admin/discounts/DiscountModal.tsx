'use client';

import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { DiscountForm } from './DiscountForm';

type Props = {
  open: boolean;
  storefrontSlug: string;
  /** URL the sheet returns to when closed (preserves filters). */
  closeHref: string;
};

/**
 * URL-driven sheet host for `DiscountForm`. The form's internal
 * router.push after save naturally tears down this listing → so we
 * don't need to intercept onSuccess; closing simply replaces back.
 */
export function DiscountModal({ open, storefrontSlug, closeHref }: Props) {
  const router = useRouter();
  function close() {
    router.replace(closeHref, { scroll: false });
  }
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[min(900px,100vw)]"
      >
        <SheetHeader className="border-b px-6 pt-6 pb-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            Discounts · New
          </p>
          <SheetTitle className="text-[20px] font-semibold">Create discount</SheetTitle>
          <SheetDescription>
            Promo codes apply against subtotal in the order entry screen.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <DiscountForm storefrontSlug={storefrontSlug} mode="create" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
