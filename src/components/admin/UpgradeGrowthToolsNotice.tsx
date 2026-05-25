import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { UPGRADE_GROWTH_TOOLS_COPY } from '@/lib/plans';

export function UpgradeGrowthToolsNotice() {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-md border border-[#d8b56b]/55 bg-[#fff7e7] px-4 py-3 text-sm text-[#6f493f] shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="font-semibold text-[#7d1f27]">{UPGRADE_GROWTH_TOOLS_COPY}</span>
      <Link
        href="/account/settings/plan"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#7d1f27] hover:underline"
      >
        Compare plans
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
