import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/i18n/locales';
import { buildMetadata } from '@/lib/seo';
import { templatePresets, sortedTemplateIdsForPicker } from '@/lib/templates';
import { palettes } from '@/lib/palettes';
import type { BusinessType, TemplateId } from '@/lib/brief';
import { getTemplateIndustrySeed } from '@/lib/blocks/templateIndustrySeed';
import Footer8 from '@/components/footer-8';

type Props = { params: Promise<{ locale: string }> };

const COPY = {
  en: {
    eyebrow: 'Templates',
    title: 'Pick a template, ship a store.',
    intro:
      'Eleven storefront templates, all bilingual, all responsive. Each one ships with a tuned palette, typography, and a complete block stack — so the first draft is already a working store.',
    tierLabel: { free: 'Free', starter: 'Pro', pro: 'Pro+', atelier: 'Max+' },
    cta: 'Use this template',
    explore: 'Open builder',
    backHome: 'Back to home',
  },
  ar: {
    eyebrow: 'القوالب',
    title: 'اختر قالباً وأطلق متجرك.',
    intro:
      'أحد عشر قالباً للمتجر، كلها ثنائية اللغة وتعمل على كل الأجهزة. كل قالب يجي بلوحة ألوان وتصميم وهيكل بلوكات جاهز، عشان أول مسودة تكون متجر شغال.',
    tierLabel: { free: 'مجاني', starter: 'برو', pro: 'برو+', atelier: 'ماكس+' },
    cta: 'جرب هالقالب',
    explore: 'افتح البلدر',
    backHome: 'الرجوع للرئيسية',
  },
} as const;

const TEMPLATE_PREVIEW_BUSINESS: Record<TemplateId, BusinessType> = {
  atrium: 'ecommerce',
  souqline: 'home_kitchen',
  studio: 'graphic_design',
  lounge: 'clothing_store',
  monoline: 'cafe',
  kiosk: 'perfume_oud',
  bazaar: 'clothing_store',
  harvest: 'home_kitchen',
  vitrine: 'ecommerce',
  launchpad: 'graphic_design',
  frame: 'photography',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const c = COPY[raw];
  return buildMetadata({
    locale: raw,
    path: '/templates',
    title: c.title,
    description: c.intro,
  });
}

