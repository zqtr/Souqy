import type { Storefront } from '@/lib/brief';
import { StorefrontJumpTab } from './StorefrontJumpTab';

type Props = {
  storefronts: Storefront[];
  storeFilter?: string;
};

/**
 * Builder tab — only reached when the founder hits `?tab=builder` with
 * no `&store=...` (e.g. clicking the rail when nothing is selected).
 * Once a store is picked, the page renders `<BuilderShell>` inline in
 * full-bleed mode and never falls back here.
 */
export function BuilderTab({ storefronts, storeFilter }: Props) {
  return (
    <StorefrontJumpTab
      storefronts={storefronts}
      storeFilter={storeFilter}
      tabId="builder"
      title="Builder."
      tagline="The 3-pane block editor — drag, drop, and ship pages without code. Pick a storefront to open its builder."
      ctaLabel="Open Builder"
      dashboardPath={(slug) => `/account/builder?store=${encodeURIComponent(slug)}`}
    />
  );
}
