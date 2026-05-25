'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Locale } from '@/i18n/locales';
import { getCopy, type Copy } from '@/content/copy';

type BuilderCopyContextValue = {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  copy: Copy;
  builder: Copy['builder'];
};

const BuilderCopyContext = createContext<BuilderCopyContextValue | null>(null);

export function BuilderCopyProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const copy = getCopy(locale);
  const value: BuilderCopyContextValue = {
    locale,
    dir: locale === 'ar' ? 'rtl' : 'ltr',
    copy,
    builder: copy.builder,
  };
  return (
    <BuilderCopyContext.Provider value={value}>
      {children}
    </BuilderCopyContext.Provider>
  );
}

export function useBuilderCopy(): BuilderCopyContextValue {
  const ctx = useContext(BuilderCopyContext);
  if (!ctx) {
    throw new Error(
      'useBuilderCopy must be used inside <BuilderCopyProvider>. Mount it at the builder route root.',
    );
  }
  return ctx;
}
