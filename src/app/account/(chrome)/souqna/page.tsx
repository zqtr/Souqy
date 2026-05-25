import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import {
  deleteSouqnaWebsite,
  featureSouqnaWebsite,
  removeSouqnaWebsite,
  restoreSouqnaWebsite,
  shutDownSpamWebsite,
  unfeatureSouqnaWebsite,
} from '@/app/actions/souqnaDiscover';
import { grantSouqnaUserPlan } from '@/app/actions/souqnaBilling';
import {
  markSouqnaFeeCollected,
  markSouqnaPayoutPaid,
  waiveSouqnaFee,
} from '@/app/actions/souqnaFinance';
import { EmptyState, PageHeader, StatusBadge, Surface } from '@/components/admin/primitives';
import { DeletedWebsitesToggle } from '@/components/admin/souqna/DeletedWebsitesToggle';
import {
  SouqnaActionButton,
  SouqnaReasonInput,
} from '@/components/admin/souqna/SouqnaActionControls';
import { listDiscoverAdminStorefronts, type DiscoverAdminStorefront } from '@/lib/discover';
import { listPlatformFinanceOverview } from '@/lib/platformFees';
import { PLAN_LIMITS, PLANS } from '@/lib/plans';
import { getSouqnaOperator } from '@/lib/souqna-operator';
import {
  listSouqnaSubscribers,
  subscriberKindLabel,
  type SouqnaSubscriber,
  type SouqnaSubscriberKind,
} from '@/lib/souqnaSubscriptions';

export const dynamic = 'force-dynamic';

