import { PageHeader } from '@/components/admin/primitives';
import { resolveSettingsContext } from '../_helpers';
import { BrandSettings } from '@/components/settings/BrandSettings';
import { BrandPreview } from '@/components/settings/BrandPreview';

const BRAND_LABELS = {
  en: {
    livePreview: 'Live preview',
    storefront: 'Storefront',
    logoMissing: 'No logo uploaded yet',
  },
  ar: {
    livePreview: 'معاينة حيّة',
    storefront: 'المتجر',
    logoMissing: 'لم يُرفع شعار بعد',
  },
} as const;

export default async function BrandSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const { storefront } = await resolveSettingsContext(sp, '/account/settings/brand');
  const labels = storefront.locale === 'ar' ? BRAND_LABELS.ar : BRAND_LABELS.en;
  return (
    <>
      <PageHeader
        eyebrow="Store · Brand"
        arEyebrow="المتجر · الهوية"
        title="Brand & logo"
        arTitle="الهوية والشعار"
        subtitle="Choose your logo, favicon, and tagline. The preview on the right updates after each save."
        arSubtitle="اختر الشعار، الأيقونة، والشعار النصي. يتحدّث العرض الجانبي بعد كل حفظ."
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)',
          gap: 20,
          alignItems: 'start',
        }}
        className="souqna-brand-grid"
      >
        <BrandSettings
          slug={storefront.slug}
          initial={{
            logoUrl: storefront.logoUrl,
            faviconUrl: storefront.faviconUrl,
            tagline: storefront.tagline,
            templateId: storefront.templateId,
          }}
        />
        <BrandPreview
          businessName={storefront.businessName}
          tagline={storefront.tagline}
          logoUrl={storefront.logoUrl}
          templateId={storefront.templateId}
          locale={storefront.locale === 'ar' ? 'ar' : 'en'}
          labels={{
            section: labels.livePreview,
            storefront: labels.storefront,
            logoMissing: labels.logoMissing,
          }}
        />
      </div>
      <style>{`
        @media (max-width: 940px) {
          .souqna-brand-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}
