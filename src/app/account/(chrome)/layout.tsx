import { Suspense } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import '@/app/globals.css';
import { adminFontVariables } from '@/lib/fonts';
import {
  getServerTheme,
  ThemeInitScript,
} from '@/components/theme/ServerThemeScript';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { AdminLanguageBridge } from '@/components/admin/AdminLanguageBridge';
import { ActiveStoreSync } from '@/components/admin/ActiveStoreSync';
import { UpgradeGrowthToolsNotice } from '@/components/admin/UpgradeGrowthToolsNotice';
import { StorefrontProvider } from '@/components/admin/StorefrontContext';
import { fromSummaries } from '@/components/admin/storefrontSummary';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { getStorefrontsForUser } from '@/lib/brief';
import { NavigationLoader } from '@/components/system/NavigationLoader';
import { listInstalledApps } from '@/lib/apps/installed';
import { getAppDescriptor } from '@/lib/apps/registry';
import type { InstalledAppNavItem } from '@/components/admin/AdminSidebar';
import { getPlan, getPlanMeta } from '@/lib/billing';
import { getAdminUserId } from '@/lib/adminAuth';
import { getSouqnaOperator } from '@/lib/souqna-operator';
import { defaultLocale, direction, isLocale } from '@/i18n/locales';
import { ADMIN_ACCENTS, type AdminAccent } from '@/lib/adminAccent';

/**
 * Chrome layout — renders the admin document shell + sidebar + topbar
 * for every page that lives in the `(chrome)` route group. The route
 * group disappears from the URL, so `/account`, `/account/orders`,
 * `/account/products`, etc. all share this layout, while
 * `/account/builder` and `/account/[slug]/preview` opt out by living
 * outside the group.
 *
 * Active storefront resolution lives here (not in the outer
 * `account/layout.tsx`) because Next 14 only passes `searchParams` to
 * layouts on dynamic segments — and we read `?store=<slug>` to scope
 * the dashboard to a specific store. React's `cache()` on
 * `getStorefrontsForUser` means the lookup is free even if a child
 * page also calls it.
 */
