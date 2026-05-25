import { env } from './env';

/**
 * Helpers for constructing absolute URLs to a storefront subdomain.
 *
 * The storefront chrome (legal footer, page nav) and checkout policy
 * links must point at the live subdomain (`{slug}.souqna.qa/...`)
 * regardless of where they're rendered — apex (`souqna.qa/brief/...`),
 * dev (`localhost:3000/brief/...`), or the builder preview iframe
 * (`/account/{slug}/preview`). Using a relative `/key` href works on
 * the real subdomain (the middleware rewrites it internally) but
 * silently breaks every other surface.
 *
 * `BRIEF_ROOT_DOMAIN` is server-only by design; callers must compute
 * the base URL in a server component or server action and pass it
 * down to client components as a prop.
 */
export function storefrontHost(slug: string): string {
  return `${slug}.${env.BRIEF_ROOT_DOMAIN}`;
}

export function storefrontFallbackHost(slug: string): string | null {
  const fallback = env.BRIEF_FALLBACK_ROOT_DOMAIN?.trim();
  if (!fallback || fallback === env.BRIEF_ROOT_DOMAIN) return null;
  return `${slug}.${fallback}`;
}

export function storefrontBaseUrl(slug: string): string {
  const proto = env.NEXT_PUBLIC_SITE_URL.startsWith('https://') ? 'https' : 'http';
  return `${proto}://${storefrontHost(slug)}`;
}

export function storefrontFallbackBaseUrl(slug: string): string | null {
  const host = storefrontFallbackHost(slug);
  if (!host) return null;
  const proto = env.NEXT_PUBLIC_SITE_URL.startsWith('https://') ? 'https' : 'http';
  return `${proto}://${host}`;
}

export function storefrontPageUrl(slug: string, path: string): string {
  const trimmed = path.startsWith('/') ? path : `/${path}`;
  return `${storefrontBaseUrl(slug)}${trimmed}`;
}
