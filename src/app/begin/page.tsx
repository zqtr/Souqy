import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import { SouqnaBeginExperience } from '@/components/souqna/SouqnaBeginExperience';
import { defaultLocale, isLocale } from '@/i18n/locales';

export const metadata: Metadata = {
  title: 'Begin · Souqna',
  description: 'Set up your Souqna brand name, logo, subdomain, activity, storefront template, and launch confirmation.',
};

type Props = {
  searchParams?: Promise<{ locale?: string | string[] }>;
};

export default async function BeginPage({ searchParams }: Props) {
  const emptyParams: { locale?: string | string[] } = {};
  const [cookieStore, hdrs, params, session] = await Promise.all([
    cookies(),
    headers(),
    searchParams ?? Promise.resolve(emptyParams),
    auth(),
  ]);
  const queryLocale = Array.isArray(params.locale) ? params.locale[0] : params.locale;
  const headerLocale = hdrs.get('x-souqna-locale');
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale =
    (queryLocale && isLocale(queryLocale) && queryLocale) ||
    (headerLocale && isLocale(headerLocale) && headerLocale) ||
    (cookieLocale && isLocale(cookieLocale) && cookieLocale) ||
    defaultLocale;

  return <SouqnaBeginExperience locale={locale} isSignedIn={Boolean(session.userId)} />;
}
