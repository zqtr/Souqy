import { getRequestConfig } from 'next-intl/server';
import { isLocale, defaultLocale } from './locales';

import souqnasourceEn from './messages/apps/souqnasource/en.json';
import souqnasourceAr from './messages/apps/souqnasource/ar.json';
import souqnasourceCatsEn from './messages/apps/souqnasource/categories.en.json';
import souqnasourceCatsAr from './messages/apps/souqnasource/categories.ar.json';

const messagesByLocale = {
  en: {
    apps: {
      souqnasource: { ...souqnasourceEn, categories: souqnasourceCatsEn },
    },
  },
  ar: {
    apps: {
      souqnasource: { ...souqnasourceAr, categories: souqnasourceCatsAr },
    },
  },
} as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : defaultLocale;
  return {
    locale,
    messages: messagesByLocale[locale as keyof typeof messagesByLocale] ?? messagesByLocale.en,
  };
});
