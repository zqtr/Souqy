import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import { defaultLocale, isLocale, type Locale } from '@/i18n/locales';
import { getServerTheme } from '@/components/theme/ServerThemeScript';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { buildMetadata } from '@/lib/seo';
import { getDiscoverPageData } from '@/lib/discover';
import { SouqnaDirectory } from '@/components/souqna/SouqnaDirectory';

export const dynamic = 'force-dynamic';

async function readLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get('NEXT_LOCALE')?.value;
  return value && isLocale(value) ? value : defaultLocale;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await readLocale();
  return buildMetadata({
    locale,
    path: '/souqna',
    title:
      locale === 'ar'
        ? 'سوقنا — أفضل المواقع هذا الأسبوع'
        : 'Souqna — Top Websites This Week',
    description:
      locale === 'ar'
        ? 'اكتشف مواقع ومتاجر حيّة مبنية على سوقنا، من مختارات الأسبوع إلى أحدث الإطلاقات.'
        : 'Discover live websites and storefronts built on Souqna, from weekly picks to newly launched brands.',
  });
}

export default async function SouqnaDirectoryPage() {
  const [locale, theme, { userId }, data] = await Promise.all([
    readLocale(),
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