type AccountSouqnaPageProps = {
  searchParams?: Promise<{ showDeleted?: string | string[] }>;
};

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(date: Date | null) {
  if (!date) return 'Not published';
  return new Intl.DateTimeFormat('en-QA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatOptionalDate(date: Date | null) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-QA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function SubscriberStatus({ kind }: { kind: SouqnaSubscriberKind }) {
  const tone =
    kind === 'paid'
      ? 'success'
      : kind === 'comped' || kind === 'legacy'
        ? 'info'
        : kind === 'pending_checkout'
          ? 'warning'
          : 'critical';

  return <StatusBadge tone={tone}>{subscriberKindLabel(kind)}</StatusBadge>;
}

function WebsiteStatus({ store }: { store: DiscoverAdminStorefront }) {
  if (store.isDeleted) return <StatusBadge tone="critical">deleted</StatusBadge>;
  if (store.isSpamShutdown) return <StatusBadge tone="critical">spam shut down</StatusBadge>;
  if (store.isHiddenFromDiscover)
    return <StatusBadge tone="warning">removed from Souqna</StatusBadge>;
  if (!store.isPublished) return <StatusBadge tone="neutral">unpublished</StatusBadge>;
  if (store.isFeatured) return <StatusBadge tone="success">featured</StatusBadge>;
  return <StatusBadge tone="info">eligible</StatusBadge>;
}

function WebsiteRow({ store }: { store: DiscoverAdminStorefront }) {
  const creatorName = store.founderName || store.businessName;
  const isDeleted = store.isDeleted;

  return (
    <Surface
      padding={16}
      style={
        isDeleted
          ? {
              borderColor: 'color-mix(in srgb, var(--color-maroon, #8b3a3a) 58%, transparent)',
              background:
                'linear-gradient(135deg, color-mix(in srgb, var(--color-maroon, #8b3a3a) 14%, transparent), var(--surface-overlay))',
              boxShadow:
                '0 0 0 1px color-mix(in srgb, var(--color-maroon, #8b3a3a) 18%, transparent) inset',
            }
          : undefined
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 1fr) minmax(180px, 0.7fr) auto',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 18, letterSpacing: 0 }}>{store.businessName}</h2>
            <WebsiteStatus store={store} />
          </div>
          <p style={{ margin: '6px 0 0', color: 'var(--ink-muted)', lineHeight: 1.45 }}>
            {store.tagline || store.domainLabel}
          </p>
          <div
            style={{
              marginTop: 12,
              borderRadius: 10,
              border: '1px solid color-mix(in srgb, var(--color-gold, #b89446) 28%, transparent)',
              background: 'color-mix(in srgb, var(--color-gold, #b89446) 9%, transparent)',
              padding: '10px 12px',
              display: 'grid',
              gap: 3,
              maxWidth: 520,
            }}
          >
            <div
              style={{
                color: 'var(--ink-muted)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              Created by
            </div>
            <div style={{ color: 'var(--ink-strong)', fontSize: 13.5, fontWeight: 700 }}>
              {creatorName}
            </div>
            <div style={{ color: 'var(--ink-muted)', fontSize: 12.5 }}>{store.contactEmail}</div>
            <code
              style={{
                color: 'var(--ink-muted)',
                fontSize: 11,
                overflowWrap: 'anywhere',
              }}
            >
              Clerk user: {store.ownerClerkUserId}
            </code>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginTop: 10,
              color: 'var(--ink-muted)',
              fontSize: 12,
            }}
          >
            <span>{store.slug}</span>
            <a
              href={store.liveUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--ink-strong)', textDecoration: 'none' }}
            >
              Visit website
            </a>
          </div>
        </div>

        <div style={{ color: 'var(--ink-muted)', fontSize: 12.5, lineHeight: 1.55 }}>
          <div>Published: {formatDate(store.publishedAt)}</div>
          <div>Created: {formatDate(store.createdAt)}</div>
          <div>Domain: {store.domainLabel}</div>
          {store.deletedAt ? (
            <div style={{ color: 'var(--color-maroon, #8b3a3a)', fontWeight: 800 }}>
              Deleted: {formatDate(store.deletedAt)}
            </div>
          ) : null}
          {store.deletedReason ? (
            <div style={{ color: 'var(--color-maroon, #8b3a3a)' }}>
              Delete reason: {store.deletedReason}
            </div>
          ) : null}
          {store.deletedBy ? <div>Deleted by: {store.deletedBy}</div> : null}
          {store.hiddenReason ? <div>Reason: {store.hiddenReason}</div> : null}
          {store.managedBy ? <div>Last managed by: {store.managedBy}</div> : null}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            flexWrap: 'wrap',
            maxWidth: 420,
          }}
        >
          <form
            action={async () => {
              'use server';
              await featureSouqnaWebsite({ slug: store.slug });
            }}
          >
            <SouqnaActionButton tone="primary" pendingLabel="Featuring...">
              Feature
            </SouqnaActionButton>
          </form>
          <form
            action={async () => {
              'use server';
              await unfeatureSouqnaWebsite({ slug: store.slug });
            }}
          >
            <SouqnaActionButton pendingLabel="Unfeaturing...">Unfeature</SouqnaActionButton>
          </form>
          <form
            action={async (formData) => {
              'use server';
              await removeSouqnaWebsite({
                slug: store.slug,
                reason: String(formData.get('reason') ?? ''),
              });
            }}
            style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}
          >
            <SouqnaReasonInput placeholder="Removal reason" />
            <SouqnaActionButton tone="danger" pendingLabel="Removing...">
              Remove
            </SouqnaActionButton>
          </form>
          <form
            action={async () => {
              'use server';
              await restoreSouqnaWebsite({ slug: store.slug });
            }}
          >
            <SouqnaActionButton pendingLabel="Restoring...">Restore</SouqnaActionButton>
          </form>
          <form
            action={async (formData) => {
              'use server';
              await deleteSouqnaWebsite({
                slug: store.slug,
                reason: String(formData.get('reason') ?? ''),
              });
            }}
            style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}
          >
            <SouqnaReasonInput placeholder="Delete reason" />
            <SouqnaActionButton tone="danger" pendingLabel="Deleting...">
              Delete website
            </SouqnaActionButton>
          </form>
          <form
            action={async (formData) => {
              'use server';
              await shutDownSpamWebsite({
                slug: store.slug,
                reason: String(formData.get('reason') ?? ''),
              });
            }}
            style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}
          >
            <SouqnaReasonInput placeholder="Spam reason" />
            <SouqnaActionButton tone="danger" pendingLabel="Shutting down...">
              Shut down spam
            </SouqnaActionButton>
          </form>
        </div>
      </div>
    </Surface>
  );
}

