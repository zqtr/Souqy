import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { setRequestLocale } from 'next-intl/server';
import { isLocale, type Locale } from '@/i18n/locales';
import { getCopy } from '@/content/copy';
import { buildMetadata } from '@/lib/seo';
import { gateAtelierPro } from '@/lib/billing';
import { SouqyStudioIntro } from '@/components/sections/begin/SouqyStudioIntro';
import { SouqyPaywall } from '@/components/sections/begin/SouqyPaywall';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const t = getCopy(raw);
  const isAr = raw === 'ar';
  return buildMetadata({
    locale: raw,
    path: '/begin/souqy',
    title: isAr ? `سوقي · ${t.meta.siteName}` : `Souqy · ${t.meta.siteName}`,
    description: isAr
      ? 'استوديو تصميم ذكي للشعارات والبوسترات وهوية البراند.'
      : 'An AI design studio for logos, posters, and brand kits.',
  });
}

/**
 * `/[locale]/begin/souqy` — Souqy Studio entry point. This used to be
 * the paid-tier AI storefront-code intake; Souqy Studio is now a
 * separate creative surface for logos, posters, promotional photos, and
 * brand kits. The actual generation backends are wired later; this page
 * gives founders the full canvas interaction model first.
 */
export default async function SouqyBeginPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  setRequestLocale(locale);

  const { userId } = await auth();
  if (!userId) {
    redirect(`/sign-in?redirect_url=/${locale}/begin/souqy`);
  }

  const gate = await gateAtelierPro(userId);
  if (!gate.ok) {
    return <SouqyPaywall locale={locale} copy={getCopy(locale)} />;
  }

  return <SouqyStudioIntro locale={locale} />;
}
