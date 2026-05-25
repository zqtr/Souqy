import { getSouqnasourceSettings } from '@/app/actions/souqnasource';
import { SettingsForm } from './settings-form';

export async function SettingsTab({ slug, locale }: { slug: string; locale: 'en' | 'ar' }) {
  const s = await getSouqnasourceSettings(slug);
  return <SettingsForm slug={slug} initial={s} locale={locale} />;
}
