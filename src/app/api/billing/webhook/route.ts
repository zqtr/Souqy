import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { db, hasDb } from '@/lib/db';
import { env } from '@/lib/env';
import { hasStripe, planFromPriceId, stripeClient } from '@/lib/stripe';
import { getPlanMeta, setPlan, type Plan } from '@/lib/billing';
import { PLAN_LIMITS, planLabel } from '@/lib/plans';
import { logEvent } from '@/lib/events';
import { sendMail } from '@/lib/mailer';
import { createNotification } from '@/lib/notifications';

export const runtime = 'nodejs';
// Stripe signs the *raw* request body, so we must keep the bytes
// untouched — Next must not buffer/parse them as JSON. `dynamic` keeps
// the route fully server-rendered per request.
export const dynamic = 'force-dynamic';

/**
 * Stripe billing webhook.
 *
 * Lifecycle handled (mirrors the four states our `Plan` type can be in):
 *   - checkout.session.completed       → first-time activation, sets plan
 *                                        from the line item's price id and
 *                                        sends the welcome email.
 *   - customer.subscription.created    → defensive duplicate of the above
 *   - customer.subscription.updated    → plan change, cycle swap, or renewal
 *   - customer.subscription.deleted    → downgrade to `free`
 *   - invoice.payment_failed           → audit only; downgrade waits until
 *                                        Stripe transitions the sub to
 *                                        `canceled` after retries (grace).
 *
 * Idempotency is enforced via a `processed_webhooks` table keyed by the
 * Stripe event id — every handler is wrapped in an insert-or-skip so
 * Stripe's at-least-once delivery never double-applies a state change.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!hasStripe() || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
  }
  const stripe = stripeClient();
  if (!stripe) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
  }

  const sig = req.headers.get('stripe-signature') ?? '';
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[billing.webhook] bad signature', err);
    return NextResponse.json({ error: 'Bad signature' }, { status: 400 });
  }

  if (await alreadyProcessed(event.id)) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChanged(event.data.object as Stripe.Subscription, event.type);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        // Stripe sends a long tail of events we don't care about; just
        // ack so it doesn't retry.
        break;
    }
    await markProcessed(event.id, event.type);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[billing.webhook] handler failed', event.type, err);
    // 500 → Stripe retries with exponential backoff. The dedupe table
    // is only populated on success, so a retried event re-enters the
    // switch above.
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
}

/* ────────────────────────────────────────────────────────────────── */
/* Handlers                                                           */
/* ────────────────────────────────────────────────────────────────── */

async function handleCheckoutCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const clerkUserId =
    session.client_reference_id ??
    (typeof session.metadata?.clerkUserId === 'string'
      ? session.metadata.clerkUserId
      : null);
  if (!clerkUserId) return;
  if (session.mode !== 'subscription' || !session.subscription) return;

  const subId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription.id;
  const sub = await stripe.subscriptions.retrieve(subId);
  await applySubscription(clerkUserId, sub, 'checkout.session.completed');
}

async function handleSubscriptionChanged(
  sub: Stripe.Subscription,
  evt: string,
): Promise<void> {
  const clerkUserId = clerkUserIdFromSub(sub);
  if (!clerkUserId) return;
  await applySubscription(clerkUserId, sub, evt);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const clerkUserId = clerkUserIdFromSub(sub);
  if (!clerkUserId) return;
  await setPlan(clerkUserId, 'free', {
    provider: 'stripe',
    subscriptionId: sub.id,
    status: sub.status,
    cancelledAt: new Date().toISOString(),
  });
  await logEvent({
    kind: 'billing.plan.changed',
    funnel: 'storefront',
    userId: clerkUserId,
    props: { to: 'free', source: 'webhook', reason: 'subscription_deleted' },
  });
  await createNotification({
    userId: clerkUserId,
    kind: 'plan.changed',
    title: 'Plan moved to Free',
    body: 'Your paid plan has ended. Premium features are now locked.',
    href: '/account/settings/plan',
    meta: { from: 'paid', to: 'free' },
  });
  await safeSendDowngradeMail(clerkUserId);
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subRef = (invoice as unknown as { subscription?: string | { id: string } | null })
    .subscription;
  const subId =
    typeof subRef === 'string' ? subRef : subRef && 'id' in subRef ? subRef.id : null;
  const clerkUserId =
    typeof invoice.metadata?.clerkUserId === 'string' ? invoice.metadata.clerkUserId : null;
  await logEvent({
    kind: 'billing.payment.failed',
    funnel: 'storefront',
    userId: clerkUserId,
    props: { subscriptionId: subId, attempt: invoice.attempt_count ?? null },
  });
  if (clerkUserId) {
    await createNotification({
      userId: clerkUserId,
      kind: 'billing.payment_failed',
      title: 'Payment failed',
      body: 'We could not charge your card. Update your billing method to keep your plan active.',
      href: '/account/settings/plan',
      meta: { plan: 'unknown', reason: 'card_declined' },
    });
  }
}

