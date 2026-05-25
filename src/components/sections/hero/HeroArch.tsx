import { palette } from '@/lib/tokens';
import type { Locale } from '@/i18n/locales';

type Props = {
  locale: Locale;
};

/**
 * The three-arch watermark that anchors the hero. Sits in the trailing
 * margin (right in LTR, left in RTL) so the headline reads into it.
 */
export function HeroArch({ locale }: Props) {
  const isRtl = locale === 'ar';
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-[6vh] hidden md:block"
      style={{
        width: '42vw',
        height: '72vh',
        opacity: 0.55,
        right: isRtl ? 'auto' : '-8vw',
        left: isRtl ? '-8vw' : 'auto',
        transform: isRtl ? 'scaleX(-1)' : undefined,
      }}
    >
      <svg viewBox="0 0 400 600" width="100%" height="100%" fill="none" preserveAspectRatio="xMidYMid meet">
        <path
          d="M 40 560 L 40 260 A 160 160 0 0 1 360 260 L 360 560"
          stroke={palette.gold}
          strokeWidth="1"
          opacity="0.6"
        />
        <path
          d="M 80 560 L 80 280 A 120 120 0 0 1 320 280 L 320 560"
          stroke={palette.gold}
          strokeWidth="1"
          opacity="0.35"
        />
        <path
          d="M 120 560 L 120 300 A 80 80 0 0 1 280 300 L 280 560"
          stroke={palette.gold}
          strokeWidth="1"
          opacity="0.22"
        />
        <circle cx="200" cy="90" r="2" fill={palette.gold} />
      </svg>
    </div>
  );
}
