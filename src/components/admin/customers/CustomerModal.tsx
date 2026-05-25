'use client';

import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { CustomerForm } from './CustomerForm';

type Props = {
  open: boolean;
  storefrontSlug: string;
  closeHref: string;
};

export function CustomerModal({ open, storefrontSlug, closeHref }: Props) {
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
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[min(560px,100vw)]"
      >
        <SheetHeader className="border-b px-6 pt-6 pb-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            Customers · New
          </p>
          <SheetTitle className="text-[20px] font-semibold">Add a customer</SheetTitle>
          <SheetDescription>
            Hand-key a contact you've spoken to off-storefront. They'll be deduplicated
            automatically if they later send an inquiry from the live site.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <CustomerForm storefrontSlug={storefrontSlug} mode="create" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
