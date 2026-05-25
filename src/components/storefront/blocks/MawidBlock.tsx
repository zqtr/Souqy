import type { BlockRenderProps } from './BlockContext';
import type { MawidBlockProps } from '@/lib/blocks/types';
import { getInstalledApp } from '@/lib/apps/installed';
import {
  getMawidSettings,
  getEventById,
  mawidPhase,
  DEFAULT_MAWID_COUNTDOWN,
  type MawidEvent,
  type MawidVariant,
} from '@/lib/apps/mawid';
import { MawidCountdown } from './MawidCountdown';

/**
 * Server-rendered Mawid (scheduled drops + countdowns) block.
 *
 * The block carries only an `eventId`; everything else is read live
 * from `app_state` so the founder can edit a moment in the dashboard
 * without re-publishing the page. Phase resolution happens entirely
 * by clock — there is no waitlist surface here (that's drop-manager's
 * job). The countdown ticks client-side from a server-supplied
 * `targetIso` so visitors with a skewed clock don't see ghosts.
 */
export async function MawidBlock({ block, ctx }: BlockRenderProps<MawidBlockProps>) {
  const slug = ctx.storefront.slug;
  const eventId = block.props.eventId;
  const fallbackTarget = resolveBlockTarget(block.props.startsAt);
  const product = block.props.productId
    ? ctx.products.find((p) => p.id === block.props.productId)
    : null;

  const installed = await getInstalledApp(slug, 'mawid').catch(() => null);
  if (!installed || !installed.enabled) {
    return ctx.isPreview ? (
      <MawidSetupCard
        title="Install Mawid to publish this countdown"
        body="This builder block is ready. Install Mawid from Apps, then choose a product and launch time here."
      />
    ) : null;
  }

  const settings = await getMawidSettings(slug);
  if (!settings.enabled) {
    return ctx.isPreview ? (
      <MawidSetupCard title="Mawid is disabled" body="Enable Mawid in Apps to show this countdown publicly." />
    ) : null;
  }
  const event = eventId ? getEventById(settings, eventId) : null;
  if (event && !event.enabled) return ctx.isPreview ? (
    <MawidSetupCard title="This Mawid event is disabled" body="Enable the event, or use the block-level time controls." />
  ) : null;
  if (eventId && !event) {
    return ctx.isPreview ? (
      <MawidSetupCard title="Choose a Mawid event" body="The saved event id was not found. Pick another event or use the launch time field." />
    ) : null;
  }
  if (!event && !fallbackTarget) {
    return ctx.isPreview ? (
      <MawidSetupCard title="Set a launch time" body="Pick a product and a launch time in the inspector to make this countdown visible." />
    ) : null;
  }

  const now = new Date();
  const phase = event ? mawidPhase(event, now) : Date.parse(fallbackTarget!) > now.getTime() ? 'pre' : 'live';
  if (event && phase === 'pre' && event.preLaunch === 'hide') return null;
  if (event && phase === 'ended' && event.postLaunch === 'hide') return null;

  const isAr = ctx.isRtl;
  const countdown = event?.countdown ?? DEFAULT_MAWID_COUNTDOWN;
  const heading =
    block.props.heading?.trim() ||
    product?.title ||
    (phase === 'pre'
      ? isAr
        ? countdown.labelAr
        : countdown.labelEn
      : isAr
        ? countdown.finishedAr
        : countdown.finishedEn);
  const subheading = block.props.subheading?.trim();
  const variant = block.props.variant ?? countdown.variant;
  const accent = countdown.accent;

  return (
    <section
      style={{
        ...variantShell(variant, accent),
      }}
    >
      {product?.imageUrl && variant !== 'inline' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt={product.title}
          style={{
            width: variant === 'banner' ? 74 : 96,
            height: variant === 'banner' ? 74 : 96,
            objectFit: 'cover',
            borderRadius: variant === 'banner' ? 14 : 18,
            flex: '0 0 auto',
          }}
        />
      ) : null}
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: accent.startsWith('--') ? `var(${accent})` : accent,
          }}
        >
          ◷ {event ? phaseLabel(phase, event, isAr) : phase === 'pre' ? (isAr ? 'يبدأ خلال' : 'Live in') : (isAr ? 'متاح الآن' : 'Live now')}
        </span>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-serif, var(--font-sans))',
            fontWeight: 'var(--sf-heading-weight, 400)' as unknown as number,
            fontSize: 'clamp(24px, 3vw, 36px)',
            lineHeight: 1.15,
            color: 'var(--sf-ink)',
          }}
        >
          {heading}
        </h2>
        {subheading ? (
          <p
            style={{
              margin: 0,
              fontSize: 14.5,
              color: 'color-mix(in srgb, var(--sf-ink) 70%, transparent)',
              maxWidth: 640,
            }}
          >
            {subheading}
          </p>
        ) : null}
      </header>

      {phase === 'pre' && (!event || event.preLaunch !== 'hide') ? (
        <MawidCountdown
          targetIso={event?.startsAt ?? fallbackTarget!}
          variant={variant}
          size={countdown.size}
          accent={accent}
          showDays={countdown.showDays}
          showHours={countdown.showHours}
          showMinutes={countdown.showMinutes}
          showSeconds={countdown.showSeconds}
          locale={ctx.storefront.locale}
        />
      ) : null}

      {phase === 'live' && event?.scheduledPrice ? (
        <PriceBadge
          price={event.scheduledPrice.price}
          compareAt={event.scheduledPrice.compareAt}
          isAr={isAr}
        />
      ) : null}
    </section>
  );
}

