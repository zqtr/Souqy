import * as Sentry from '@sentry/nextjs';

/**
 * Sentry — Edge runtime (middleware + Edge route handlers). Same
 * defaults as the Node config so error context is consistent across
 * runtimes; the edge SDK is a much slimmer build under the hood.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: false,
  enabled: Boolean(process.env.SENTRY_DSN),
});
