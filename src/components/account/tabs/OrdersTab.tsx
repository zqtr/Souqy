import { ComingSoonCard } from './ComingSoonCard';

/**
 * Orders tab — placeholder until the storefront product pages can capture
 * a real order. The roadmap reflects a deliberate sequencing: capture
 * first, notification next, then fulfilment + export.
 */
export function OrdersTab() {
  return (
    <ComingSoonCard
      title="Orders, in one inbox."
      tagline="Every inquiry and purchase from every storefront, sorted, status-tracked, and ready to action."
      intro={
        <>
          Right now, customers reach you via the WhatsApp / email button on each
          storefront. The Orders tab will replace that with a structured inbox
          so nothing falls through the cracks once you start moving real volume.
        </>
      }
      bullets={[
        {
          title: 'Order capture',
          detail:
            'a checkout sheet on every product page — quantity, contact, notes — saved as an order row tied to the storefront.',
        },
        {
          title: 'Instant notifications',
          detail:
            'WhatsApp and email pings the moment something comes in (you, optionally the customer).',
        },
        {
          title: 'Fulfilment status',
          detail:
            'New → In progress → Ready → Closed, mirrored on the customer side via a magic link.',
        },
        {
          title: 'CSV export',
          detail:
            'one click to hand off to your accountant or a logistics partner.',
        },
      ]}
      cta={{ label: 'Open a storefront →', href: '/account?tab=overview' }}
    />
  );
}
