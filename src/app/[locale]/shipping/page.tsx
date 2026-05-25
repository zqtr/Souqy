import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { PolicyPage } from '@/components/sections/legal/PolicyPage';
import { getPolicy } from '@/content/policies';
import { isLocale, type Locale } from '@/i18n/locales';
import { buildMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const policy = getPolicy(raw, 'shipping');

  return buildMetadata({
    locale: raw,
    path: policy.path,
    title: `${policy.title} · Souqna`,
    description: policy.description,
  });
}

export default async function ShippingPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  setRequestLocale(locale);

  return <PolicyPage locale={locale} policy={getPolicy(locale, 'shipping')} />;
}
