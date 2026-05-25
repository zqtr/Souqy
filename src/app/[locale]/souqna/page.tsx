import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isLocale, type Locale } from '@/i18n/locales';
import { getServerTheme } from '@/components/theme/ServerThemeScript';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { buildMetadata } from '@/lib/seo';
import { getDiscoverPageData } from '@/lib/discover';
import { SouqnaDirectory } from '@/components/souqna/SouqnaDirectory';

type Props = {
  params: Promise<{ locale: string }>;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return buildMetadata({
    locale: raw,
    path: '/souqna',
    title:
      raw === 'ar'
        ? 'سوقنا — أفضل المواقع هذا الأسبوع'
        : 'Souqna — Top Websites This Week',
    description:
      raw === 'ar'
        ? 'اكتشف مواقع ومتاجر حيّة مبنية على سوقنا، من مختارات الأسبوع إلى أحدث الإطلاقات.'
        : 'Discover live websites and storefronts built on Souqna, from weekly picks to newly launched brands.',
  });
}

export default async function LocalizedSouqnaDirectoryPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  setRequestLocale(locale);

  const [theme, { userId }, data] = await Promise.all([
    getServerTheme(),
    auth(),
    getDiscoverPageData(),
  ]);
  const ctaHref = userId ? '/account' : locale === 'ar' ? '/ar/begin' : '/begin';

  return (
    <ThemeProvider initialTheme={theme}>
      <SouqnaDirectory locale={locale} data={data} ctaHref={ctaHref} />
    </ThemeProvider>
  );
}
