import type { TemplateProps } from '../Storefront';
import { StorefrontTopRail, StorefrontFooter } from '../StorefrontChrome';
import { StorefrontHero } from '../StorefrontHero';
import { StorefrontPractical } from '../StorefrontPractical';
import { InquireButton } from '../InquireButton';

/**
 * Generic archetype — Atrium-style centered layout, products rendered as a
 * single-column list of plain rows. Used by `something_else` and as the
 * fallback when a new business type lands without an explicit archetype.
 */
export function Generic({ data, vocabulary, products }: TemplateProps) {
  const isRtl = data.locale === 'ar';
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const serifFamily = isRtl ? 'var(--font-arabic-serif), serif' : 'var(--font-serif), serif';

  return (
    <main
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={data.locale}
      style={{
        fontFamily,
        padding: 'clamp(40px, 6vw, 96px) clamp(20px, 5vw, 64px)',
      }}
    >
      <div className="mx-auto" style={{ maxWidth: 920 }}>
        <StorefrontTopRail storefront={data} />
        <StorefrontHero data={data} vocabulary={vocabulary} variant="centered" />

        {products.length > 0 ? (
          <section style={{ marginTop: 'clamp(24px, 4vw, 48px)' }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--sf-accent)',
                marginBottom: 28,
                textAlign: 'center',
              }}
            >
              {vocabulary.offerLabel}
            </div>
            <ul
              className="m-0 p-0 flex flex-col"
              style={{ listStyle: 'none', gap: 0 }}
            >
              {products.map((p) => (
                <li
                  key={p.id}
                  style={{
                    padding: '20px 0',
                    borderBottom:
                      '1px solid color-mix(in srgb, var(--sf-ink) 12%, transparent)',
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: serifFamily,
                      fontStyle: 'italic',
                      fontWeight: 400,
                      fontSize: 'clamp(20px, 2.4vw, 26px)',
                      lineHeight: 1.2,
                    }}
                  >
                    {p.title}
                  </h3>
                  {p.description ? (
                    <p
                      style={{
                        margin: '8px 0 0',
                        fontFamily,
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: 'color-mix(in srgb, var(--sf-ink) 70%, transparent)',
                      }}
                    >
                      {p.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}>
              <InquireButton storefront={data} />
            </div>
          </section>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <InquireButton storefront={data} variant="primary" />
          </div>
        )}

        <StorefrontPractical data={data} vocabulary={vocabulary} />
        <StorefrontFooter storefront={data} />
      </div>
    </main>
  );
}
