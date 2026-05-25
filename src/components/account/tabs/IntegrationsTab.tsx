import { ComingSoonCard } from './ComingSoonCard';

type Integration = {
  name: string;
  blurb: string;
  /** A short two-letter monogram drawn into the placeholder tile. */
  monogram: string;
};

const INTEGRATIONS: Integration[] = [
  { name: 'Stripe', blurb: 'International card checkout', monogram: 'st' },
  { name: 'Tap', blurb: 'Cards, Apple Pay, Mada (Qatar)', monogram: 'tp' },
  { name: 'Instagram', blurb: 'Catalog & DM sync', monogram: 'ig' },
  { name: 'WhatsApp Business', blurb: 'Customer messaging API', monogram: 'wa' },
  { name: 'Google Analytics 4', blurb: 'Visits & conversions', monogram: 'ga' },
  { name: 'Custom domain', blurb: 'Bring your own CNAME', monogram: 'dn' },
  { name: 'Zapier', blurb: 'Outbound webhooks to 6,000+ apps', monogram: 'zp' },
  { name: 'Mailchimp', blurb: 'Capture emails to a list', monogram: 'mc' },
];

/**
 * Integrations tab — visually previews the future surface so it doesn't
 * feel like an empty page. Each tile is a disabled "Connect" row that
 * shows what's planned and roughly when it lands.
 */
export function IntegrationsTab() {
  return (
    <ComingSoonCard
      title="Integrations."
      tagline="Plug Souqna into the tools you already use — payments, messaging, analytics, marketing — without leaving your dashboard."
      intro={
        <>
          We're building integrations in the order founders actually need them:
          Tap and Stripe first (so checkout works), then the messaging stack
          (Instagram, WhatsApp), then everything you'd want for growth.
        </>
      }
      bullets={[
        {
          title: 'OAuth-based',
          detail: 'no copy-pasting API keys — connect and disconnect with one click.',
        },
        {
          title: 'Per-storefront',
          detail:
            'each storefront picks its own integrations; nothing is forced account-wide.',
        },
        {
          title: 'Webhooks out',
          detail:
            'subscribe to order, product, and storefront events from your own backend.',
        },
      ]}
    >
      <div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--ink-faint)',
            marginBottom: 12,
          }}
        >
          Planned · {INTEGRATIONS.length}
        </div>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 10,
          }}
        >
          {INTEGRATIONS.map((it) => (
            <li
              key={it.name}
              style={{
                border: '1px solid var(--surface-rule)',
                borderRadius: 10,
                padding: '12px 14px',
                background: 'var(--surface-bg)',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--surface-rule)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-faint)',
                }}
              >
                {it.monogram}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--ink-strong)',
                    lineHeight: 1.2,
                  }}
                >
                  {it.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-muted)',
                    lineHeight: 1.3,
                    marginTop: 2,
                  }}
                >
                  {it.blurb}
                </div>
              </div>
              <span
                aria-disabled
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-faint)',
                  border: '1px solid var(--surface-rule)',
                  padding: '4px 8px',
                  borderRadius: 999,
                }}
              >
                Soon
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ComingSoonCard>
  );
}
