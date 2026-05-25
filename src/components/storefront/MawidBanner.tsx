import {
  getMawidSettings,
  getEventById,
  mawidPhase,
} from '@/lib/apps/mawid';
import { MawidCountdown } from './blocks/MawidCountdown';

/**
 * Optional global top banner powered by the Mawid plugin.
 *
 * When the founder enables `globalBanner.enabled` and pins an event,
 * we render a thin strip at the very top of every storefront page
 * with a compact countdown. The banner is bilingual and reads its
 * accent + label copy directly from the pinned event's settings, so
 * everything is owner-customizable.
 *
 * Renders nothing when:
 *   - The Mawid app isn't installed for this storefront,
 *   - The plugin or pinned event is disabled,
 *   - The pinned event has already ended and is set to auto-hide.
 */
export async function MawidBanner({
  storefrontSlug,
  installedAppIds,
  locale,
}: {
  storefrontSlug: string;
  installedAppIds: string[];
  locale: string;
}) {
  if (!installedAppIds.includes('mawid')) return null;
  const settings = await getMawidSettings(storefrontSlug);
  if (!settings.enabled || !settings.globalBanner.enabled) return null;
  const eventId = settings.globalBanner.eventId;
  if (!eventId) return null;
  const event = getEventById(settings, eventId);
  if (!event || !event.enabled) return null;
  const phase = mawidPhase(event, new Date());
  if (phase === 'ended' && event.postLaunch === 'hide') return null;
  if (phase === 'pre' && event.preLaunch === 'hide') return null;

  const isAr = locale === 'ar';
  const label = phase === 'pre'
    ? isAr ? event.countdown.labelAr : event.countdown.labelEn
    : isAr ? event.countdown.finishedAr : event.countdown.finishedEn;
  const accentCss = event.countdown.accent.startsWith('--')
    ? `var(${event.countdown.accent})`
    : event.countdown.accent;

  return (
    <div
      role="region"
      aria-label="Scheduled drop"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: '8px 16px',
        background: 'var(--sf-ink)',
        color: 'var(--sf-ground)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        letterSpacing: '0.08em',
        borderBottom: `1px solid ${accentCss}`,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ color: accentCss, textTransform: 'uppercase' }}>◷ {label}</span>
      {phase === 'pre' ? (
        <MawidCountdown
          targetIso={event.startsAt}
          variant="inline"
          size="sm"
          accent={event.countdown.accent}
          showDays={event.countdown.showDays}
          showHours={event.countdown.showHours}
          showMinutes={event.countdown.showMinutes}
          showSeconds={event.countdown.showSeconds}
          locale={locale}
        />
      ) : null}
      {event.name ? <span style={{ opacity: 0.85 }}>{event.name}</span> : null}
    </div>
  );
}
