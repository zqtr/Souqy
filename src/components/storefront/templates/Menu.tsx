import type { TemplateProps } from '../Storefront';
import { StorefrontTopRail, StorefrontFooter } from '../StorefrontChrome';
import { StorefrontHero } from '../StorefrontHero';
import { StorefrontPractical } from '../StorefrontPractical';
import { InquireButton } from '../InquireButton';

/**
 * Menu archetype — long-form list rows grouped by optional category.
 * Used by cafe / fnb_brand / home_kitchen.
 */
export function Menu({ data, vocabulary, products }: TemplateProps) {
  const isRtl = data.locale === 'ar';
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const serifFamily = isRtl ? 'var(--font-arabic-serif), serif' : 'var(--font-serif), serif';

  // Group by category, preserving the order categories first appear in.
  const groups = new Map<string, typeof products>();
  for (const p of products) {
    const key = (p.category ?? '').trim() || (isRtl ? 'القائمة' : 'menu');
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  return (
    <main
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={data.locale}
      style={{
        fontFamily,
        padding: 'clamp(40px, 6vw, 96px) clamp(20px, 5vw, 64px)',
      }}
    >
      <div className="mx-auto" style={{ maxWidth: 880 }}>
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
                textAlign: 'center',
                marginBottom: 32,
              }}
            >
              {vocabulary.offerLabel}
            </div>
            <div className="flex flex-col" style={{ gap: 40 }}>
              {Array.from(groups.entries()).map(([category, items]) => (
                <div key={category}>
                  <h2
                    style={{
                      fontFamily: serifFamily,
                      fontStyle: 'italic',
                      fontWeight: 400,
                      fontSize: 'clamp(20px, 2.4vw, 26px)',
                      margin: '0 0 16px',
                      paddingBottom: 10,
                      borderBottom:
                        '1px solid color-mix(in srgb, var(--sf-accent) 30%, transparent)',
                    }}
                  >
                    {category}
                  </h2>
                  <ul className="m-0 p-0" style={{ listStyle: 'none' }}>
                    {items.map((p) => (
                      <li
                        key={p.id}
                        style={{
                          padding: '14px 0',
                          borderBottom:
                            '1px solid color-mix(in srgb, var(--sf-ink) 10%, transparent)',
                        }}
                      >
                        <div
                          className="flex items-baseline gap-4"
                          style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}
                        >
                          <span
                            style={{
                              fontFamily,
                              fontSize: 17,
                              fontWeight: 500,
                              flex: '1 1 auto',
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
                                {isRtl ? 'نفذ' : 'sold out'}
                              </span>
                            ) : null}
                          </span>
                          <span
                            aria-hidden="true"
                            style={{
                              flex: '0 1 auto',
                              minWidth: 24,
                              borderBottom:
                                '1px dotted color-mix(in srgb, var(--sf-ink) 30%, transparent)',
                              alignSelf: 'flex-end',
                              height: 1,
                              margin: '0 12px 8px',
                            }}
                          />
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 13,
                              color: 'var(--sf-accent)',
                              flex: '0 0 auto',
                            }}
                          >
                            {formatPrice(p.priceQar, isRtl)}
                          </span>
                        </div>
                        {p.description ? (
                          <p
                            style={{
                              margin: '6px 0 0',
                              fontFamily,
                              fontSize: 14,
                              lineHeight: 1.5,
                              color: 'color-mix(in srgb, var(--sf-ink) 70%, transparent)',
                              maxWidth: 620,
                            }}
                          >
                            {p.description}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}>
              <InquireButton storefront={data} variant="ghost" />
            </div>
          </section>
        ) : (
          <EmptyOffer isRtl={isRtl} />
        )}

        <StorefrontPractical data={data} vocabulary={vocabulary} />
        <StorefrontFooter storefront={data} />
      </div>
    </main>
  );
}

function formatPrice(price: number | null, isRtl: boolean): string {
  if (price === null) return isRtl ? 'عند الطلب' : 'on request';
  const formatted = new Intl.NumberFormat(isRtl ? 'ar-QA' : 'en-QA', {
    minimumFractionDigits: price % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price);
  return `${formatted} QAR`;
}

function EmptyOffer({ isRtl }: { isRtl: boolean }) {
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
      {isRtl ? 'القائمة قادمة قريباً' : 'menu coming soon'}
    </p>
  );
}
