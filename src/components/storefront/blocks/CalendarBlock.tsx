import type { BlockRenderProps } from './BlockContext';
import type { CalendarProps, CalendarSlot } from '@/lib/blocks/types';
import { InquireButton } from '../InquireButton';
import { formatPrice, pickProducts } from './helpers';

/**
 * Date-sorted agenda. Two data sources are supported:
 *   - `props.slots` (inline) — used by templates (Studio) that ship a
 *     populated booking calendar before any products exist.
 *   - The storefront's products table (with date-in-title parsing) —
 *     the original behaviour.
 *
 * Inline slots win when present and non-empty.
 */
export function CalendarBlock({ block, ctx }: BlockRenderProps<CalendarProps>) {
  const { products, storefront, vocabulary, isRtl } = ctx;
  const props = block.props;
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const serifFamily = isRtl ? 'var(--font-arabic-serif), serif' : 'var(--font-serif), serif';

  const inlineSlots = props.slots ?? [];
  const useInline = inlineSlots.length > 0;
  const heading = props.heading?.trim() || vocabulary.offerLabel;

  if (useInline) {
    const limited =
      typeof props.limit === 'number' && props.limit > 0
        ? inlineSlots.slice(0, props.limit)
        : inlineSlots;
    const sorted = [...limited].sort((a, b) =>
      `${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`),
    );
    if (sorted.length === 0) return renderEmpty(isRtl);

    return (
      <section style={{ padding: 'clamp(20px, 3vw, 40px) 0' }}>
        <Heading text={heading} isRtl={isRtl} />
        <Section
          label={isRtl ? 'قادمة' : 'upcoming'}
          isRtl={isRtl}
          serifFamily={serifFamily}
        >
          {sorted.map((slot) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              fontFamily={fontFamily}
              isRtl={isRtl}
            />
          ))}
        </Section>
      </section>
    );
  }

  const items = pickProducts(products, props.category, props.limit);
  if (items.length === 0) return renderEmpty(isRtl);

  const decorated = items.map((p) => ({ p, date: parseDate(`${p.title} ${p.description ?? ''}`) }));
  const dated = decorated
    .filter((d) => d.date !== null)
    .sort((a, b) => (a.date! < b.date! ? -1 : 1));
  const undated = decorated.filter((d) => d.date === null);

  return (
    <section style={{ padding: 'clamp(20px, 3vw, 40px) 0' }}>
      <Heading text={heading} isRtl={isRtl} />
      <div className="flex flex-col" style={{ gap: 'clamp(24px, 3vw, 36px)' }}>
        {dated.length > 0 ? (
          <Section
            label={isRtl ? 'قادمة' : 'upcoming'}
            isRtl={isRtl}
            serifFamily={serifFamily}
          >
            {dated.map(({ p, date }) => (
              <Row
                key={p.id}
                title={p.title}
                description={p.description}
                meta={formatDate(date!, isRtl)}
                price={formatPrice(p.priceQar, isRtl)}
                fontFamily={fontFamily}
                isRtl={isRtl}
                cta={<InquireButton storefront={storefront} product={p} />}
              />
            ))}
          </Section>
        ) : null}
        {undated.length > 0 ? (
          <Section
            label={isRtl ? 'دائمة' : 'standing'}
            isRtl={isRtl}
            serifFamily={serifFamily}
          >
            {undated.map(({ p }) => (
              <Row
                key={p.id}
                title={p.title}
                description={p.description}
                meta={null}
                price={formatPrice(p.priceQar, isRtl)}
                fontFamily={fontFamily}
                isRtl={isRtl}
                cta={<InquireButton storefront={storefront} product={p} />}
              />
            ))}
          </Section>
        ) : null}
      </div>
    </section>
  );
}

function renderEmpty(isRtl: boolean) {
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
      {isRtl ? 'الأجندة قادمة قريباً' : 'agenda coming soon'}
    </p>
  );
}

function Heading({ text, isRtl }: { text: string; isRtl: boolean }) {
  return (
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
      {text}
    </div>
  );
}

function Section({
  label,
  isRtl,
  serifFamily,
  children,
}: {
  label: string;
  isRtl: boolean;
  serifFamily: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2
        style={{
          fontFamily: serifFamily,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 'clamp(20px, 2.4vw, 26px)',
          margin: '0 0 16px',
          paddingBottom: 8,
          borderBottom: '1px solid color-mix(in srgb, var(--sf-accent) 30%, transparent)',
          textAlign: isRtl ? 'right' : 'left',
        }}
      >
        {label}
      </h2>
      <ul className="m-0 p-0 flex flex-col" style={{ listStyle: 'none', gap: 14 }}>
        {children}
      </ul>
    </div>
  );
}

