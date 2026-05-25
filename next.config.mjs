import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  experimental: {
    typedRoutes: false,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      // The web dashboard and Expo web builder mount this route in an
      // iframe so founders can edit blocks against the real renderer.
      // Expo web runs on :8081 in dev, so CSP allows that local parent.
      {
        source: '/account/:slug/preview',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOW-FROM http://localhost:8081' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self' http://localhost:8081 http://127.0.0.1:8081" },
        ],
      },
      // Same relaxation for the ephemeral template-preview route used by
      // the Site inspector's "Browse all templates" modal — the founder
      // sees their real products inside each template variant via a
      // same-origin iframe stack.
      {
        source: '/account/:slug/preview/template/:templateId',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
        ],
      },
      {
        source: '/fonts/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

/**
 * Sentry — wraps the Next config to upload sourcemaps + auto-instrument
 * route handlers + tunnel client events through `/monitoring` so ad
 * blockers don't drop them. Build is silent locally; CI gets logs only
 * when `SENTRY_AUTH_TOKEN` is present (set in Vercel project env).
 */
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  tunnelRoute: '/monitoring',
  widenClientFileUpload: true,
  hideSourceMaps: true,
  telemetry: false,
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: true,
  },
});
