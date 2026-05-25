import type { Metadata } from 'next';
import { requireStorefrontOwner } from '@/lib/dashboard-auth';
import { DashboardDocument } from '@/components/dashboard/DashboardDocument';
import { gateAtelierPro } from '@/lib/billing';
import { getSouqyAuditForStorefront } from '@/lib/souqy/db';
import { SouqyDashboard } from '@/components/dashboard/SouqyDashboard';
import { SouqyPaywall } from '@/components/sections/begin/SouqyPaywall';
import { getCopy } from '@/content/copy';

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  title: 'Souqy · Souqna',
};

/**
 * Per-storefront Souqy dashboard.
 *
 * Source viewer (read-only Monaco-style preview), re-prompt textarea,
 * revision history, rollback, and a "switch back to JSON builder"
 * toggle. The page is owner-gated AND plan-gated — a free-tier owner
 * who somehow lands here sees the paywall instead of the editor.
 */
export default async function SouqyDashboardPage({ params }: Props) {
  const { slug } = await params;
  const auth = await requireStorefrontOwner(slug, `/account/${slug}/souqy`);
  if (!auth.ok) return <DashboardDocument>{auth.panel}</DashboardDocument>;

  const plan = await gateAtelierPro(auth.userId);
  if (!plan.ok) {
    const copy = getCopy(auth.storefront.locale);
    return (
      <DashboardDocument>
        <SouqyPaywall locale={auth.storefront.locale} copy={copy} />
      </DashboardDocument>
    );
  }

  const audit = await getSouqyAuditForStorefront(slug, 30);

  return (
    <DashboardDocument>
      <SouqyDashboard storefront={auth.storefront} audit={audit} />
    </DashboardDocument>
  );
}