function Row({
  title,
  description,
  meta,
  price,
  fontFamily,
  isRtl,
  cta,
}: {
  title: string;
  description: string | null;
  meta: string | null;
  price: string;
  fontFamily: string;
  isRtl: boolean;
  cta: React.ReactNode;
}) {
  return (
    <li
      className="flex flex-wrap items-start justify-between gap-3"
      style={{
        padding: '14px 0',
        borderBottom: '1px solid color-mix(in srgb, var(--sf-accent) 18%, transparent)',
        flexDirection: isRtl ? 'row-reverse' : 'row',
      }}
    >
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        {meta ? (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--sf-accent)',
            }}
          >
            {meta}
          </span>
        ) : null}
        <h3
          style={{
            margin: '4px 0 0',
            fontFamily,
            fontSize: 16,
            fontWeight: 500,
          }}
        >
          {title}
        </h3>
        {description ? (
          <p
            style={{
              margin: '6px 0 0',
              fontFamily,
              fontSize: 14,
              color: 'color-mix(in srgb, var(--sf-ink) 70%, transparent)',
            }}
          >
            {description}
          </p>
        ) : null}
      </div>
      <div
        className="flex items-center gap-3"
        style={{ flex: '0 0 auto', flexDirection: isRtl ? 'row-reverse' : 'row' }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--sf-accent)',
            whiteSpace: 'nowrap',
          }}
        >
          {price}
        </span>
        {cta}
      </div>
    </li>
  );
}

function SlotRow({
  slot,
  fontFamily,
  isRtl,
}: {
  slot: CalendarSlot;
  fontFamily: string;
  isRtl: boolean;
}) {
  const date = new Date(`${slot.date}T00:00:00`);
  const meta = Number.isNaN(date.getTime())
    ? slot.date
    : formatDate(date, isRtl);
  const status = slot.status ?? 'open';
  const statusLabel = statusCopy(status, isRtl);
  const isFull = status === 'full';

  return (
    <li
      className="flex flex-wrap items-start justify-between gap-3"
      style={{
        padding: '14px 0',
        borderBottom: '1px solid color-mix(in srgb, var(--sf-accent) 18%, transparent)',
        flexDirection: isRtl ? 'row-reverse' : 'row',
        opacity: isFull ? 0.55 : 1,
      }}
    >
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--sf-accent)',
          }}
        >
          {meta}
          {slot.time ? ` · ${slot.time}` : ''}
        </span>
        <h3
          style={{
            margin: '4px 0 0',
            fontFamily,
            fontSize: 16,
            fontWeight: 500,
          }}
        >
          {slot.label}
        </h3>
        {typeof slot.capacity === 'number' && slot.capacity > 0 ? (
          <p
            style={{
              margin: '6px 0 0',
              fontFamily,
              fontSize: 13,
              color: 'color-mix(in srgb, var(--sf-ink) 65%, transparent)',
            }}
          >
            {isRtl
              ? `${slot.capacity} مقاعد`
              : `${slot.capacity} seat${slot.capacity === 1 ? '' : 's'}`}
          </p>
        ) : null}
      </div>
      <div
        className="flex items-center gap-3"
        style={{ flex: '0 0 auto', flexDirection: isRtl ? 'row-reverse' : 'row' }}
      >
        <StatusPill label={statusLabel} status={status} />
      </div>
    </li>
  );
}

function StatusPill({
  label,
  status,
}: {
  label: string;
  status: 'open' | 'limited' | 'full';
}) {
  const tint =
    status === 'full'
      ? 'color-mix(in srgb, var(--sf-ink) 18%, transparent)'
      : status === 'limited'
        ? 'color-mix(in srgb, var(--sf-accent) 22%, transparent)'
        : 'color-mix(in srgb, var(--sf-accent) 14%, transparent)';
  const ink =
    status === 'full'
      ? 'color-mix(in srgb, var(--sf-ink) 60%, transparent)'
      : 'var(--sf-accent)';
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: ink,
        background: tint,
        padding: '4px 10px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function statusCopy(
  status: 'open' | 'limited' | 'full',
  isRtl: boolean,
): string {
  if (status === 'full') return isRtl ? 'مكتمل' : 'full';
  if (status === 'limited') return isRtl ? 'محدود' : 'limited';
  return isRtl ? 'متاح' : 'open';
}

function parseDate(input: string): Date | null {
  const iso = input.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso?.[1]) {
    const d = new Date(iso[1]);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const slashed = input.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashed) {
    const [, dd, mm, yyyy] = slashed;
    if (dd && mm && yyyy) {
      const d = new Date(
        Number(yyyy.length === 2 ? `20${yyyy}` : yyyy),
        Number(mm) - 1,
        Number(dd),
      );
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function formatDate(d: Date, isRtl: boolean): string {
  return new Intl.DateTimeFormat(isRtl ? 'ar-QA' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}
