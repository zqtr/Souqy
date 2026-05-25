'use client';

import type { ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { adminPhrase } from './adminLocale';

export function DashboardTabs({
  overview,
  setup,
  activity,
}: {
  overview: ReactNode;
  setup: ReactNode;
  activity: ReactNode;
}) {
  const locale = useLocale();
  const t = (text: string) => adminPhrase(locale, text);
  return (
    <Tabs defaultValue="overview" className="gap-6">
      <TabsList
        className="self-start"
        style={{
          background: 'var(--surface-elevated, var(--surface-bg))',
          border: '1px solid var(--surface-rule)',
        }}
      >
        <TabsTrigger value="overview">{t('Overview')}</TabsTrigger>
        <TabsTrigger value="setup">{t('Setup')}</TabsTrigger>
        <TabsTrigger value="activity">{t('Activity')}</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="flex flex-col gap-4">
        {overview}
      </TabsContent>
      <TabsContent value="setup">{setup}</TabsContent>
      <TabsContent value="activity">{activity}</TabsContent>
    </Tabs>
  );
}
