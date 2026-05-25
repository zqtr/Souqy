import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { auth } from '@clerk/nextjs/server';
import { isLocale, type Locale } from '@/i18n/locales';
import { getCopy } from '@/content/copy';
import { buildMetadata } from '@/lib/seo';
import { SouqnaBeginExperience } from '@/components/souqna/SouqnaBeginExperience';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const t = getCopy(raw);
  return buildMetadata({
    locale: raw,
    path: '/begin',
    title: `${t.begin.eyebrow} · ${t.meta.siteName}`,
    description: t.begin.sub,
  });
}

export default async function BeginPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  setRequestLocale(locale);
  const { userId } = await auth();

  return <SouqnaBeginExperience locale={locale} isSignedIn={Boolean(userId)} />;
}
