import Link from 'next/link';
import { Surface } from '@/components/admin/primitives';
import { Button } from '@/components/ui/button';

/**
 * Three primary jump-offs from the dashboard home: add a product,
 * edit the storefront, install an app. Each link is scoped to the
 * active store via `storeParam` so the founder never lands on a
 * different storefront's surface than the one they were just viewing.
 *
 * Server component — no client state to manage, just three links.
 */
type Props = {
  storeParam: string;
  labels: {
    title: string;
    addProduct: string;
    editStorefront: string;
    browseApps: string;
  };
};

export function QuickActionsCard({ storeParam, labels }: Props) {
  return (
    <Surface padding={18}>
      <h2
        className="m-0 font-serif text-lg font-medium"
        style={{ color: 'var(--ink-strong)' }}
      >
        {labels.title}
      </h2>
      <div className="mt-4 flex flex-col gap-2">
        <Button asChild size="sm" className="justify-start" variant="outline">
          <Link href={`/account/products${storeParam}`}>{labels.addProduct}</Link>
        </Button>
        <Button asChild size="sm" className="justify-start" variant="outline">
          <Link href={`/account/builder${storeParam}`}>{labels.editStorefront}</Link>
        </Button>
        <Button asChild size="sm" className="justify-start" variant="outline">
          <Link href={`/account/apps${storeParam}`}>{labels.browseApps}</Link>
        </Button>
      </div>
    </Surface>
  );
}
