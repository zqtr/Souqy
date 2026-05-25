import { notFound, redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isLocale, type Locale } from '@/i18n/locales';

type Props = { params: Promise<{ locale: string }> };

function homeHref(locale: Locale, hash = '') {
  return `${locale === 'ar' ? '/ar' : '/'}${hash}`;
}

export default async function AtelierPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  setRequestLocale(raw);
  redirect(homeHref(raw, '#atelier'));
}
