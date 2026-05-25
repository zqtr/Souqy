import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { Analytics } from '@vercel/analytics/next';
import { ClerkProvider } from '@clerk/nextjs';
import { getServerTheme } from '@/components/theme/ServerThemeScript';
import { PostHogProvider } from '@/components/analytics/PostHogProvider';
import { souqnaClerkAppearance } from '@/lib/clerkAppearance';
import { clerkLocalization } from '@/lib/clerkLocalization';
import { defaultLocale, isLocale } from '@/i18n/locales';
import './globals.css';

const ROOT_DOMAIN =
  (process.env.BRIEF_ROOT_DOMAIN && process.env.BRIEF_ROOT_DOMAIN.trim()) || 'souqna.qa';
const RESERVED_HOSTS = new Set([
  'www',
  'mail',
  'admin',
  'api',
  'cdn',
  'assets',
  'app',
  'clerk',
  'accounts',
]);

/**
 * Storefront subdomains (`{slug}.souqna.qa`) are 100% public — no auth,
 * no <UserButton>, no <SignIn>. We deliberately skip <ClerkProvider>
 * there so Clerk's frontend API doesn't try to authorise the wildcard
 * subdomain (the dev instance can't, and even on prod it'd be a wasted
 * round-trip + a hydration crash if it ever 403s mid-stream).
 */
function isStorefrontSubdomainHost(host: string): boolean {
  const clean = host.split(':')[0]?.toLowerCase() ?? '';
  if (!clean.endsWith(`.${ROOT_DOMAIN}`)) return false;
  const sub = clean.slice(0, -1 * (`.${ROOT_DOMAIN}`.length));
  if (!sub || sub.includes('.')) return false;
  return !RESERVED_HOSTS.has(sub);
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://souqna.qa'),
  title: { default: 'Souqna - bilingual commerce workspace', template: '%s · Souqna' },
  description:
    'Souqna is a bilingual commerce workspace for launching and operating modern Gulf storefronts.',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: '/favicon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#E8DCC4',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

/**
 * Root layout intentionally does NOT render <html>/<body>. Each downstream
 * layout owns its own document shell so we can vary `lang`/`dir` per locale
 * (the [locale] tree) and per storefront (the /brief tree). ClerkProvider
 * wraps everything so both trees share the same auth context.
 *
 * Clerk's appearance is theme-aware: we read the cookie server-side and
 * tint Clerk's chrome to match the active surface.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getServerTheme();
  const dark = theme === 'dark';
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  const host = (await headers()).get('host') ?? '';
  const isStorefront = isStorefrontSubdomainHost(host);

  const inner = (
    <PostHogProvider>
      {children}
      {process.env.NODE_ENV === 'production' ? <Analytics /> : null}
    </PostHogProvider>
  );

  if (isStorefront) return inner;

  return (
    <ClerkProvider
      appearance={souqnaClerkAppearance({ dark })}
      localization={clerkLocalization(locale)}
    >
      {inner}
    </ClerkProvider>
  );
}
