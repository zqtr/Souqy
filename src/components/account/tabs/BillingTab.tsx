import { ComingSoonCard } from './ComingSoonCard';

/**
 * Billing tab: placeholder until per-storefront subscription billing is
 * wired through SkipCash. The plan catalog is live, while subscription
 * collection still depends on the billing setup flow.
 */
export function BillingTab() {
  return (
    <ComingSoonCard
      title="Billing & subscription."
      tagline="Every storefront on its own plan, billed in QAR, with invoices you can hand to an accountant."
      intro={
        <>
          Every storefront can use Free, Pro, Pro+, or Max+. Paid tiers unlock
          growth tools, lower platform fees, and higher operating limits.
        </>
      }
      bullets={[
        {
          title: 'Per-storefront plan',
          detail:
            'Free, Pro, Pro+, or Max+ with storefront limits, AI credits, and support matched to the tier.',
        },
        {
          title: 'QAR-native checkout',
          detail:
            'SkipCash checkout for online buyer payments, with offline methods tracked in the fee ledger.',
        },
        {
          title: 'Invoices & receipts',
          detail:
            'Auto-generated PDF invoices in English and Arabic, downloadable per period.',
        },
        {
          title: 'Payment methods',
          detail:
            'Update card, change billing email, or pause a storefront without deleting it.',
        },
        {
          title: 'Usage caps',
          detail:
            'Hard caps on products and monthly checkout orders for Free, with upgrade messaging when you hit them.',
        },
      ]}
      cta={{ label: 'See pricing on the home page', href: '/en#pricing' }}
    />
  );
}
