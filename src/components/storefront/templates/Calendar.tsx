import type { TemplateProps } from '../Storefront';
import { StorefrontTopRail, StorefrontFooter } from '../StorefrontChrome';
import { StorefrontHero } from '../StorefrontHero';
import { StorefrontPractical } from '../StorefrontPractical';
import { InquireButton } from '../InquireButton';

/**
 * Calendar archetype — date-stamped upcoming items, sorted by event_at.
 * Used by events_weddings / tutoring. Items without a date are listed under
 * an "ongoing" group at the bottom.
 */
export function Calendar({ data, vocabulary, products }: TemplateProps) {
  const isRtl = data.locale === 'ar';
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const serifFamily = isRtl ? 'var(--font-arabic-serif), serif' : 'var(--font-serif), serif';

  const dated = products
    .filter((p) => p.eventAt !== null)
    .sort((a, b) => (a.eventAt!.getTime() - b.eventAt!.getTime()));
  const undated = products.filter((p) => p.eventAt === null);

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
            <ul className="m-0 p-0 flex flex-col" style={{ listStyle: 'none', gap: 0 }}>
              {dated.map((p) => (
                <CalendarRow
                  key={p.id}
                  date={p.eventAt!}
                  title={p.title}
                  description={p.description}
                  category={p.category}
                  priceQar={p.priceQar}
                  isRtl={isRtl}
                  serifFamily={serifFamily}
                  fontFamily={fontFamily}
                  storefront={data}
                  productId={p.id}
                  product={p}
                />
              ))}
              {undated.length > 0 ? (
                <li
                  style={{
                    marginTop: 24,
                    paddingTop: 16,
                    borderTop: '1px dashed color-mix(in srgb, var(--sf-accent) 35%, transparent)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'color-mix(in srgb, var(--sf-ink) 55%, transparent)',
                  }}
                >
                  {isRtl ? 'متوفر دائماً' : 'always on'}
                </li>
              ) : null}
              {undated.map((p) => (
                <CalendarRow
                  key={p.id}
                  date={null}
                  title={p.title}
                  description={p.description}
                  category={p.category}
                  priceQar={p.priceQar}
                  isRtl={isRtl}
                  serifFamily={serifFamily}
                  fontFamily={fontFamily}
                  storefront={data}
                  productId={p.id}
                  product={p}
                />
              ))}
            </ul>
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

import type { Product } from '@/lib/products';
import type { Storefront } from '@/lib/brief';

function CalendarRow({
  date,
  title,
  description,
  category,
  priceQar,
  isRtl,
  serifFamily,
  fontFamily,
  storefront,
  product,
}: {
  date: Date | null;
  title: string;
  description: string | null;
  category: string | null;
  priceQar: number | null;
  isRtl: boolean;
  serifFamily: string;
  fontFamily: string;
  storefront: Storefront;
  productId: string;
  product: Product;
}) {
  const dateLabel = date
    ? new Intl.DateTimeFormat(isRtl ? 'ar-QA' : 'en-GB', {
        day: '2-digit',
        month: 'short',
      }).format(date)
    : '·';
  const dayName = date
    ? new Intl.DateTimeFormat(isRtl ? 'ar-QA' : 'en-GB', { weekday: 'short' }).format(date)
    : '';

  return (
    <li
      className="grid items-start"
      style={{
        gridTemplateColumns: '96px 1fr auto',
        gap: 'clamp(16px, 3vw, 32px)',
        padding: '20px 0',
        borderBottom: '1px solid color-mix(in srgb, var(--sf-ink) 12%, transparent)',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          padding: '8px 0',
          border: '1px solid color-mix(in srgb, var(--sf-accent) 30%, transparent)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <div style={{ fontSize: 18, color: 'var(--sf-ink)' }}>{dateLabel}</div>
        <div
          style={{
            fontSize: 9,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'color-mix(in srgb, var(--sf-ink) 55%, transparent)',
          }}
        >
          {dayName}
        </div>
      </div>
      <div className="flex flex-col" style={{ gap: 6, minWidth: 0 }}>
        {category ? (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--sf-accent)',
            }}
          >
            {category}
          </span>
        ) : null}
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
          {title}
        </h3>
        {description ? (
          <p
            style={{
              margin: 0,
              fontFamily,
              fontSize: 14,
              lineHeight: 1.55,
              color: 'color-mix(in srgb, var(--sf-ink) 70%, transparent)',
            }}
          >
            {description}
          </p>
        ) : null}
        {priceQar !== null ? (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--sf-accent)',
            }}
          >
            {formatPrice(priceQar, isRtl)}
          </span>
        ) : null}
      </div>
      <div style={{ alignSelf: 'center' }}>
        <InquireButton storefront={storefront} product={product} />
      </div>
    </li>
  );
}

function formatPrice(price: number, isRtl: boolean): string {
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
      {isRtl ? 'لا فعاليات قادمة بعد' : 'no upcoming events yet'}
    </p>
  );
}
