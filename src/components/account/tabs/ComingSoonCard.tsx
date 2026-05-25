import type { ReactNode } from 'react';
import Link from 'next/link';

type Bullet = {
  title: string;
  detail?: string;
};

type Props = {
  /** Big serif title at the top of the card. */
  title: string;
  /** One-line tagline shown directly under the title. */
  tagline: string;
  /** Eyebrow above the title. Defaults to "Roadmap". */
  eyebrow?: string;
  /** Optional richer body — supplements `tagline`. */
  intro?: ReactNode;
  /** Roadmap items rendered as a checklist of "planned" features. */
  bullets: Bullet[];
  /** Optional CTA pinned to the bottom of the card. */
  cta?: { label: string; href: string };
  /** Optional extra slot rendered below the bullets (e.g. integrations grid). */
  children?: ReactNode;
};

/**
 * Roadmap placeholder card used by the Orders / Billing / Integrations
 * tabs. Designed to feel like a "preview" of the future surface — sand
 * canvas, dashed gold border, gold eyebrow chip — so a founder landing
 * on these tabs gets a clear answer to "what's coming, and when?".
 */
export function ComingSoonCard({
  title,
  tagline,
  eyebrow = 'Roadmap',
  intro,
  bullets,
  cta,
  children,
}: Props) {
  return (
    <section
      style={{
        border: '1px dashed var(--surface-rule-strong)',
        borderRadius: 12,
        padding: 'clamp(24px, 4vw, 36px)',
        background: 'var(--surface-elevated)',
        display: 'grid',
        gap: 22,
      }}
    >
      <header>
        <div
          className="flex items-center"
          style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--ink-on-gold)',
              background: 'var(--color-gold)',
              padding: '4px 10px',
              borderRadius: 999,
            }}
          >
            {eyebrow}
          </span>
          <span
            aria-hidden
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--ink-faint)',
            }}
          >
            Coming soon
          </span>
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 400,
            fontSize: 'clamp(26px, 3.5vw, 36px)',
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
            margin: '0 0 8px',
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: 'var(--ink-muted)',
            margin: 0,
            maxWidth: 560,
          }}
        >
          {tagline}
        </p>
        {intro ? (
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: 'var(--ink-muted)',
              marginTop: 12,
              maxWidth: 620,
            }}
          >
            {intro}
          </div>
        ) : null}
      </header>

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'grid',
          gap: 10,
        }}
      >
        {bullets.map((b) => (
          <li
            key={b.title}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: 12,
              alignItems: 'baseline',
              fontSize: 14,
              lineHeight: 1.55,
              color: 'var(--ink-strong)',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                border: '1px solid var(--surface-rule-strong)',
                background: 'var(--surface-bg)',
                display: 'inline-block',
                marginTop: 2,
              }}
            />
            <div>
              <span style={{ fontWeight: 500 }}>{b.title}</span>
              {b.detail ? (
                <span style={{ color: 'var(--ink-muted)' }}> — {b.detail}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {children}

      {cta ? (
        <div>
          <Link
            href={cta.href}
            style={{
              display: 'inline-block',
              border: '1px solid var(--surface-rule-strong)',
              padding: '10px 18px',
              borderRadius: 999,
              fontSize: 13,
              color: 'var(--ink-strong)',
              textDecoration: 'none',
            }}
          >
            {cta.label}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
