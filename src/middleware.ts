import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { routing } from '@/i18n/routing';
import { getSlugForCustomDomain } from '@/lib/customDomainLookup';
import { ownedRootDomains, storefrontSubdomainForHost } from '@/lib/domainRouting';

const intlMiddleware = createMiddleware(routing);

const ROOT_DOMAIN =
  (process.env.BRIEF_ROOT_DOMAIN && process.env.BRIEF_ROOT_DOMAIN.trim()) || 'souqna.qa';
const FALLBACK_ROOT_DOMAIN =
  (process.env.BRIEF_FALLBACK_ROOT_DOMAIN && process.env.BRIEF_FALLBACK_ROOT_DOMAIN.trim()) ||
  'souqna.co';
const OWNED_ROOT_DOMAINS = ownedRootDomains(ROOT_DOMAIN, FALLBACK_ROOT_DOMAIN);

const MOBILE_API_PREFIX = '/api/mobile/v1';
const MOBILE_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};
const PREVIEW_EMBED_ORIGINS = new Set([
  'http://localhost:8081',
  'http://127.0.0.1:8081',
]);

function isLocalhostHost(host: string): boolean {
  const lower = host.toLowerCase();
  return (
    lower.startsWith('localhost:') ||
    lower === 'localhost' ||
    lower.startsWith('127.0.0.1:') ||
    lower === '127.0.0.1' ||
    lower.startsWith('[::1]:') ||
    lower === '::1' ||
    lower === '[::1]'
  );
}

/**
 * Hosts that should NOT be treated as a brief subdomain even if they
 * land on the wildcard. Apex, www, and known operational subs serve the
 * normal locale-routed app. Clerk's frontend API uses a subdomain such as `clerk.souqna.qa`.
 */
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

function getSubdomain(host: string): string | null {
  return storefrontSubdomainForHost(host, OWNED_ROOT_DOMAINS, RESERVED_HOSTS);
}

/**
 * Apex routes that require an authenticated Clerk session. The per-storefront
 * builder/editor lives at `/account/{slug}/...` on apex (Clerk session cookies
 * don't follow wildcard subdomains, and the public storefront subdomain stays
 * read-only). The `/account(.*)` pattern covers both the static account hub
 * and every per-storefront sub-route.
 *
 * Legacy `/brief/{slug}/dashboard*` and `/dashboard/*` paths are 308-redirected
 * into the `/account/...` tree below.
 */
const isProtectedApexRoute = createRouteMatcher([
  '/begin/souqy(.*)',
  '/(ar|en)/begin/souqy(.*)',
  '/account(.*)',
]);

/**
 * Routes that live OUTSIDE the `[locale]` tree (Clerk auth pages, the
 * authenticated account hub, API endpoints, and brief subdomain rewrites).
 * They must skip the next-intl middleware — otherwise next-intl tries to
 * fold them into the locale router and 404s because no `[locale]/sign-in`
 * page exists.
 */
const isNonLocalizedRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/begin(.*)',
  '/(ar|en)/begin(.*)',
  '/souqna(.*)',
  '/pricing-preview(.*)',
  '/account(.*)',
  '/brief(.*)',
  '/api/(.*)',
]);

/**
 * Bookmarks, emailed links, and any external pointer at the legacy
 * `/dashboard/*` URL surface get 308-redirected to the matching path
 * under `/account/*`. Search string is preserved.
 */
function redirectLegacyDashboard(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  if (pathname !== '/dashboard' && !pathname.startsWith('/dashboard/')) {
    return null;
  }
  const tail = pathname.slice('/dashboard'.length);
  const target = req.nextUrl.clone();
  target.pathname = `/account${tail}`;
  return NextResponse.redirect(target, 308);
}

/**
 * Map every `/account/{known-tab-id}` legacy path to its nested-route
 * equivalent. The dashboard now uses true App-Router nesting (one
 * folder per surface) so old query-string links like
 * `/account?tab=orders` and per-store deep links like
 * `/account/{slug}/products` need a 308 to the new home.
 *
 * Two helpers:
 *
 *   - `redirectLegacyTabQuery` handles `?tab=…` → `/account/<tab>`
 *   - `redirectLegacyAccountSlug` handles `/account/{slug}/<sub>` →
 *     `/account/<sub>?store={slug}`
 *
 * `/account/{slug}/preview` and `/account/{slug}/souqy` are preserved
 * — the builder iframe + Souqy preview still live there.
 */
