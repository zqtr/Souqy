/**
 * Client-safe shim for the `Notification` row shape produced by
 * `src/lib/notifications.ts`. The lib module is server-only (touches
 * Neon directly) so client components import the type from here to
 * avoid pulling the DB layer into the browser bundle.
 */
export type NotificationKind =
  | 'billing.subscription.activated'
  | 'billing.subscription.cancelled'
  | 'billing.subscription.suspended'
  | 'billing.subscription.expired'
  | 'billing.subscription.updated'
  | 'billing.payment.failed'
  | 'billing.payment.succeeded'
  | 'system.welcome'
  | (string & {});

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  titleAr: string;
  body: string | null;
  bodyAr: string | null;
  href: string | null;
  meta: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type NotificationStreamEvent =
  | { type: 'snapshot'; unreadCount: number; latest: Notification[] }
  | { type: 'delta'; new: Notification[] };
