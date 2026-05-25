import type { TemplateProps } from '../Storefront';
import { StorefrontTopRail, StorefrontFooter } from '../StorefrontChrome';
import { StorefrontHero } from '../StorefrontHero';
import { StorefrontPractical } from '../StorefrontPractical';
import { InquireButton } from '../InquireButton';

/**
 * Lookbook archetype — image-led 2-column grid. Used by clothing_store /
 * photography / art_gallery. Each tile has a thin caption row beneath it.
 */
export function Lookbook({ data, vocabulary, products }: TemplateProps) {
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
      <div className="mx-auto" style={{ maxWidth: 1200 }}>
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
            <div
              className="grid"
              style={{
                gap: 'clamp(20px, 2.5vw, 32px)',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(440px, 100%), 1fr))',
              }}
            >
              {products.map((p) => (
                <article key={p.id} className="flex flex-col" style={{ gap: 12 }}>
                  <div
                    style={{
                      aspectRatio: '4 / 5',
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
                    {p.status === 'sold_out' ? (
                      <span
                        style={{
                          position: 'absolute',
                          top: 12,
                          insetInlineStart: 12,
                          padding: '4px 10px',
                          background: 'color-mix(in srgb, var(--sf-ground) 92%, transparent)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          color: 'var(--sf-ink)',
                        }}
                      >
                        {isRtl ? 'نفذ' : 'sold out'}
                      </span>
                    ) : null}
                  </div>
                  <div
                    className="flex items-baseline justify-between gap-3"
                    style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}
                  >
                    <span style={{ fontFamily, fontSize: 16, fontWeight: 500 }}>{p.title}</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: 'var(--sf-accent)',
                      }}
                    >
                      {formatPrice(p.priceQar, isRtl)}
                    </span>
                  </div>
                  {p.description ? (
                    <p
                      style={{
                        margin: 0,
                        fontFamily,
                        fontSize: 13,
                        lineHeight: 1.55,
                        color: 'color-mix(in srgb, var(--sf-ink) 65%, transparent)',
                      }}
                    >
                      {p.description}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 48 }}>
              <InquireButton storefront={data} />
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
      {isRtl ? 'الأعمال قادمة قريباً' : 'collection coming soon'}
    </p>
  );
}
