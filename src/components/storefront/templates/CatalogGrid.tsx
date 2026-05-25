import type { TemplateProps } from '../Storefront';
import { StorefrontTopRail, StorefrontFooter } from '../StorefrontChrome';
import { StorefrontHero } from '../StorefrontHero';
import { StorefrontPractical } from '../StorefrontPractical';
import { InquireButton } from '../InquireButton';

/**
 * Catalog grid archetype — 3-column product grid. Used by ecommerce /
 * perfume_oud / agriculture.
 */
export function CatalogGrid({ data, vocabulary, products }: TemplateProps) {
  const isRtl = data.locale === 'ar';
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';

  return (
    <main
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={data.locale}
      style={{
        fontFamily,
        padding: 'clamp(40px, 6vw, 96px) clamp(20px, 5vw, 64px)',
      }}
    >
      <div className="mx-auto" style={{ maxWidth: 1280 }}>
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
            <div
              className="grid"
              style={{
                gap: 'clamp(20px, 2.5vw, 32px)',
                gridTemplateColumns:
                  'repeat(auto-fill, minmax(min(280px, 100%), 1fr))',
              }}
            >
              {products.map((p) => (
                <article
                  key={p.id}
                  className="flex flex-col"
                  style={{
                    gap: 12,
                    padding: 16,
                    border:
                      '1px solid color-mix(in srgb, var(--sf-accent) 18%, transparent)',
                    background: 'color-mix(in srgb, var(--sf-ink) 3%, transparent)',
                  }}
                >
                  <div
                    style={{
                      aspectRatio: '1 / 1',
                      background: 'color-mix(in srgb, var(--sf-ink) 6%, transparent)',
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
                    {p.status === 'sold_out' ? (
                      <span
                        style={{
                          position: 'absolute',
                          top: 10,
                          insetInlineStart: 10,
                          padding: '3px 8px',
                          background: 'color-mix(in srgb, var(--sf-ground) 92%, transparent)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: 'var(--sf-ink)',
                        }}
                      >
                        {isRtl ? 'نفذ' : 'sold out'}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-col" style={{ gap: 4 }}>
                    {p.category ? (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: 'color-mix(in srgb, var(--sf-ink) 55%, transparent)',
                        }}
                      >
                        {p.category}
                      </span>
                    ) : null}
                    <h3
                      style={{
                        margin: 0,
                        fontFamily,
                        fontSize: 15,
                        fontWeight: 500,
                        lineHeight: 1.3,
                      }}
                    >
                      {p.title}
                    </h3>
                    {p.description ? (
                      <p
                        style={{
                          margin: 0,
                          fontFamily,
                          fontSize: 13,
                          lineHeight: 1.5,
                          color: 'color-mix(in srgb, var(--sf-ink) 65%, transparent)',
                        }}
                      >
                        {p.description}
                      </p>
                    ) : null}
                  </div>
                  <div
                    className="flex items-center justify-between gap-2"
                    style={{
                      marginTop: 'auto',
                      paddingTop: 8,
                      flexDirection: isRtl ? 'row-reverse' : 'row',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13,
                        color: 'var(--sf-accent)',
                      }}
                      data-souqna-price={
                        p.priceQar !== null ? String(p.priceQar) : undefined
                      }
                    >
                      {formatPrice(p.priceQar, isRtl)}
                    </span>
                    <InquireButton storefront={data} product={p} />
                  </div>
                </article>
              ))}
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

function formatPrice(price: number | null, isRtl: boolean): string {
  if (price === null) return isRtl ? 'عند الطلب' : 'on request';
  const formatted = new Intl.NumberFormat(isRtl ? 'ar-QA' : 'en-QA').format(price);
  return `${formatted} QAR`;
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
      {isRtl ? 'الكتالوج قادم قريباً' : 'catalogue coming soon'}
    </p>
  );
}
