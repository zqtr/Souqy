'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/admin/primitives';
import { removeDemoProducts } from '@/app/actions/products';

/**
 * Banner shown above the products list when any row carries
 * `is_demo = true`. One destructive button clears every demo row for
 * the active storefront in one shot (server action filtered by
 * `is_demo = true`; real products are never touched).
 *
 * Two locale strings ship inline because the merchant catalogue page
 * does not currently load `next-intl` messages — keeping the banner
 * standalone avoids pulling a fresh namespace into a hot surface.
 * Move to message file if the page graduates to next-intl.
 */
type Props = {
  slug: string;
  count: number;
  labels: {
    title: string;
    body: string;
    cta: string;
    busy: string;
    confirm: string;
    successSuffix: string;
  };
};

export function DemoProductsBanner({ slug, count, labels }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const onClick = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      const result = await removeDemoProducts({ slug });
      setConfirming(false);
      if (result.status === 'success') {
        setFeedback(`${result.count ?? 0} ${labels.successSuffix}`);
        router.refresh();
      } else if (result.status === 'error') {
        setFeedback(result.message);
      }
    });
  };

  return (
    <Surface
      padding={18}
      style={{
        marginBottom: 16,
        background: 'color-mix(in srgb, var(--color-gold, #c9a961) 14%, var(--surface-elevated))',
        borderColor: 'color-mix(in srgb, var(--color-gold, #c9a961) 35%, var(--surface-rule))',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--ink-muted)',
              marginBottom: 6,
            }}
          >
            {labels.title} · {count}
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--ink-strong)' }}>
            {labels.body}
          </p>
          {feedback ? (
            <p style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-muted)' }}>{feedback}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant={confirming ? 'destructive' : 'outline'}
          size="sm"
          onClick={onClick}
          disabled={pending}
        >
          {pending ? labels.busy : confirming ? labels.confirm : labels.cta}
        </Button>
      </div>
    </Surface>
  );
}
