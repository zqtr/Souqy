import type { Locale } from '@/i18n/locales';
import { getCopy } from '@/content/copy';
import { Marquee } from '@/components/primitives/Marquee';
import { ArchMark } from '@/components/primitives/ArchMark';
import { palette } from '@/lib/tokens';

type Props = {
  locale: Locale;
};

/**
 * Dark band of practice nouns. Alternates English / Arabic for every
 * pair, with a small arch as the separator. The strip scrolls in the
 * reading direction of the active locale.
 */
export function MarqueeBand({ locale }: Props) {
  const en = getCopy('en').marquee.items;
  const ar = getCopy('ar').marquee.items;
  const items: React.ReactNode[] = [];
  const len = Math.max(en.length, ar.length);
  for (let i = 0; i < len; i += 1) {
    const enItem = en[i];
    const arItem = ar[i];
    if (enItem !== undefined) items.push(<span key={`en-${i}`}>{enItem}</span>);
    if (arItem !== undefined) {
      items.push(
        <span
          key={`ar-${i}`}
          dir="rtl"
          style={{ fontFamily: 'var(--font-arabic), var(--font-sans)' }}
        >
          {arItem}
        </span>,
      );
    }
  }

  return (
    <section
      aria-label="practices"
      className="bg-[color:var(--surface-contrast)] text-[color:var(--ink-on-contrast)]"
      style={{
        padding: '28px 0',
        borderTop: `1px solid ${palette.goldDeep}33`,
        borderBottom: `1px solid ${palette.goldDeep}33`,
        fontFamily: 'var(--font-sans)',
        fontWeight: 300,
        fontSize: 'clamp(24px, 3.4vw, 56px)',
        letterSpacing: '-0.02em',
      }}
    >
      <Marquee
        items={items}
        speed={60}
        direction={locale === 'ar' ? 'rtl' : 'ltr'}
        separator={<ArchMark size={20} stroke={palette.gold} inner={false} />}
      />
    </section>
  );
}
