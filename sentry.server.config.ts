import * as Sentry from '@sentry/nextjs';

/**
 * Sentry — Node.js server runtime (App Router server components,
 * route handlers, server actions, and the route handler error hook).
 *
 * Sampling is conservative on free tier: 10% traces in production, 100%
 * locally so devs catch issues before they ship. Performance / replay
 * features are off by default — flip them on once we're on a paid plan.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: false,
  enabled: Boolean(process.env.SENTRY_DSN),
});
