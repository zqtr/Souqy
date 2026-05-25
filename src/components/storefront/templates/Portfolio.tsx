import type { TemplateProps } from '../Storefront';
import { StorefrontTopRail, StorefrontFooter } from '../StorefrontChrome';
import { StorefrontHero } from '../StorefrontHero';
import { StorefrontPractical } from '../StorefrontPractical';
import { InquireButton } from '../InquireButton';

/**
 * Portfolio archetype — large project cards with a wide cover image, title,
 * caption, and optional category tag. Used by graphic_design / contracting /
 * real_estate.
 */
export function Portfolio({ data, vocabulary, products }: TemplateProps) {
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
      <div className="mx-auto" style={{ maxWidth: 1100 }}>
        <StorefrontTopRail storefront={data} />
        <StorefrontHero data={data} vocabulary={vocabulary} variant="inline" />

        {products.length > 0 ? (
          <section style={{ marginTop: 'clamp(24px, 4vw, 48px)' }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--sf-accent)',
                marginBottom: 24,
                textAlign: isRtl ? 'right' : 'left',
              }}
            >
              {vocabulary.offerLabel}
            </div>
            <div className="flex flex-col" style={{ gap: 'clamp(36px, 5vw, 64px)' }}>
              {products.map((p) => (
                <article
                  key={p.id}
                  className="grid"
                  style={{
                    gap: 'clamp(20px, 3vw, 36px)',
                    gridTemplateColumns:
                      'minmax(0, 1.2fr) minmax(0, 1fr)',
                    alignItems: 'start',
                  }}
                >
                  <div
                    style={{
                      aspectRatio: '4 / 3',
                      background: 'color-mix(in srgb, var(--sf-ink) 6%, transparent)',
                      border:
                        '1px solid color-mix(in srgb, var(--sf-accent) 18%, transparent)',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt={p.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: 'color-mix(in srgb, var(--sf-ink) 45%, transparent)',
                        }}
                      >
                        {isRtl ? 'بدون صورة' : 'no image'}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col" style={{ gap: 14 }}>
                    {p.category ? (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          color: 'var(--sf-accent)',
                        }}
                      >
                        {p.category}
                      </span>
                    ) : null}
                    <h3
                      style={{
                        margin: 0,
                        fontFamily: serifFamily,
                        fontStyle: 'italic',
                        fontWeight: 400,
                        fontSize: 'clamp(22px, 3vw, 34px)',
                        lineHeight: 1.15,
                      }}
                    >
                      {p.title}
                    </h3>
                    {p.description ? (
                      <p
                        style={{
                          margin: 0,
                          fontFamily,
                          fontSize: 15,
                          lineHeight: 1.6,
                          color: 'color-mix(in srgb, var(--sf-ink) 75%, transparent)',
                        }}
                      >
                        {p.description}
                      </p>
                    ) : null}
                    {p.priceQar !== null ? (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          letterSpacing: '0.06em',
                          color: 'var(--sf-accent)',
                        }}
                      >
                        {formatPrice(p.priceQar, isRtl)}
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 56 }}>
              <InquireButton storefront={data} variant="primary" />
            </div>
          </section>
        ) : (
          <EmptyState isRtl={isRtl} />
        )}

        <StorefrontPractical data={data} vocabulary={vocabulary} />
        <StorefrontFooter storefront={data} />
      </div>
    </main>
  );
}

function formatPrice(price: number, isRtl: boolean): string {
  const formatted = new Intl.NumberFormat(isRtl ? 'ar-QA' : 'en-QA').format(price);
  return isRtl ? `من ${formatted} QAR` : `from ${formatted} QAR`;
}

function EmptyState({ isRtl }: { isRtl: boolean }) {
  return (
    <p
      style={{
        marginTop: 'clamp(24px, 4vw, 48px)',
        textAlign: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'color-mix(in srgb, var(--sf-ink) 50%, transparent)',
      }}
    >
      {isRtl ? 'الأعمال قادمة قريباً' : 'work coming soon'}
    </p>
  );
}
