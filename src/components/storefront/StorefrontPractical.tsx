import type { ReactNode } from 'react';
import type { Storefront } from '@/lib/brief';
import type { getVocabulary } from '@/lib/storefront-vocabulary';

type Props = {
  data: Storefront;
  vocabulary: ReturnType<typeof getVocabulary>;
};

type Detail = {
  key: 'phone' | 'area' | 'hours' | 'instagram';
  label: { en: string; ar: string };
  value: ReactNode;
};

/**
 * The "where to find us" strip rendered at the bottom of every storefront
 * archetype. Skips itself if the founder hasn't filled any of the four
 * practical fields, so we never show an empty container.
 */
export function StorefrontPractical({ data, vocabulary }: Props) {
  const isRtl = data.locale === 'ar';
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const details = practicalDetails(data);
  if (details.length === 0) return null;

  return (
    <section
      style={{
        padding: 'clamp(28px, 4vw, 48px)',
        marginTop: 'clamp(40px, 6vw, 64px)',
        borderTop: '1px solid color-mix(in srgb, var(--sf-accent) 22%, transparent)',
        borderBottom: '1px solid color-mix(in srgb, var(--sf-accent) 22%, transparent)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--sf-accent)',
          textAlign: 'center',
          marginBottom: 28,
        }}
      >
        {vocabulary.practicalLabel}
      </div>
      <dl
        className="grid gap-x-12 gap-y-8"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          textAlign: 'center',
        }}
      >
        {details.map((d) => (
          <div key={d.key}>
            <dt
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'color-mix(in srgb, var(--sf-ink) 55%, transparent)',
                marginBottom: 6,
              }}
            >
              {d.label[isRtl ? 'ar' : 'en']}
            </dt>
            <dd style={{ margin: 0, fontFamily, fontSize: 17, lineHeight: 1.45 }}>{d.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function practicalDetails(data: Storefront): Detail[] {
  const out: Detail[] = [];
  if (data.phone) {
    out.push({
      key: 'phone',
      label: { en: 'Call', ar: 'اتصال' },
      value: (
        <a href={`tel:${data.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
          {data.phone}
        </a>
      ),
    });
  }
  if (data.area) {
    out.push({
      key: 'area',
      label: { en: 'Visit', ar: 'الموقع' },
      value: data.area,
    });
  }
  if (data.hours) {
    out.push({
      key: 'hours',
      label: { en: 'Hours', ar: 'الدوام' },
      value: data.hours,
    });
  }
  if (data.instagram) {
    const handle = data.instagram.replace(/^@/, '');
    out.push({
      key: 'instagram',
      label: { en: 'Instagram', ar: 'إنستقرام' },
      value: (
        <a
          href={`https://instagram.com/${handle}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'inherit', textDecoration: 'none' }}
        >
          @{handle}
        </a>
      ),
    });
  }
  return out;
}
