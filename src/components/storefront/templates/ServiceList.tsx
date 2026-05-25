import type { TemplateProps } from '../Storefront';
import { StorefrontTopRail, StorefrontFooter } from '../StorefrontChrome';
import { StorefrontHero } from '../StorefrontHero';
import { StorefrontPractical } from '../StorefrontPractical';
import { InquireButton } from '../InquireButton';

/**
 * Service list archetype — service rows, each with its own per-row Inquire
 * CTA. Used by salon / fitness / tailoring_abaya / auto_detailing /
 * courier_delivery.
 */
export function ServiceList({ data, vocabulary, products }: TemplateProps) {
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
      <div className="mx-auto" style={{ maxWidth: 980 }}>
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
            <ul className="m-0 p-0 flex flex-col" style={{ listStyle: 'none', gap: 18 }}>
              {products.map((p) => (
                <li
                  key={p.id}
                  style={{
                    padding: 'clamp(20px, 2.5vw, 28px)',
                    border:
                      '1px solid color-mix(in srgb, var(--sf-accent) 22%, transparent)',
                    background: 'color-mix(in srgb, var(--sf-ink) 3%, transparent)',
                  }}
                >
                  <div
                    className="flex flex-wrap items-start justify-between gap-4"
                    style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}
                  >
                    <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                      <h3
                        style={{
                          margin: 0,
                          fontFamily,
                          fontSize: 18,
                          fontWeight: 500,
                        }}
                      >
                        {p.title}
                        {p.status === 'sold_out' ? (
                          <span
                            style={{
                              marginInlineStart: 10,
                              fontFamily: 'var(--font-mono)',
                              fontSize: 10,
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                              color: 'color-mix(in srgb, var(--sf-ink) 50%, transparent)',
                            }}
                          >
                            {isRtl ? 'متوقفة' : 'paused'}
                          </span>
                        ) : null}
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
                    </div>
                    <div
                      className="flex items-center gap-4"
                      style={{
                        flex: '0 0 auto',
                        flexDirection: isRtl ? 'row-reverse' : 'row',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 13,
                          color: 'var(--sf-accent)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatPrice(p.priceQar, isRtl)}
                      </span>
                      <InquireButton storefront={data} product={p} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
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
      {isRtl ? 'الخدمات قادمة قريباً' : 'services coming soon'}
    </p>
  );
}