function SubscriberRow({ subscriber }: { subscriber: SouqnaSubscriber }) {
  const primaryStore = subscriber.stores[0];
  const source =
    subscriber.source ??
    subscriber.lastHistorySource ??
    (subscriber.provider ? `${subscriber.provider} metadata` : 'manual');

  return (
    <Surface padding={16}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 1.1fr) minmax(190px, 0.7fr) minmax(220px, 0.9fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 18, letterSpacing: 0 }}>{subscriber.planLabel}</h2>
            <SubscriberStatus kind={subscriber.kind} />
          </div>
          <div
            style={{ marginTop: 8, color: 'var(--ink-strong)', fontSize: 13.5, fontWeight: 700 }}
          >
            {subscriber.email ?? 'No email on storefront'}
          </div>
          <code
            style={{
              display: 'block',
              marginTop: 6,
              color: 'var(--ink-muted)',
              fontSize: 11,
              overflowWrap: 'anywhere',
            }}
          >
            Clerk user: {subscriber.clerkUserId}
          </code>
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginTop: 10,
              color: 'var(--ink-muted)',
              fontSize: 12,
            }}
          >
            <span>Source: {source}</span>
            {subscriber.paymentId ? <span>Payment: {subscriber.paymentId}</span> : null}
          </div>
        </div>

        <div style={{ color: 'var(--ink-muted)', fontSize: 12.5, lineHeight: 1.55 }}>
          <div>Provider: {subscriber.provider ?? 'manual'}</div>
          <div>Status: {subscriber.paymentStatus ?? subscriberKindLabel(subscriber.kind)}</div>
          <div>Cycle: {subscriber.cycle ?? '—'}</div>
          <div>Renews / ends: {formatOptionalDate(subscriber.currentPeriodEnd)}</div>
          <div>Updated: {formatOptionalDate(subscriber.updatedAt)}</div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: 'var(--ink-muted)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            Websites
          </div>
          {subscriber.stores.length > 0 ? (
            <div style={{ display: 'grid', gap: 7, marginTop: 8 }}>
              {subscriber.stores.slice(0, 4).map((store) => (
                <div
                  key={store.slug}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: store.isDeleted
                          ? 'var(--color-maroon, #8b3a3a)'
                          : 'var(--ink-strong)',
                        fontSize: 13,
                        fontWeight: 700,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {store.businessName}
                    </div>
                    <div style={{ color: 'var(--ink-muted)', fontSize: 11 }}>{store.slug}</div>
                  </div>
                  <a
                    href={store.liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: 'var(--ink-strong)',
                      fontSize: 12,
                      textDecoration: 'none',
                      flexShrink: 0,
                    }}
                  >
                    Open
                  </a>
                </div>
              ))}
              {subscriber.stores.length > 4 ? (
                <div style={{ color: 'var(--ink-muted)', fontSize: 12 }}>
                  +{subscriber.stores.length - 4} more websites
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ marginTop: 8, color: 'var(--ink-muted)', fontSize: 13 }}>
              No websites attached yet.
            </div>
          )}
          {primaryStore ? (
            <a
              href={`/account?store=${encodeURIComponent(primaryStore.slug)}`}
              style={{
                display: 'inline-flex',
                marginTop: 10,
                color: 'var(--ink-strong)',
                fontSize: 12.5,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Open owner dashboard
            </a>
          ) : null}
        </div>
      </div>
    </Surface>
  );
}