const LEGACY_TAB_TO_PATH: Record<string, string> = {
  overview: '/account',
  account: '/account/settings/account',
  products: '/account/products',
  builder: '/account/builder',
  orders: '/account/orders',
  customers: '/account/customers',
  inquiries: '/account/inquiries',
  marketing: '/account/marketing',
  messages: '/account/messages',
  discounts: '/account/discounts',
  analytics: '/account/analytics',
  storage: '/account/storage-library',
  apps: '/account/apps',
  integrations: '/account/apps',
  billing: '/account/settings/plan',
  theme: '/account/builder',
  plugins: '/account/apps',
  pages: '/account/builder',
  settings: '/account/settings',
};

function redirectLegacyTabQuery(req: NextRequest): NextResponse | null {
  if (req.nextUrl.pathname !== '/account') return null;
  const tab = req.nextUrl.searchParams.get('tab');
  if (!tab) return null;
  const target = LEGACY_TAB_TO_PATH[tab];
  if (!target) return null;

  const url = req.nextUrl.clone();
  url.pathname = target;
  url.searchParams.delete('tab');
  return NextResponse.redirect(url, 308);
}

function redirectLegacyAccountSlug(req: NextRequest): NextResponse | null {
  const { pathname, search, origin } = req.nextUrl;

  if (pathname === '/account/storage-library' || pathname.startsWith('/account/storage-library/')) {
    return null;
  }

  if (pathname === '/account/storage' || pathname === '/account/analytics/storage') {
    const target = req.nextUrl.clone();
    target.pathname = '/account/storage-library';
    return NextResponse.redirect(target, 308);
  }

  // Match /account/{slug} or /account/{slug}/something. Reject the bare
  // /account hub (no slug) and anything not under /account.
  const match = /^\/account\/([^/]+)(?:\/(.*))?$/.exec(pathname);
  if (!match) return null;

  const slug = decodeURIComponent(match[1]!);
  const rest = match[2] ?? '';

  // Preserve iframe + souqy targets. Nothing user-facing links here.
  if (rest === 'preview' || rest.startsWith('preview/')) return null;
  if (rest === 'souqy' || rest.startsWith('souqy/')) return null;

  // Don't recurse into nested-route surfaces — when {slug} is itself
  // one of the new top-level paths the regex above matches but we want
  // it to fall through to the App Router (e.g. /account/orders means
  // the Orders page, not store=orders).
  const SLUG_RESERVED = new Set([
    'orders',
    'products',
    'customers',
    'inquiries',
    'marketing',
    'messages',
    'discounts',
    'analytics',
    'apps',
    'settings',
    'storage',
    'storage-library',
    'builder',
    'phone-required',
    'pos',
    'souqna',
  ]);
  if (SLUG_RESERVED.has(slug)) return null;

  // Carry incoming params through, then add ?store=<slug>.
  const params = new URLSearchParams(search);
  params.set('store', slug);

  let target = '/account';
  if (rest === '' || rest === 'edit' || rest === 'theme') {
    target = '/account/builder';
  } else if (rest === 'products') {
    target = '/account/products';
  } else if (rest === 'products/new') {
    target = '/account/products';
    params.set('new', '1');
  } else if (rest.startsWith('products/')) {
    const id = rest.slice('products/'.length);
    if (!id || id.includes('/')) return null;
    target = '/account/products';
    params.set('edit', decodeURIComponent(id));
  } else {
    return null;
  }

  const url = new URL(`${origin}${target}?${params.toString()}`);
  return NextResponse.redirect(url, 308);
}

function isPreviewEmbedRoute(req: NextRequest): boolean {
  return /^\/account\/[^/]+\/preview(?:\/.*)?$/.test(req.nextUrl.pathname);
}

function hasBearerToken(req: NextRequest): boolean {
  return /^Bearer\s+\S+/i.test(req.headers.get('authorization') ?? '');
}

function previewCorsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowedOrigin = PREVIEW_EMBED_ORIGINS.has(origin) ? origin : 'http://localhost:8081';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function rewriteSouqyStudio(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  if (pathname === '/begin/souqy') {
    return NextResponse.next();
  }
  if (pathname === '/en/begin/souqy' || pathname === '/ar/begin/souqy') {
    return NextResponse.next();
  }
  return null;
}

function rewriteLocalizedBegin(req: NextRequest): NextResponse | null {
  const match = /^\/(en|ar)\/begin$/.exec(req.nextUrl.pathname);
  if (!match) return null;

  const locale = match[1]!;
  const url = req.nextUrl.clone();
  url.pathname = '/begin';
  url.searchParams.set('locale', locale);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-souqna-locale', locale);

  const response = NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });
  response.cookies.set('NEXT_LOCALE', locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
  });
  return response;
}

