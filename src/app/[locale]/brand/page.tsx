import { notFound, redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isLocale, type Locale } from '@/i18n/locales';

type Props = { params: Promise<{ locale: string }> };

function homeHref(locale: Locale) {
  return locale === 'ar' ? '/ar' : '/';
}

export default async function BrandRoute({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  setRequestLocale(raw);
  redirect(homeHref(raw));
}
