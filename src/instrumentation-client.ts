import * as Sentry from '@sentry/nextjs';

/**
 * Sentry — browser runtime. `instrumentation-client.ts` is Next 15+'s
 * canonical place for client SDK init (replaces the legacy
 * `sentry.client.config.ts`). The DSN must be a public value and is
 * exposed via `NEXT_PUBLIC_SENTRY_DSN`.
 *
 * Replay is opt-in (set `NEXT_PUBLIC_SENTRY_REPLAY=1`) so it doesn't
 * load the recorder bundle by default.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  const enableReplay = process.env.NEXT_PUBLIC_SENTRY_REPLAY === '1';
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: enableReplay ? 0.01 : 0,
    replaysOnErrorSampleRate: enableReplay ? 1.0 : 0,
    integrations: enableReplay
      ? [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })]
      : [],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
