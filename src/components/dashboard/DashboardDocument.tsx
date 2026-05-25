import type { ReactNode } from 'react';
import { fontVariables } from '@/lib/fonts';
import {
  getServerTheme,
  ThemeInitScript,
} from '@/components/theme/ServerThemeScript';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import '@/app/globals.css';

type Props = {
  children: ReactNode;
  /** When true, renders without the dark chrome — used by the preview iframe. */
  bare?: boolean;
  /** Document language attribute. Defaults to `en` since the dashboard UI is in English. */
  lang?: string;
  /**
   * Force a specific theme for this dashboard page. Defaults to `dark` so
   * builder/products/theme keep the Atelier chrome. Pass `light` for the
   * Settings overview, which deliberately mirrors the /account aesthetic.
   * Pass `cookie` to defer to the visitor's cookie (e.g. preview iframe).
   */
  theme?: 'dark' | 'light' | 'cookie';
};

/**
 * Document shell for dashboard pages. The root `app/layout.tsx` deliberately
 * doesn't render `<html>/<body>` (each tree owns its own shell) so this
 * component fills that slot.
 *
 * `bare` flips the wrapper styling so the preview route can render a
 * transparent canvas the iframe sits flush in. The bare mode skips the
 * theme provider too because the iframe content owns its own theme.
 *
 * NOTE: The dashboard chrome (BuilderShell, BuilderChrome) is currently
 * hardcoded to the dark Atelier aesthetic. Until Stage 1 finishes
 * theme-skinning the chrome, we force `data-theme="dark"` on the
 * dashboard regardless of the cookie. The toggle still works on every
 * other surface (marketing, auth, storefront preview iframe), so a user
 * who flips to light mode sees a light public site + a dark builder.
 */
export async function DashboardDocument({
  children,
  bare = false,
  lang = 'en',
  theme,
}: Props) {
  // The bare/preview iframe inherits the visitor's cookie so the storefront
  // preview accurately reflects what a public visitor would see.
  const cookieTheme = await getServerTheme();
  const resolved = theme ?? (bare ? 'cookie' : 'dark');
  const dashboardTheme = resolved === 'cookie' ? cookieTheme : resolved;

  return (
    <html
      lang={lang}
      className={fontVariables}
      data-theme={dashboardTheme}
      style={{ colorScheme: dashboardTheme }}
      suppressHydrationWarning
    >
      <head>{bare ? <ThemeInitScript /> : null}</head>
      <body
        className="min-h-dvh antialiased"
        style={{
          margin: 0,
          background: bare ? 'transparent' : 'var(--surface-bg)',
          color: bare ? 'inherit' : 'var(--ink-strong)',
          fontFamily: bare ? undefined : 'var(--font-sans), system-ui, sans-serif',
        }}
      >
        {bare ? children : <ThemeProvider>{children}</ThemeProvider>}
      </body>
    </html>
  );
}
