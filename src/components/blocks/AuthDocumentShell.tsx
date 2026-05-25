import type { ReactNode } from 'react';
import { cookies, headers } from 'next/headers';
import { fontVariables } from '@/lib/fonts';
import { getServerTheme, ThemeInitScript } from '@/components/theme/ServerThemeScript';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { LocaleToggle } from '@/components/souqna/LocaleToggle';
import { defaultLocale, direction, isLocale } from '@/i18n/locales';

export async function AuthDocumentShell({ children }: { children: ReactNode }) {
  const theme = await getServerTheme();
  const [cookieStore, hdrs] = await Promise.all([cookies(), headers()]);
  const headerLocale = hdrs.get('x-souqna-locale');
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale =
    (headerLocale && isLocale(headerLocale) && headerLocale) ||
    (cookieLocale && isLocale(cookieLocale) && cookieLocale) ||
    defaultLocale;

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
      <body
        className="min-h-dvh bg-[var(--surface-bg)] text-[var(--ink-strong)] antialiased [font-family:var(--font-sans)]"
        suppressHydrationWarning
      >
        <ThemeProvider initialTheme={theme}>
          <div className="fixed end-5 top-5 z-30 flex items-center gap-2">
            <LocaleToggle locale={locale} mode="account" />
            <ThemeToggle compact />
          </div>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