export default async function ChromeLayout({
  children,
  searchParams,
}: {
  children: React.ReactNode;
  searchParams?: Promise<{ store?: string | string[]; embed?: string | string[]; souqy?: string | string[] }>;
}) {
  const userId = await getAdminUserId('account/chrome/layout');
  if (!userId) redirect('/sign-in?redirect_url=/account');

  const sp = (await searchParams) ?? {};
  const headerStore = await headers();
  const forwardedSearch = headerStore.get('x-souqna-search');
  const forwardedParams = new URLSearchParams(
    forwardedSearch?.startsWith('?') ? forwardedSearch.slice(1) : (forwardedSearch ?? ''),
  );
  const requested =
    (Array.isArray(sp.store) ? sp.store[0] : sp.store) ?? forwardedParams.get('store') ?? undefined;
  const embedParam = Array.isArray(sp.embed) ? sp.embed[0] : sp.embed;
  const souqyParam = Array.isArray(sp.souqy) ? sp.souqy[0] : sp.souqy;
  // `?embed=1` strips the AdminSidebar + AdminTopBar so a chrome-less
  // settings surface can be hosted inside an iframe (e.g. the builder's
  // Apps tab modal). All data fetching above still runs so child pages
  // see the same providers and active store as a normal admin visit.
  const embed = embedParam === '1';

  // Each branch falls back to a safe default so a transient DB hiccup
  // or a bad theme cookie doesn't take down the entire dashboard
  // before the page-level error boundary can mount.
  const [storefronts, theme, plan, planMeta] = await Promise.all([
    getStorefrontsForUser(userId).catch((err) => {
      console.error('[admin/chrome] getStorefrontsForUser failed', err);
      return [] as Awaited<ReturnType<typeof getStorefrontsForUser>>;
    }),
    getServerTheme().catch((err) => {
      console.error('[admin/chrome] getServerTheme failed', err);
      return 'light' as const;
    }),
    getPlan(userId).catch((err) => {
      console.error('[admin/chrome] getPlan failed', err);
      return 'free' as const;
    }),
    getPlanMeta(userId).catch((err) => {
      console.error('[admin/chrome] getPlanMeta failed', err);
      return {} as Record<string, unknown>;
    }),
  ]);
  const souqnaOperator = await getSouqnaOperator();
  const known = storefronts.map((s) => s.slug);
  const activeSlug =
    requested && known.includes(requested)
      ? requested
      : storefronts[0]?.slug ?? null;
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const adminSans =
    locale === 'ar'
      ? 'var(--font-thmanyah-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      : 'var(--font-inter), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const cookieAccent = cookieStore.get('souqna_admin_accent')?.value;
  const accent =
    cookieAccent && ADMIN_ACCENTS.includes(cookieAccent as AdminAccent)
      ? (cookieAccent as AdminAccent)
      : 'mono';

  // Installed apps for the active store. Surfaced under the Apps nav
  // item so the founder can jump straight to a configured integration
  // without having to click into the marketplace tile first. Empty
  // array when there's no active store, the lookup throws, or no apps
  // are installed yet — sidebar renders the bare "Apps" link in that
  // case.
  const installedApps: InstalledAppNavItem[] = activeSlug
    ? await listInstalledApps(activeSlug)
        .catch((err) => {
          console.error('[admin/chrome] listInstalledApps failed', err);
          return [] as Awaited<ReturnType<typeof listInstalledApps>>;
        })
        .then((rows) =>
          rows.flatMap<InstalledAppNavItem>((row) => {
            const desc = getAppDescriptor(row.appId);
            if (!desc) return [];
            return [
              {
                id: row.appId,
                name: desc.name,
                glyph: desc.glyph,
                accentVar: desc.accentVar,
                markSrc: desc.markSrc,
                enabled: row.enabled,
              },
            ];
          }),
        )
    : [];

  return (
    <html
      lang={locale}
      dir={direction[locale]}
      className={adminFontVariables}
      data-theme={theme}
      data-admin-accent={accent}
      style={{
        colorScheme: theme,
        // Override the global type stack for the /account chrome only —
        // Inter for English dashboard density; Thmanyah Sans for Arabic
        // so the chrome and leaf pages share the same Arabic type voice.
        ['--font-sans' as string]: adminSans,
        ['--font-serif' as string]: adminSans,
        ['--font-english' as string]: adminSans,
        ['--font-arabic' as string]: 'var(--font-thmanyah-sans), ui-sans-serif, system-ui, sans-serif',
        ['--font-arabic-serif' as string]: 'var(--font-thmanyah-sans), ui-sans-serif, system-ui, sans-serif',
      }}
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
          fontFamily: 'var(--font-sans)',
          fontSynthesis: 'none',
          textRendering: 'optimizeLegibility',
        }}
      >
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={{}}>
            <AdminLanguageBridge />
            <StorefrontProvider
              storefronts={fromSummaries(storefronts)}
              activeSlug={activeSlug}
              plan={plan}
              planPeriodEnd={
                typeof planMeta.currentPeriodEnd === 'string'
                  ? planMeta.currentPeriodEnd
                  : null
              }
            >
              <ActiveStoreSync knownSlugs={known} serverActiveSlug={activeSlug} />
              {embed ? (
                <main
                  style={{
                    minHeight: '100dvh',
                    padding: 'clamp(16px, 2.5vw, 24px)',
                    width: '100%',
                  }}
                >
                  {children}
                </main>
              ) : (
                <SidebarProvider>
                  <AdminSidebar
                    installedApps={installedApps}
                    souqnaOperator={Boolean(souqnaOperator)}
                    side={direction[locale] === 'rtl' ? 'right' : 'left'}
                  />
                  <SidebarInset
                    style={{
                      background: 'var(--surface-bg)',
                      color: 'var(--ink-strong)',
                    }}
                  >
                    <AdminTopBar initialSouqyOpen={souqyParam === '1'} />
                    <main
                      style={{
                        flex: 1,
                        padding: 'clamp(20px, 3vw, 36px) clamp(20px, 4vw, 48px) 80px',
                        maxWidth: 1320,
                        width: '100%',
                        margin: '0 auto',
                      }}
                    >
                      {plan === 'free' ? <UpgradeGrowthToolsNotice /> : null}
                      {children}
                    </main>
                  </SidebarInset>
                </SidebarProvider>
              )}
              <Suspense fallback={null}>
                <NavigationLoader />
              </Suspense>
            </StorefrontProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