export default async function TemplatesPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  setRequestLocale(locale);

  const c = COPY[locale];
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const localized = (href: string) => (locale === 'ar' ? `/ar${href}` : href);
  const order = sortedTemplateIdsForPicker();

  return (
    <div
      dir={dir}
      style={{
        minHeight: '100vh',
        background: 'var(--sq-bg, #E8DCC4)',
        color: 'var(--sq-ink, #1F1B16)',
        fontFamily: dir === 'rtl' ? 'var(--font-arabic-text)' : 'var(--font-english)',
      }}
    >
      <main
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          padding:
            'clamp(64px, 9vw, 120px) clamp(20px, 5vw, 64px) clamp(48px, 7vw, 96px)',
        }}
      >
        <Link
          href={localized('/')}
          style={{
            display: 'inline-block',
            marginBottom: 32,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--sq-muted, rgba(31,27,22,0.65))',
            textDecoration: 'none',
          }}
        >
          {dir === 'rtl' ? '→' : '←'} {c.backHome}
        </Link>

        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--sq-gold-deep, #8B6F2A)',
            margin: '0 0 16px',
          }}
        >
          — {c.eyebrow}
        </p>
        <h1
          style={{
            fontFamily:
              dir === 'rtl' ? 'var(--font-arabic-serif)' : 'var(--font-english)',
            fontWeight: dir === 'rtl' ? 700 : 500,
            fontSize: 'clamp(40px, 5.5vw, 76px)',
            lineHeight: dir === 'rtl' ? 1.08 : 0.96,
            letterSpacing: '-0.01em',
            margin: 0,
            maxWidth: 920,
          }}
        >
          {c.title}
        </h1>
        <p
          style={{
            margin: '20px 0 0',
            maxWidth: 640,
            fontSize: 'clamp(15px, 1.2vw, 17px)',
            lineHeight: 1.55,
            color: 'var(--sq-muted, rgba(31,27,22,0.7))',
          }}
        >
          {c.intro}
        </p>

        <section
          aria-label={c.eyebrow}
          style={{
            marginTop: 'clamp(40px, 5vw, 64px)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 'clamp(18px, 2.4vw, 28px)',
          }}
        >
          {order.map((id) => {
            const t = templatePresets[id];
            const palette = palettes[t.palette]?.light ?? {
              ink: '#1F1B16',
              ground: '#E8DCC4',
              accent: '#C9A961',
            };
            const seed = getTemplateIndustrySeed(id, TEMPLATE_PREVIEW_BUSINESS[id], {
              businessName: id === 'frame' ? 'Oryx' : 'Souqna Studio',
              tagline: null,
            });
            const tierLabel =
              c.tierLabel[t.tier as keyof typeof c.tierLabel] ?? t.tier;
            const begin = localized(`/begin?template=${encodeURIComponent(id)}`);
            return (
              <Link
                key={id}
                href={begin}
                aria-label={`${t.label} — ${c.cta}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'var(--sq-elevated, #F1E9D7)',
                  border: '1px solid var(--sq-rule, rgba(31,27,22,0.12))',
                  borderRadius: 14,
                  overflow: 'hidden',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'transform 280ms ease, box-shadow 280ms ease',
                }}
                className="sq-template-card"
              >
                <CommercePreview
                  id={id}
                  ink={palette.ink}
                  ground={palette.ground}
                  accent={palette.accent}
                  label={t.label}
                  seed={seed}
                />
                <div
                  style={{
                    padding: '18px 20px 22px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <h2
                      style={{
                        margin: 0,
                        fontFamily:
                          dir === 'rtl'
                            ? 'var(--font-arabic-serif)'
                            : 'var(--font-english)',
                        fontWeight: dir === 'rtl' ? 700 : 500,
                        fontSize: 19,
                        letterSpacing: '-0.005em',
                      }}
                    >
                      {t.label}
                    </h2>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9.5,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: 999,
                        background:
                          t.tier === 'free'
                            ? 'rgba(31,27,22,0.08)'
                            : 'var(--sq-gold, #D4AF37)',
                        color:
                          t.tier === 'free'
                            ? 'var(--sq-ink, #1F1B16)'
                            : 'var(--sq-ink, #1F1B16)',
                      }}
                    >
                      {tierLabel}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13.5,
                      lineHeight: 1.55,
                      color: 'var(--sq-muted, rgba(31,27,22,0.7))',
                    }}
                  >
                    {t.description}
                  </p>
                  <div
                    style={{
                      marginTop: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: 14,
                      borderTop:
                        '1px dashed var(--sq-rule, rgba(31,27,22,0.18))',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10.5,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'var(--sq-muted, rgba(31,27,22,0.55))',
                      }}
                    >
                      {t.palette.replace(/_/g, ' ')}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        color: 'var(--sq-ink, #1F1B16)',
                      }}
                    >
                      {c.cta} {dir === 'rtl' ? '←' : '→'}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      </main>

      <style>{`
        .sq-template-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 24px 48px -24px rgba(31, 27, 22, 0.28);
          border-color: var(--sq-gold, #D4AF37) !important;
        }
        .sq-template-card:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(139, 58, 58, 0.5);
        }
        .sq-commerce-preview {
          min-height: 280px;
          isolation: isolate;
        }
        .sq-commerce-preview__wash {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 20% 18%, color-mix(in srgb, var(--tpl-accent) 36%, transparent) 0, transparent 24%),
            linear-gradient(135deg, var(--tpl-ground) 0%, color-mix(in srgb, var(--tpl-ground) 72%, var(--tpl-accent)) 100%);
          z-index: 0;
        }
        .sq-commerce-preview__top,
        .sq-commerce-preview__hero,
        .sq-commerce-preview__products,
        .sq-commerce-preview__focus,
        .sq-commerce-preview__trust {
          position: absolute;
          z-index: 1;
        }
        .sq-commerce-preview__top {
          top: 18px;
          inset-inline: 18px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-mono);
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 9px;
        }
        .sq-commerce-preview__top b {
          margin-inline-end: auto;
          font-size: 10px;
          letter-spacing: 0.08em;
        }
        .sq-commerce-preview__top span,
        .sq-commerce-preview__hero em,
        .sq-commerce-preview__trust span {
          border: 1px solid color-mix(in srgb, var(--tpl-ink) 18%, transparent);
          border-radius: 999px;
          padding: 4px 8px;
          background: color-mix(in srgb, var(--tpl-ground) 78%, white 22%);
        }
        .sq-commerce-preview__hero {
          top: 54px;
          inset-inline-start: 18px;
          width: min(54%, 240px);
          display: grid;
          gap: 8px;
        }
        .sq-commerce-preview__hero small {
          font-family: var(--font-mono);
          font-size: 8px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          opacity: 0.72;
        }
        .sq-commerce-preview__hero strong {
          display: -webkit-box;
          font-family: var(--font-english);
          font-size: clamp(18px, 2.4vw, 24px);
          line-height: 1;
          font-weight: 600;
          max-width: 15ch;
          overflow: hidden;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
        }
        .sq-commerce-preview__hero em {
          justify-self: start;
          font-family: var(--font-mono);
          font-style: normal;
          font-size: 8px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          background: var(--tpl-ink);
          color: var(--tpl-ground);
        }
        .sq-commerce-preview__products {
          left: 18px;
          right: 18px;
          bottom: 48px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }
        .sq-commerce-preview__products article {
          min-width: 0;
          border: 1px solid color-mix(in srgb, var(--tpl-ink) 14%, transparent);
          border-radius: 10px;
          padding: 6px;
          background: color-mix(in srgb, var(--tpl-ground) 76%, white 24%);
          box-shadow: 0 12px 24px -18px color-mix(in srgb, var(--tpl-ink) 44%, transparent);
        }
        .sq-commerce-preview__products i,
        .sq-commerce-preview__focus i {
          display: block;
          background-size: cover;
          background-position: center;
          border-radius: 8px;
        }
        .sq-commerce-preview__products i {
          aspect-ratio: 1;
          margin-bottom: 6px;
        }
        .sq-commerce-preview__products strong,
        .sq-commerce-preview__focus b {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 10px;
          line-height: 1.2;
        }
        .sq-commerce-preview__products span,
        .sq-commerce-preview__focus span {
          display: block;
          margin-top: 3px;
          font-family: var(--font-mono);
          font-size: 8px;
          letter-spacing: 0.08em;
          color: color-mix(in srgb, var(--tpl-ink) 70%, var(--tpl-accent));
        }
        .sq-commerce-preview__focus {
          top: 88px;
          inset-inline-end: 18px;
          width: 30%;
          border-radius: 16px;
          padding: 8px;
          background: color-mix(in srgb, var(--tpl-ink) 88%, transparent);
          color: var(--tpl-ground);
          box-shadow: 0 22px 42px -24px color-mix(in srgb, var(--tpl-ink) 72%, transparent);
        }
        .sq-commerce-preview__focus i {
          aspect-ratio: 4 / 5;
          margin-bottom: 8px;
        }
        .sq-commerce-preview__trust {
          inset-inline: 18px;
          bottom: 16px;
          display: flex;
          gap: 6px;
          font-family: var(--font-mono);
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 8px;
        }
        .sq-commerce-preview--souqline .sq-commerce-preview__products {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }
        .sq-commerce-preview--atrium .sq-commerce-preview__focus,
        .sq-commerce-preview--souqline .sq-commerce-preview__focus,
        .sq-commerce-preview--studio .sq-commerce-preview__focus,
        .sq-commerce-preview--lounge .sq-commerce-preview__focus,
        .sq-commerce-preview--monoline .sq-commerce-preview__focus,
        .sq-commerce-preview--harvest .sq-commerce-preview__focus,
        .sq-commerce-preview--launchpad .sq-commerce-preview__focus {
          display: none;
        }
        .sq-commerce-preview--studio .sq-commerce-preview__products,
        .sq-commerce-preview--lounge .sq-commerce-preview__products {
          grid-template-columns: 1fr;
          width: 42%;
          left: auto;
          inset-inline-end: 18px;
          top: 68px;
          bottom: 52px;
        }
        .sq-commerce-preview--studio .sq-commerce-preview__products i,
        .sq-commerce-preview--lounge .sq-commerce-preview__products i {
          display: none;
        }
        .sq-commerce-preview--kiosk .sq-commerce-preview__focus,
        .sq-commerce-preview--vitrine .sq-commerce-preview__focus,
        .sq-commerce-preview--frame .sq-commerce-preview__focus {
          width: 36%;
          transform: rotate(2deg);
        }
        .sq-commerce-preview--bazaar .sq-commerce-preview__hero::after {
          content: "18:24";
          display: block;
          width: max-content;
          border-radius: 999px;
          padding: 5px 8px;
          background: var(--tpl-accent);
          color: var(--tpl-ink);
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 0.12em;
        }
        .sq-commerce-preview--launchpad .sq-commerce-preview__products article {
          border-radius: 4px;
        }
        .sq-commerce-preview--frame .sq-commerce-preview__wash {
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--tpl-ink) 92%, black 8%), color-mix(in srgb, var(--tpl-ground) 44%, var(--tpl-ink))),
            radial-gradient(circle at 80% 20%, var(--tpl-accent), transparent 30%);
        }
        .sq-commerce-preview--frame {
          color: color-mix(in srgb, var(--tpl-ground) 84%, white 16%) !important;
        }
        .sq-commerce-preview--frame .sq-commerce-preview__hero em {
          background: color-mix(in srgb, var(--tpl-ground) 88%, white 12%);
          color: var(--tpl-ink);
        }
        @media (max-width: 520px) {
          .sq-commerce-preview__products {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .sq-commerce-preview__focus {
            display: none;
          }
        }
      `}</style>

      <Footer8 locale={locale} />
    </div>
  );
}

/**
 * Premium mini storefront preview. It uses the same industry-aware seed
 * language as /begin and the first-run builder draft, so browsing,
 * onboarding, and generated stores describe the same template.
 */
function CommercePreview({
  id,
  ink,
  ground,
  accent,
  label,
  seed,
}: {
  id: TemplateId;
  ink: string;
  ground: string;
  accent: string;
  label: string;
  seed: ReturnType<typeof getTemplateIndustrySeed>;
}) {
  const products = seed.products.slice(0, 4);
  const heroProduct = products[0];
  return (
    <div
      aria-hidden
      className={`sq-commerce-preview sq-commerce-preview--${id}`}
      style={{
        '--tpl-ink': ink,
        '--tpl-ground': ground,
        '--tpl-accent': accent,
        position: 'relative',
        aspectRatio: '4 / 3',
        background: ground,
        color: ink,
        overflow: 'hidden',
      } as CSSProperties}
    >
      <div className="sq-commerce-preview__wash" />
      <header className="sq-commerce-preview__top">
        <b>{label.split('·')[0]?.trim()}</b>
        <span>{seed.primaryCategory}</span>
        <span>{seed.secondaryCategory}</span>
      </header>
      <section className="sq-commerce-preview__hero">
        <small>{seed.eyebrow}</small>
        <strong>{seed.title}</strong>
        <em>{seed.ctaLabel}</em>
      </section>
      <div className="sq-commerce-preview__products">
        {products.map((product) => (
          <article key={product.title}>
            <i style={{ backgroundImage: `url("${product.imageUrl}")` }} />
            <strong>{product.title}</strong>
            <span>{formatPreviewPrice(product.priceQar)}</span>
          </article>
        ))}
      </div>
      {heroProduct ? (
        <aside className="sq-commerce-preview__focus">
          <i style={{ backgroundImage: `url("${heroProduct.imageUrl}")` }} />
          <b>{heroProduct.title}</b>
          <span>{formatPreviewPrice(heroProduct.priceQar)}</span>
        </aside>
      ) : null}
      <footer className="sq-commerce-preview__trust">
        <span>EN + AR</span>
        <span>Live cart</span>
        <span>Checkout</span>
      </footer>
    </div>
  );
}

function formatPreviewPrice(price?: number | null) {
  if (typeof price !== 'number') return 'QR -';
  return `QR ${price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}`;
}
