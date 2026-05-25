/**
 * Next.js instrumentation hook — runs once per runtime (nodejs / edge)
 * before any request is served. We use it to bootstrap Sentry on the
 * server side. The client SDK lives in `src/instrumentation-client.ts`.
 *
 * Init is gated on `SENTRY_DSN` so local dev without a DSN is silent.
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs';