function SubscriptionOverview({ subscribers }: { subscribers: SouqnaSubscriber[] }) {
  const stats = {
    paid: subscribers.filter((subscriber) => subscriber.kind === 'paid').length,
    comped: subscribers.filter((subscriber) => subscriber.kind === 'comped').length,
    pending: subscribers.filter((subscriber) => subscriber.kind === 'pending_checkout').length,
    issues: subscribers.filter(
      (subscriber) => subscriber.kind === 'failed_checkout' || subscriber.kind === 'payment_issue',
    ).length,
  };

  return (
    <section style={{ display: 'grid', gap: 12, marginBottom: 26 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'end',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontFamily: 'var(--font-serif)', fontWeight: 500 }}>
            Subscriptions
          </h2>
          <p style={{ margin: '6px 0 0', color: 'var(--ink-muted)', fontSize: 13.5 }}>
            Track who is paid, who is comped, and which checkouts need attention.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 12,
        }}
      >
        {[
          ['Paid', stats.paid],
          ['Comped', stats.comped],
          ['Pending', stats.pending],
          ['Needs attention', stats.issues],
        ].map(([label, value]) => (
          <Surface key={label} padding={16}>
            <div style={{ color: 'var(--ink-muted)', fontSize: 12 }}>{label}</div>
            <div
              style={{
                marginTop: 6,
                fontFamily: 'var(--font-serif)',
                fontSize: 30,
                lineHeight: 1,
              }}
            >
              {value}
            </div>
          </Surface>
        ))}
      </div>

      {subscribers.length === 0 ? (
        <EmptyState
          eyebrow="No subscriptions"
          arEyebrow="لا توجد اشتراكات"
          title="No paid, granted, or pending billing rows yet."
          arTitle="لا توجد اشتراكات أو منح أو عمليات دفع معلقة بعد."
          body="When someone upgrades or starts checkout, the account will appear here with plan, payment, and website details."
          arBody="عندما يرقّي أحدهم أو يبدأ الدفع، سيظهر الحساب هنا مع الخطة والدفع والمواقع."
        />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {subscribers.map((subscriber) => (
            <SubscriberRow key={subscriber.clerkUserId} subscriber={subscriber} />
          ))}
        </div>
      )}
    </section>
  );
}

function SubscriptionLoading() {
  return (
    <section style={{ display: 'grid', gap: 12, marginBottom: 26 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontFamily: 'var(--font-serif)', fontWeight: 500 }}>
          Subscriptions
        </h2>
        <p style={{ margin: '6px 0 0', color: 'var(--ink-muted)', fontSize: 13.5 }}>
          Loading billing accounts...
        </p>
      </div>
      <Surface padding={18}>
        <div style={{ display: 'grid', gap: 10 }}>
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              style={{
                height: 52,
                borderRadius: 8,
                background:
                  'linear-gradient(90deg, color-mix(in srgb, var(--ink-strong) 6%, transparent), color-mix(in srgb, var(--ink-strong) 11%, transparent), color-mix(in srgb, var(--ink-strong) 6%, transparent))',
              }}
            />
          ))}
        </div>
      </Surface>
    </section>
  );
}

async function loadSouqnaSubscribersSafely() {
  const timeout = new Promise<SouqnaSubscriber[]>((resolve) => {
    setTimeout(() => resolve([]), 2500);
  });
  try {
    return await Promise.race([listSouqnaSubscribers(), timeout]);
  } catch (err) {
    console.error('[account/souqna] listSouqnaSubscribers failed', err);
    return [];
  }
}

async function SubscriptionPanel() {
  const subscribers = await loadSouqnaSubscribersSafely();
  return <SubscriptionOverview subscribers={subscribers} />;
}

