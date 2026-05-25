'use client';

import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { BroadcastComposer } from './BroadcastComposer';

type AudienceCounts = {
  all: number;
  consented: number;
  recent: number;
};

type Props = {
  open: boolean;
  storefrontSlug: string;
  audience: AudienceCounts;
  closeHref: string;
};

export function BroadcastModal({
  open,
  storefrontSlug,
  audience,
  closeHref,
}: Props) {
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
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[min(680px,100vw)]"
      >
        <SheetHeader className="border-b px-6 pt-6 pb-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            Marketing · Broadcast
          </p>
          <SheetTitle className="text-[20px] font-semibold">Compose broadcast</SheetTitle>
          <SheetDescription>
            One-shot email to a curated audience. Sent via Resend; we add the Souqna
            footer and unsubscribe note automatically.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <BroadcastComposer storefrontSlug={storefrontSlug} audience={audience} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