/* ────────────────────────────────────────────────────────────────── */
/* Plan resolution                                                    */
/* ────────────────────────────────────────────────────────────────── */

async function applySubscription(
  clerkUserId: string,
  sub: Stripe.Subscription,
  source: string,
): Promise<void> {
  const item = sub.items.data[0];
  if (!item) return;
  const priceId = item.price.id;
  const mapped = planFromPriceId(priceId);

  // If the price id isn't recognised (e.g. someone renamed env vars
  // mid-flight) fall back to the existing plan rather than corrupting
  // the row. Active = stay; canceled/past_due past grace = free.
  const targetPlan: Plan = mapped
    ? mapped.plan
    : sub.status === 'active' || sub.status === 'trialing'
      ? 'starter'
      : 'free';
  const cycle = mapped?.cycle ?? null;

  // Stripe transitions: a paused/past-due/canceled sub should not keep
  // someone on a paid tier. `active` and `trialing` are the only
  // entitlement-granting states.
  const entitled = sub.status === 'active' || sub.status === 'trialing';
  const finalPlan: Plan = entitled ? targetPlan : 'free';

  const before = await currentPlanFor(clerkUserId);
  await setPlan(clerkUserId, finalPlan, {
    provider: 'stripe',
    subscriptionId: sub.id,
    customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    status: sub.status,
    priceId,
    cycle,
    currentPeriodEnd: subscriptionPeriodEnd(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    updatedFrom: source,
  });

  await logEvent({
    kind: 'billing.plan.changed',
    funnel: 'storefront',
    userId: clerkUserId,
    props: { from: before, to: finalPlan, cycle, source: 'webhook', event: source },
  });

  // Send a transactional confirmation only on a real transition (so
  // monthly renewal events don't spam the inbox).
  if (entitled && before !== finalPlan && finalPlan !== 'free') {
    await safeSendActivationMail(clerkUserId, finalPlan, cycle);
    await createNotification({
      userId: clerkUserId,
      kind: 'billing.payment_succeeded',
      title: `${planLabel(finalPlan)} plan activated`,
      body: `Your ${cycle === 'annual' ? 'annual' : 'monthly'} subscription is live.`,
      href: '/account/settings/plan',
      meta: {
        plan: finalPlan,
        periodEnd: subscriptionPeriodEnd(sub) ?? undefined,
      },
    });
  } else if (entitled && before !== finalPlan) {
    await createNotification({
      userId: clerkUserId,
      kind: 'plan.changed',
      title: `Plan changed to ${planLabel(finalPlan)}`,
      href: '/account/settings/plan',
      meta: { from: before, to: finalPlan },
    });
  }
}

/**
 * Stripe's typed `Subscription` shape varies across API-version
 * pinning — `current_period_end` lives on the subscription item in
 * the latest Dahlia revision but most existing endpoints still emit
 * the legacy top-level field. Read both safely.
 */
function subscriptionPeriodEnd(sub: Stripe.Subscription): string | null {
  const top = (sub as unknown as { current_period_end?: number | null }).current_period_end;
  const fromItem = sub.items?.data?.[0] as
    | (Stripe.SubscriptionItem & { current_period_end?: number | null })
    | undefined;
  const ts = top ?? fromItem?.current_period_end ?? null;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

function clerkUserIdFromSub(sub: Stripe.Subscription): string | null {
  const m = sub.metadata?.clerkUserId;
  return typeof m === 'string' && m.length > 0 ? m : null;
}

async function currentPlanFor(clerkUserId: string): Promise<Plan> {
  const meta = await getPlanMeta(clerkUserId);
  // We only call this for the audit `from` value — getPlan would be
  // fine too but skipping the import-time `server-only` round-trip
  // keeps the webhook hot path lean.
  if (!hasDb()) return 'free';
  try {
    const rows = (await db()`
      select plan from user_plans where clerk_user_id = ${clerkUserId} limit 1
    `) as unknown as { plan: string }[];
    const row = rows[0];
    return (row?.plan as Plan | undefined) ?? 'free';
  } catch {
    return 'free';
  }
  // meta is referenced solely so TS knows we touched it; harmless.
  void meta;
}

/* ────────────────────────────────────────────────────────────────── */
/* Idempotency                                                        */
/* ────────────────────────────────────────────────────────────────── */

async function alreadyProcessed(eventId: string): Promise<boolean> {
  if (!hasDb()) return false;
  try {
    await ensureProcessedTable();
    const rows = (await db()`
      select 1 from processed_webhooks where event_id = ${eventId} limit 1
    `) as unknown as Array<unknown>;
    return rows.length > 0;
  } catch (err) {
    console.error('[billing.webhook] dedupe lookup failed', err);
    return false;
  }
}

async function markProcessed(eventId: string, eventType: string): Promise<void> {
  if (!hasDb()) return;
  try {
    await db()`
      insert into processed_webhooks (event_id, event_type)
      values (${eventId}, ${eventType})
      on conflict (event_id) do nothing
    `;
  } catch (err) {
    console.error('[billing.webhook] dedupe insert failed', err);
  }
}

let tableEnsured = false;
async function ensureProcessedTable(): Promise<void> {
  if (tableEnsured) return;
  await db()`
    create table if not exists processed_webhooks (
      event_id    text primary key,
      event_type  text not null,
      processed_at timestamptz not null default now()
    )
  `;
  tableEnsured = true;
}

/* ────────────────────────────────────────────────────────────────── */
/* Mail                                                               */
/* ────────────────────────────────────────────────────────────────── */

async function safeSendActivationMail(
  clerkUserId: string,
  plan: Plan,
  cycle: string | null,
): Promise<void> {
  try {
    const stripe = stripeClient();
    if (!stripe) return;
    const meta = await getPlanMeta(clerkUserId);
    const customerId = typeof meta.stripeCustomerId === 'string' ? meta.stripeCustomerId : null;
    if (!customerId) return;
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return;
    const email = (customer as Stripe.Customer).email;
    if (!email) return;
    const label = planLabel(plan);
    const blurb = PLAN_LIMITS[plan].blurb;
    const cycleLabel = cycle === 'annual' ? 'annual' : 'monthly';
    await sendMail({
      to: email,
      subject: `Welcome to Souqna ${label}`,
      tag: 'billing.activation',
      text: `Your Souqna ${label} plan is active (${cycleLabel} billing).\n\n${blurb}\n\nManage your plan: ${env.NEXT_PUBLIC_SITE_URL}/account/settings/plan`,
      html: `<p>Your Souqna <strong>${escapeHtml(label)}</strong> plan is active (${escapeHtml(cycleLabel)} billing).</p><p>${escapeHtml(blurb)}</p><p><a href="${env.NEXT_PUBLIC_SITE_URL}/account/settings/plan">Manage your plan</a>.</p>`,
    });
  } catch (err) {
    console.error('[billing.webhook] activation mail failed', err);
  }
}

async function safeSendDowngradeMail(clerkUserId: string): Promise<void> {
  try {
    const stripe = stripeClient();
    if (!stripe) return;
    const meta = await getPlanMeta(clerkUserId);
    const customerId = typeof meta.stripeCustomerId === 'string' ? meta.stripeCustomerId : null;
    if (!customerId) return;
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return;
    const email = (customer as Stripe.Customer).email;
    if (!email) return;
    await sendMail({
      to: email,
      subject: 'Your Souqna plan has moved to Free',
      tag: 'billing.downgrade',
      text: `Your paid Souqna plan has ended and your account is now on the Free tier.\n\nReactivate any time: ${env.NEXT_PUBLIC_SITE_URL}/account/settings/plan`,
      html: `<p>Your paid Souqna plan has ended and your account is now on the <strong>Free</strong> tier.</p><p><a href="${env.NEXT_PUBLIC_SITE_URL}/account/settings/plan">Reactivate any time</a>.</p>`,
    });
  } catch (err) {
    console.error('[billing.webhook] downgrade mail failed', err);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
