import { auth } from '@clerk/nextjs/server';
import {
  getUnreadCount,
  latestNotificationTs,
  listNotifications,
  listNotificationsSince,
} from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-Sent Events channel for the bell + /#billing live tracker.
 *
 * Wire format:
 *   event: snapshot          → { unreadCount, latest: Notification[] }
 *   event: delta             → { new: Notification[] }
 *
 * Lifecycle:
 *   - On connect we push a `snapshot` immediately so the client never
 *     waits a full poll interval to hydrate.
 *   - Every 6s we re-query for rows newer than the last seen timestamp
 *     and push a `delta` if any landed. Cursor is the highest
 *     `created_at` we've observed so we never re-emit a row.
 *   - Stream self-terminates after 4 minutes (Vercel function timeout
 *     headroom). The browser's `EventSource` auto-reconnects.
 *   - `request.signal.aborted` short-circuits the loop on disconnect.
 */
const POLL_INTERVAL_MS = 6_000;
const MAX_LIFETIME_MS = 4 * 60_000;

export async function GET(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const encoder = new TextEncoder();
  const start = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown): void => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // Controller closed mid-write — nothing to do, the loop will
          // exit on the next abort/timeout check.
        }
      };

      const close = (): void => {
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      try {
        const [unreadCount, latest, cursor] = await Promise.all([
          getUnreadCount(userId),
          listNotifications(userId, { limit: 5 }),
          latestNotificationTs(userId),
        ]);
        send('snapshot', {
          unreadCount,
          latest: latest.filter((n) => n.readAt === null).slice(0, 5),
        });
        let lastSeen = cursor ?? new Date(0).toISOString();

        while (!req.signal.aborted && Date.now() - start < MAX_LIFETIME_MS) {
          await new Promise<void>((resolve) => {
            const t = setTimeout(resolve, POLL_INTERVAL_MS);
            req.signal.addEventListener('abort', () => {
              clearTimeout(t);
              resolve();
            });
          });
          if (req.signal.aborted) break;

          const fresh = await listNotificationsSince(userId, lastSeen);
          if (fresh.length > 0) {
            // listNotificationsSince returns DESC; advance cursor to the
            // newest row's createdAt before emitting so a fast next tick
            // doesn't re-send the same payload.
            lastSeen = fresh[0]!.createdAt;
            send('delta', { new: fresh });
          } else {
            // Comment frame as a keepalive — keeps proxies and the
            // browser EventSource from idling out the connection.
            try {
              controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
            } catch {
              break;
            }
          }
        }
      } catch (err) {
        console.error('[notifications.stream] loop failed', err);
      } finally {
        close();
      }
    },
    cancel() {
      // Reader went away — the abort signal flips and the while loop
      // observes it on its next iteration.
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
