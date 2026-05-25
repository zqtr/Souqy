import { PageHeader, Surface, StatusBadge } from './primitives';

type Bullet = { title: string; body: string };

/**
 * Shared "coming soon" placeholder for settings sub-screens that have a
 * UI sketch but no working backend yet (Payments, Checkout, Shipping,
 * Taxes, Files, Custom data, Markets). Each placeholder lists what the
 * surface will do so the founder knows the roadmap, with a clear
 * "Notify me" mailto fallback.
 */
export function SoonScreen({
  eyebrow,
  title,
  subtitle,
  whatItDoes,
  primaryActionHref = 'mailto:support@souqna.qa',
  primaryActionLabel = 'Tell us you want this',
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  whatItDoes: Bullet[];
  primaryActionHref?: string;
  primaryActionLabel?: string;
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <Surface padding={28}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <StatusBadge tone="neutral">coming soon</StatusBadge>
          <span style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
            On the roadmap. Open to your input.
          </span>
        </div>
        <h2
          style={{
            margin: '0 0 14px',
            fontFamily: 'var(--font-serif, var(--font-sans))',
            fontWeight: 400,
            fontSize: 21,
            color: 'var(--ink-strong)',
            letterSpacing: '-0.01em',
          }}
        >
          When this lands, you&rsquo;ll be able to
        </h2>
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 14,
          }}
        >
          {whatItDoes.map((b) => (
            <li
              key={b.title}
              style={{
                padding: 16,
                borderRadius: 10,
                background: 'color-mix(in srgb, var(--ink-strong) 4%, transparent)',
                border: '1px solid color-mix(in srgb, var(--ink-strong) 7%, transparent)',
              }}
            >
              <strong
                style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--ink-strong)',
                  marginBottom: 4,
                }}
              >
                {b.title}
              </strong>
              <span style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                {b.body}
              </span>
            </li>
          ))}
        </ul>
        <a
          href={primaryActionHref}
          style={{
            marginTop: 18,
            display: 'inline-flex',
            alignItems: 'center',
            padding: '10px 18px',
            borderRadius: 8,
            background: 'var(--ink-strong)',
            color: 'var(--surface-bg)',
            fontSize: 13.5,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          {primaryActionLabel}
        </a>
      </Surface>
    </>
  );
}