function PlanGrantPanel() {
  return (
    <Surface padding={18} style={{ marginBottom: 18 }}>
      <form
        action={async (formData) => {
          'use server';
          const plan = String(formData.get('plan') ?? 'atelier') as (typeof PLANS)[number];
          await grantSouqnaUserPlan({
            clerkUserId: String(formData.get('clerkUserId') ?? ''),
            plan,
          });
        }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 1fr) minmax(150px, 180px) auto',
          gap: 10,
          alignItems: 'end',
        }}
      >
        <label style={{ display: 'grid', gap: 6, minWidth: 0 }}>
          <span
            style={{
              color: 'var(--ink-muted)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            Clerk user id
          </span>
          <input
            name="clerkUserId"
            required
            placeholder="user_..."
            style={{
              minHeight: 38,
              borderRadius: 8,
              border: '1px solid color-mix(in srgb, var(--ink-strong) 12%, transparent)',
              background: 'var(--surface-bg)',
              color: 'var(--ink-strong)',
              padding: '0 12px',
              fontSize: 13,
            }}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span
            style={{
              color: 'var(--ink-muted)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            Plan
          </span>
          <select
            name="plan"
            defaultValue="atelier"
            style={{
              minHeight: 38,
              borderRadius: 8,
              border: '1px solid color-mix(in srgb, var(--ink-strong) 12%, transparent)',
              background: 'var(--surface-bg)',
              color: 'var(--ink-strong)',
              padding: '0 10px',
              fontSize: 13,
            }}
          >
            {PLANS.map((plan) => (
              <option key={plan} value={plan}>
                {PLAN_LIMITS[plan].label}
              </option>
            ))}
          </select>
        </label>
        <SouqnaActionButton tone="primary" pendingLabel="Granting...">
          Grant plan
        </SouqnaActionButton>
      </form>
    </Surface>
  );
}

async function FinancePanel() {
  const finance = await listPlatformFinanceOverview(30);
  const pendingNet = finance.payouts.reduce((sum, payout) => sum + payout.netQar, 0);
  const receivableFees = finance.fees.reduce((sum, fee) => sum + fee.feeQar, 0);

  return (
    <Surface padding={18} style={{ marginBottom: 26 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'start',
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontFamily: 'var(--font-serif)', fontWeight: 500 }}>
            Platform fees and payouts
          </h2>
          <p style={{ margin: '6px 0 0', color: 'var(--ink-muted)', fontSize: 13.5 }}>
            Review Souqna-collected SkipCash payouts and offline fee receivables.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <StatusBadge tone="warning">Pending payouts: QAR {pendingNet}</StatusBadge>
          <StatusBadge tone="info">Receivable fees: QAR {receivableFees}</StatusBadge>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 14,
        }}
      >
        <div>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Seller payouts</h3>
          {finance.payouts.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 13 }}>
              No pending platform-collected payouts.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {finance.payouts.map((payout) => (
                <div
                  key={payout.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: 10,
                    alignItems: 'center',
                    border: '1px solid var(--surface-rule)',
                    borderRadius: 8,
                    padding: 10,
                  }}
                >
                  <div style={{ minWidth: 0, fontSize: 12.5, color: 'var(--ink-muted)' }}>
                    <div style={{ color: 'var(--ink-strong)', fontWeight: 700 }}>
                      {payout.storefrontSlug} - seller net QAR {payout.netQar}
                    </div>
                    <div>Gross QAR {payout.grossQar} - fee QAR {payout.feeQar}</div>
                    <code style={{ overflowWrap: 'anywhere' }}>{payout.orderId}</code>
                  </div>
                  <form
                    action={async () => {
                      'use server';
                      await markSouqnaPayoutPaid(payout.id);
                    }}
                  >
                    <SouqnaActionButton tone="primary" pendingLabel="Marking...">
                      Mark paid
                    </SouqnaActionButton>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Offline fee receivables</h3>
          {finance.fees.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 13 }}>
              No offline fees awaiting collection.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {finance.fees.map((fee) => (
                <div
                  key={fee.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: 10,
                    alignItems: 'center',
                    border: '1px solid var(--surface-rule)',
                    borderRadius: 8,
                    padding: 10,
                  }}
                >
                  <div style={{ minWidth: 0, fontSize: 12.5, color: 'var(--ink-muted)' }}>
                    <div style={{ color: 'var(--ink-strong)', fontWeight: 700 }}>
                      {fee.storefrontSlug} - fee QAR {fee.feeQar}
                    </div>
                    <div>Gross QAR {fee.grossQar} - {fee.feeBps / 100}% - {fee.collectionMode}</div>
                    <code style={{ overflowWrap: 'anywhere' }}>{fee.orderId}</code>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'end' }}>
                    <form
                      action={async () => {
                        'use server';
                        await markSouqnaFeeCollected(fee.id);
                      }}
                    >
                      <SouqnaActionButton tone="primary" pendingLabel="Collecting...">
                        Collected
                      </SouqnaActionButton>
                    </form>
                    <form
                      action={async () => {
                        'use server';
                        await waiveSouqnaFee(fee.id);
                      }}
                    >
                      <SouqnaActionButton pendingLabel="Waiving...">Waive</SouqnaActionButton>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Surface>
  );
}

