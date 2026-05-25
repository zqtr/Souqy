import { getCopy } from '@/content/copy';
import { Pricing } from '@/components/sections/pricing/Pricing';

export default function PricingPreviewPage() {
  return <Pricing locale="en" copy={getCopy('en')} />;
}
