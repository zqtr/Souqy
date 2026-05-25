import type { Locale } from '@/i18n/locales';

type Props = {
  locale: Locale;
  /** When true, displays a small "Verified" chip alongside the signature.
   *  Souqna verifies a storefront once a CR (Commercial Registration)
   *  number has been recorded against it. We never show the CR itself. */
  verified?: boolean;
};

/**
 * Permanent footer band on every public storefront. It is rendered
 * outside the block tree so a founder can never delete or hide it from
 * the builder — the brand attribution belongs to Souqna, not to the
 * storefront's editable content.
 *
 * The styling intentionally hugs the page edges (no max-width container)
 * so the band reads as platform chrome rather than the storefront's own
 * footer.
 */
export function SouqnaSignature({ locale, verified = false }: Props) {
  const isRtl = locale === 'ar';
  const built = isRtl ? 'صُنع في' : 'Built on';
  const verifiedLabel = isRtl ? 'موثّق' : 'Verified';

  return (
    <footer
      data-souqna-signature
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        marginTop: 'clamp(32px, 6vw, 64px)',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        flexWrap: 'wrap',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'color-mix(in srgb, var(--sf-ink) 50%, transparent)',
      }}
    >
      <a
        href="https://souqna.qa"
        target="_blank"
        rel="noreferrer noopener"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: 'inherit',
          textDecoration: 'none',
        }}
      >
        <span aria-hidden style={{ color: 'var(--sf-accent)' }}>◈</span>
        <span>{built}</span>
        <span style={{ color: 'var(--sf-ink)', fontWeight: 500 }}>Souqna</span>
      </a>

      {verified ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 999,
            border: '1px solid color-mix(in srgb, var(--sf-accent) 50%, transparent)',
            color: 'var(--sf-accent)',
            background: 'color-mix(in srgb, var(--sf-accent) 8%, transparent)',
            fontSize: 9,
          }}
        >
          <span aria-hidden>✓</span>
          {verifiedLabel}
        </span>
      ) : null}
    </footer>
  );
}