export default async function AccountSouqnaPage({ searchParams }: AccountSouqnaPageProps) {
  const operator = await getSouqnaOperator();
  if (!operator) notFound();

  const sp = (await searchParams) ?? {};
  const showDeleted = getSearchParamValue(sp.showDeleted) === '1';
  const stores = await listDiscoverAdminStorefronts();
  const visibleStores = showDeleted ? stores : stores.filter((store) => !store.isDeleted);
  const stats = {
    total: stores.length,
    featured: stores.filter((store) => store.isFeatured).length,
    hidden: stores.filter((store) => store.isHiddenFromDiscover).length,
    spam: stores.filter((store) => store.isSpamShutdown).length,
    deleted: stores.filter((store) => store.isDeleted).length,
  };

  return (
    <>
      <PageHeader
        eyebrow="Souqna operator"
        arEyebrow="إدارة سوقنا"
        title="Souqna Discover"
        arTitle="اكتشاف سوقنا"
        subtitle="Manage the public Souqna page: feature websites, remove low-quality listings, and shut down spam."
        arSubtitle="إدارة صفحة سوقنا العامة: تمييز المواقع، إزالة القوائم غير المناسبة، وإيقاف السبام."
        primaryAction={{
          label: 'Open public page',
          arLabel: 'افتح الصفحة العامة',
          href: '/souqna',
        }}
      />

      <PlanGrantPanel />
      <FinancePanel />

      <Suspense fallback={<SubscriptionLoading />}>
        <SubscriptionPanel />
      </Suspense>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        {[
          ['Websites', stats.total],
          ['Featured', stats.featured],
          ['Removed', stats.hidden],
          ['Spam shut down', stats.spam],
          ['Deleted', stats.deleted],
        ].map(([label, value]) => (
          <Surface key={label} padding={16}>
            <div style={{ color: 'var(--ink-muted)', fontSize: 12 }}>{label}</div>
            <div
              style={{
                marginTop: 6,
                fontFamily: 'var(--font-serif)',
                fontSize: 30,
                lineHeight: 1,
              }}
            >
              {value}
            </div>
          </Surface>
        ))}
      </div>

      <DeletedWebsitesToggle
        checked={showDeleted}
        deletedCount={stats.deleted}
        visibleCount={visibleStores.length}
        totalCount={stores.length}
      />

      {stores.length === 0 ? (
        <EmptyState
          eyebrow="No websites"
          arEyebrow="لا توجد مواقع"
          title="No storefronts are ready to manage yet."
          arTitle="لا توجد متاجر جاهزة للإدارة بعد."
          body="When Souqna storefronts exist, ceo@souqna.qa can manage featuring and moderation here."
          arBody="عندما توجد متاجر في سوقنا، يستطيع ceo@souqna.qa إدارة التمييز والمراجعة هنا."
        />
      ) : visibleStores.length === 0 ? (
        <Surface padding={18}>
          <div style={{ color: 'var(--ink-strong)', fontSize: 14, fontWeight: 700 }}>
            Deleted websites are hidden.
          </div>
          <p style={{ margin: '6px 0 0', color: 'var(--ink-muted)', fontSize: 13 }}>
            Turn on Show deleted websites to review deleted storefronts.
          </p>
        </Surface>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {visibleStores.map((store) => (
            <WebsiteRow key={store.slug} store={store} />
          ))}
        </div>
      )}
    </>
  );
}
