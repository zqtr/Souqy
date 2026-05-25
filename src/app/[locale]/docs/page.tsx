import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isLocale, type Locale } from '@/i18n/locales';
import { buildMetadata } from '@/lib/seo';
import { DocsContent } from './DocsContent';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return buildMetadata({
    locale: raw,
    path: '/docs',
    title:
      raw === 'ar'
        ? 'دليل سوقنا · كل ما تحتاج معرفته'
        : 'Souqna Docs · Everything you need to know',
    description:
      raw === 'ar'
        ? 'الدليل الشامل لسوقنا — البناء، المتاجر، التطبيقات، الباقات، والأسئلة الشائعة. متوفر بالعربية والإنجليزية.'
        : 'The complete guide to Souqna — builder, storefronts, apps, plans, and FAQ. Available in English and Arabic.',
  });
}

export default async function DocsPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  setRequestLocale(locale);
  return <DocsContent initialLang={locale} />;
}