function redirectDuplicateStorefrontSlugPath(
  req: NextRequest,
  storefrontSlug: string,
): NextResponse | null {
  const segments = req.nextUrl.pathname.split('/').filter(Boolean);
  if (segments[0]?.toLowerCase() !== storefrontSlug.toLowerCase()) return null;

  const target = req.nextUrl.clone();
  const rest = segments.slice(1).map(encodeURIComponent).join('/');
  target.pathname = rest ? `/${rest}` : '/';
  return NextResponse.redirect(target, 308);
}

/**
 * Founder-attached domains (`shop.brand.com`) live outside the
 * `*.souqna.qa` wildcard. When the host doesn't end in our root
 * domain, we look it up in `briefs.custom_domain`. A hit rewrites
 * straight to the storefront tree; a miss falls through to the
 * normal apex/locale routing so unrelated traffic isn't trapped.
 *
 * Lookup is cached in-process for 60s so the hot per-request path
 * costs zero DB round-trips after the first hit per region.
 */
async function rewriteForCustomDomain(req: NextRequest): Promise<NextResponse | null> {
  const host = req.headers.get('host') ?? '';
  const cleanHost = host.split(':')[0]?.toLowerCase() ?? '';
  if (!cleanHost) return null;
  if (req.nextUrl.pathname.startsWith('/api/')) return null;
  // Skip apex / wildcard / dev hosts — only run for hosts we don't own.
  if (
    OWNED_ROOT_DOMAINS.some((root) => cleanHost === root || cleanHost.endsWith(`.${root}`))
  ) {
    return null;
  }
  if (cleanHost === 'localhost' || cleanHost.endsWith('.localhost')) return null;
  if (cleanHost.endsWith('.vercel.app')) return null;

  const slug = await getSlugForCustomDomain(cleanHost);
  if (!slug) return null;

  if (req.nextUrl.pathname.startsWith('/brief/')) {
    return NextResponse.next();
  }

  const duplicateSlugRedirect = redirectDuplicateStorefrontSlugPath(req, slug);
  if (duplicateSlugRedirect) return duplicateSlugRedirect;

  const url = req.nextUrl.clone();
  url.pathname = `/brief/${slug}${url.pathname === '/' ? '' : url.pathname}`;
  return NextResponse.rewrite(url);
}

function rewriteForSubdomain(req: NextRequest): NextResponse | null {
  const host = req.headers.get('host') ?? '';
  const sub = getSubdomain(host);

  if (sub) {
    if (req.nextUrl.pathname.startsWith('/api/')) return null;

    // Visiting `{slug}.souqna.qa/account*` (or the legacy `/dashboard*`)
    // should land on the apex builder. Apex `/account/{slug}/...` is the
    // source of truth so the Clerk session cookie can follow the visitor.
    const subPath = req.nextUrl.pathname;
    const isLegacyDashboard =
      subPath === '/dashboard' || subPath.startsWith('/dashboard/');
    const isAccount = subPath === '/account' || subPath.startsWith('/account/');
    if (isLegacyDashboard || isAccount) {
      const prefix = isLegacyDashboard ? '/dashboard' : '/account';
      const tail = subPath === prefix ? '' : subPath.slice(prefix.length);
      const target = new URL(
        `https://${ROOT_DOMAIN}/account/${sub}${tail}${req.nextUrl.search}`,
      );
      return NextResponse.redirect(target, 308);
    }

    if (req.nextUrl.pathname.startsWith('/brief/')) {
      return NextResponse.next();
    }

    const duplicateSlugRedirect = redirectDuplicateStorefrontSlugPath(req, sub);
    if (duplicateSlugRedirect) return duplicateSlugRedirect;

    const url = req.nextUrl.clone();
    url.pathname = `/brief/${sub}${url.pathname === '/' ? '' : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (req.nextUrl.pathname.startsWith('/brief/')) {
    const parts = req.nextUrl.pathname.split('/').filter(Boolean);
    const slug = parts[1];
    if (!slug) return null;

    // Old apex dashboard paths fold into the new account builder tree.
    // /brief/{slug}/dashboard               → /account/{slug}
    // /brief/{slug}/dashboard/products      → /account/{slug}/products
    // /brief/{slug}/dashboard/edit          → /account/{slug}/edit
    if (parts[2] === 'dashboard') {
      const tail = parts.slice(3).join('/');
      const target = new URL(
        `${req.nextUrl.protocol}//${req.nextUrl.host}/account/${slug}${tail ? `/${tail}` : ''}${req.nextUrl.search}`,
      );
      return NextResponse.redirect(target, 308);
    }

    if (parts[2]?.toLowerCase() === slug.toLowerCase()) {
      const rest = parts.slice(3).map(encodeURIComponent).join('/');
      const target = new URL(
        `${req.nextUrl.protocol}//${req.nextUrl.host}/brief/${slug}${rest ? `/${rest}` : ''}${req.nextUrl.search}`,
      );
      return NextResponse.redirect(target, 308);
    }

    if (process.env.NODE_ENV !== 'production' && isLocalhostHost(req.nextUrl.host)) {
      return NextResponse.next();
    }

    const rest = parts.slice(2).join('/');
    const target = new URL(
      `https://${slug}.${ROOT_DOMAIN}${rest ? `/${rest}` : ''}${req.nextUrl.search}`,
    );
    return NextResponse.redirect(target, 308);
  }

  return null;
}

