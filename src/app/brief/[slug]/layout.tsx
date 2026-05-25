import { Suspense, type ReactNode } from 'react';
import '@/app/globals.css';
import { fontVariables } from '@/lib/fonts';
import { direction } from '@/i18n/locales';
import { getStorefront } from '@/lib/brief';
import {
  getServerTheme,
  ThemeInitScript,
} from '@/components/theme/ServerThemeScript';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { NavigationLoader } from '@/components/system/NavigationLoader';

type Props = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

/**
 * Brief subdomain layout. Lives outside the [locale] tree because the
 * middleware rewrites {slug}.souqna.qa/* here. We honor the brief's stored
 * locale at the <html> level so screen readers, bidi engines, and the
 * browser's font picker behave correctly.
 */
export default async function BriefLayout({ children, params }: Props) {
  const { slug } = await params;
  let lang: 'en' | 'ar' = 'en';
  try {
    const data = await getStorefront(slug);
    if (data) lang = data.locale;
  } catch {
    // Fall back to en if DB is unreachable; the page itself will show 404 / error.
  }

  const theme = await getServerTheme();

  return (
    <html
      lang={lang}
      dir={direction[lang]}
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
        style={{ background: 'var(--surface-bg)', color: 'var(--ink-strong)' }}
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
