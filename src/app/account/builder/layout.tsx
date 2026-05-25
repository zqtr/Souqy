import { Suspense } from 'react';
import { cookies } from 'next/headers';
import '@/app/globals.css';
import { fontVariables } from '@/lib/fonts';
import {
  getServerTheme,
  ThemeInitScript,
} from '@/components/theme/ServerThemeScript';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { NavigationLoader } from '@/components/system/NavigationLoader';
import { defaultLocale, direction, isLocale } from '@/i18n/locales';

/**
 * Builder layout — renders the document shell (html/body/fonts/theme)
 * for the full-bleed builder workspace. Deliberately omits the admin
 * sidebar + topbar so the 3-pane editor (canvas + library + inspector)
 * gets the entire viewport.
 *
 * `BuilderShell` itself owns its header and publish bar; this layout
 * just provides the document.
 */
export default async function BuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = await getServerTheme();
  // The builder route lives outside the `[locale]` segment (Clerk session
  // cookies and the account tree are deliberately apex-rooted — see
  // `src/middleware.ts`). Mirror the locale chosen on the public site by
  // reading next-intl's `NEXT_LOCALE` cookie so Arabic founders get an
  // RTL editor chrome without us moving the route under `[locale]`.
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale =
    cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const dir = direction[locale];
  const isRtl = dir === 'rtl';
  return (
    <html
      lang={locale}
      dir={dir}
      className={fontVariables}
      data-theme={theme}
      style={{ colorScheme: theme }}
      suppressHydrationWarning
    >
      <head>
        <ThemeInitScript />
      </head>
      <body
        className="min-h-dvh antialiased"
        style={{
          background: 'var(--surface-bg)',
          color: 'var(--ink-strong)',
          fontFamily: isRtl
            ? 'var(--font-arabic), var(--font-arabic-serif), ui-serif, Georgia, serif'
            : 'var(--font-sans)',
          fontWeight: isRtl ? 700 : undefined,
        }}
      >
        <ThemeProvider>
          {children}
          <Suspense fallback={null}>
            <NavigationLoader />
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
