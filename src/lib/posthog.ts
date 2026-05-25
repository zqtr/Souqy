import 'server-only';
import { PostHog } from 'posthog-node';

/**
 * Server-side PostHog client. Used from server actions, route
 * handlers, and webhooks where we already know the actor (Clerk
 * user id) and want a durable record. The browser SDK lives in
 * `src/components/analytics/PostHogProvider.tsx` and handles
 * autocaptured pageviews / clicks.
 *
 * `flushAt: 1` means events are sent immediately rather than
 * batched — that's the right call inside short-lived serverless
 * invocations where the process can exit before a batch flush.
 *
 * The client is a singleton per Lambda warm-instance.
 */
let client: PostHog | null = null;

export function getPostHogServer(): PostHog | null {
  const key = process.env.POSTHOG_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (client) return client;
  client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

/**
 * Fire a server-side event. Safe to call when PostHog is not
 * configured — it returns silently. Always pass `distinctId` so the
 * event can be tied back to a Clerk user; fall back to a synthetic
 * `anon-<requestId>` for unauthenticated traffic.
 */
export async function captureServerEvent(args: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  const ph = getPostHogServer();
  if (!ph) return;
  ph.capture({
    distinctId: args.distinctId,
    event: args.event,
    properties: args.properties,
  });
  await ph.flush();
}
