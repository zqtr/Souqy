import { Suspense, type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import '@/app/globals.css';
import { setRequestLocale } from 'next-intl/server';
import { isLocale, direction, locales, type Locale } from '@/i18n/locales';
import { getCopy } from '@/content/copy';
import { fontVariables } from '@/lib/fonts';
import { Navigation3 } from '@/components/blocks/navigation-3';
import { Footer } from '@/components/layout/Footer';
import { organizationJsonLd } from '@/lib/seo';
import {
  getServerTheme,
  ThemeInitScript,
} from '@/components/theme/ServerThemeScript';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { NavigationLoader } from '@/components/system/NavigationLoader';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  setRequestLocale(locale);
  const copy = getCopy(locale);
  const theme = await getServerTheme();

  return (
    <html
      lang={locale}
      dir={direction[locale]}
      className={fontVariables}
      data-theme={theme}
      style={{ colorScheme: theme }}
      suppressHydrationWarning
    >
      <head>
        <ThemeInitScript />
      </head>
      <body className="min-h-dvh bg-[color:var(--surface-bg)] text-[color:var(--ink-strong)] antialiased">
        <ThemeProvider initialTheme={theme}>
          <NextIntlClientProvider locale={locale} messages={{}}>
            <div data-public-chrome="navigation">
              <Navigation3 locale={locale} copy={copy} />
            </div>
            <main id="main">{children}</main>
            <div data-public-chrome="footer">
              <Footer locale={locale} copy={copy} />
            </div>
            {/* Suspense isolates `useSearchParams()` so it doesn't opt
                statically prerendered pages into client rendering. */}
            <Suspense fallback={null}>
              <NavigationLoader />
            </Suspense>
          </NextIntlClientProvider>
        </ThemeProvider>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(locale)) }}
        />
      </body>
    </html>
  );
}