function resolveBlockTarget(startsAt?: string): string | null {
  if (!startsAt) return null;
  const parsed = Date.parse(startsAt);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function variantShell(variant: MawidVariant, accent: string): React.CSSProperties {
  const accentCss = accent.startsWith('--') ? `var(${accent})` : accent;
  const base: React.CSSProperties = {
    display: 'flex',
    gap: 16,
    alignItems: 'flex-start',
  };
  if (variant === 'inline') {
    return { ...base, flexDirection: 'column' };
  }
  if (variant === 'banner') {
    return {
      ...base,
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 18,
      borderRadius: 18,
      background: `color-mix(in srgb, ${accentCss} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${accentCss} 34%, transparent)`,
    };
  }
  return { ...base, flexDirection: 'column' };
}

function MawidSetupCard({ title, body }: { title: string; body: string }) {
  return (
    <section
      style={{
        display: 'grid',
        gap: 8,
        padding: 18,
        borderRadius: 16,
        border: '1px dashed color-mix(in srgb, var(--sf-accent) 48%, transparent)',
        background: 'color-mix(in srgb, var(--sf-accent) 10%, transparent)',
        color: 'var(--sf-ink)',
      }}
    >
      <strong style={{ fontFamily: 'var(--font-serif, var(--font-sans))', fontSize: 22 }}>
        ◷ {title}
      </strong>
      <p style={{ margin: 0, fontSize: 14, color: 'color-mix(in srgb, var(--sf-ink) 68%, transparent)' }}>
        {body}
      </p>
    </section>
  );
}

function phaseLabel(
  phase: 'pre' | 'live' | 'ended',
  event: MawidEvent,
  isAr: boolean,
): string {
  if (phase === 'pre') return isAr ? event.countdown.labelAr : event.countdown.labelEn;
  if (phase === 'live') return isAr ? event.countdown.finishedAr : event.countdown.finishedEn;
  return isAr ? 'انتهى' : 'Ended';
}

function PriceBadge({
  price,
  compareAt,
  isAr,
}: {
  price: number;
  compareAt?: number;
  isAr: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        padding: '10px 16px',
        borderRadius: 10,
        background: 'color-mix(in srgb, var(--sf-accent) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--sf-accent) 40%, transparent)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          letterSpacing: '0.06em',
          color: 'var(--sf-accent)',
        }}
      >
        {isAr ? 'سعر الإطلاق' : 'Launch price'}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-serif, var(--font-sans))',
          fontSize: 18,
          color: 'var(--sf-ink)',
        }}
      >
        {price.toFixed(2)} QAR
      </span>
      {typeof compareAt === 'number' && compareAt > price ? (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'color-mix(in srgb, var(--sf-ink) 55%, transparent)',
            textDecoration: 'line-through',
          }}
        >
          {compareAt.toFixed(2)}
        </span>
      ) : null}
    </div>
  );
}