export default clerkMiddleware(async (auth, req) => {
  const isMobileApi = req.nextUrl.pathname.startsWith(MOBILE_API_PREFIX);
  if (isMobileApi && req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Cache-Control': 'no-store',
        ...MOBILE_CORS_HEADERS,
      },
    });
  }
  const isPreviewEmbed = isPreviewEmbedRoute(req);
  if (isPreviewEmbed && req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Cache-Control': 'no-store',
        ...previewCorsHeaders(req),
      },
    });
  }

  // 1. Subdomain rewrite or redirect first so apex/sub semantics stay clean.
  const subdomainResponse = rewriteForSubdomain(req);
  if (subdomainResponse) return subdomainResponse;

  // 1b. Custom-domain rewrite: founder-owned hostname → storefront tree.
  //     Runs only for hosts we don't otherwise recognise so the lookup
  //     cost is paid only by traffic that genuinely needs it.
  const customDomainResponse = await rewriteForCustomDomain(req);
  if (customDomainResponse) return customDomainResponse;

  // 2. Catch any leftover apex `/dashboard/*` link (bookmarks, old emails)
  //    and 308 it into the new `/account/*` tree before any auth check.
  const legacyDashboardResponse = redirectLegacyDashboard(req);
  if (legacyDashboardResponse) return legacyDashboardResponse;

  // 2b. `/account?tab=...` query-string links from old bookmarks /
  //     emails / Pulse get 308'd to the matching nested path so the
  //     URL bar reflects the actual surface the founder is on.
  const legacyTabResponse = redirectLegacyTabQuery(req);
  if (legacyTabResponse) return legacyTabResponse;

  // 2c. Per-storefront deep pages (`/account/{slug}/edit|theme|products`)
  //     are gone — surface their content under the matching nested
  //     route and pass the slug as `?store=`. The iframe-only
  //     `/account/{slug}/preview` and `/account/{slug}/souqy` are
  //     preserved by `redirectLegacyAccountSlug`.
  const legacyAccountSlugResponse = redirectLegacyAccountSlug(req);
  if (legacyAccountSlugResponse) return legacyAccountSlugResponse;

  // 3. Apex protection — bounce unauthenticated visitors to /sign-in.
  //    Clerk's default `auth.protect()` rewrites to 404 (anti-leak), but
  //    these routes are first-class destinations in our UX so we redirect
  //    explicitly with a return-to.
  if (isProtectedApexRoute(req)) {
    const { userId, redirectToSignIn } = await auth();
    if (!userId && !(isPreviewEmbed && hasBearerToken(req))) {
      return redirectToSignIn({ returnBackUrl: req.url });
    }
  }

  // 3a. `/en/begin` and `/ar/begin` are locale aliases for the animated
  //     shortcut shell, not the legacy localized intake surface.
  const localizedBeginResponse = rewriteLocalizedBegin(req);
  if (localizedBeginResponse) return localizedBeginResponse;

  // 3b. Souqy Studio keeps the clean `/begin/souqy` URL while avoiding
  //     next-intl's as-needed locale canonicalization loop in dev.
  const souqyStudioResponse = rewriteSouqyStudio(req);
  if (souqyStudioResponse) return souqyStudioResponse;

  // 4. Clerk auth pages + account + API live outside the [locale] tree.
  //    Let Next route them directly without next-intl interference.
  if (isNonLocalizedRoute(req)) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-souqna-pathname', req.nextUrl.pathname);
    requestHeaders.set('x-souqna-search', req.nextUrl.search);
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    if (isMobileApi) {
      for (const [key, value] of Object.entries(MOBILE_CORS_HEADERS)) {
        response.headers.set(key, value);
      }
    }
    if (isPreviewEmbed) {
      for (const [key, value] of Object.entries(previewCorsHeaders(req))) {
        response.headers.set(key, value);
      }
    }
    return response;
  }

  // 5. next-intl handles locale routing for everything else on the apex.
  return intlMiddleware(req);
});

export const config = {
  matcher: [
    // Skip Next internals + static files.
    '/((?!_next|_vercel|.*\\..*).*)',
    // Always run for API + tRPC.
    '/api/(.*)',
    '/trpc(.*)',
  ],
};
