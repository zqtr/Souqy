import type { BlockRenderProps } from './BlockContext';
import type { ContactCardProps } from '@/lib/blocks/types';
import { StorefrontPractical } from '../StorefrontPractical';

/**
 * Wraps the existing StorefrontPractical card so blocks can reuse the
 * same visual language. The block accepts both visibility toggles
 * (showPhone / showArea / …) and per-block content overrides — when an
 * override is present it wins over the storefront row, otherwise the
 * canonical profile from /account/<slug>/edit is used.
 *
 * `heading` / `body` are optional editorial text rendered above the
 * practical strip — they let a section function as a "Visit us" or
 * "Contact" intro, not just a contact-info readout.
 */
export function ContactCardBlock({ block, ctx }: BlockRenderProps<ContactCardProps>) {
  const { storefront, vocabulary, isRtl } = ctx;
  const props = block.props;

  const showPhone = props.showPhone ?? true;
  const showArea = props.showArea ?? true;
  const showHours = props.showHours ?? true;
  const showInstagram = props.showInstagram ?? true;

  const phone = showPhone ? (props.phone?.trim() || storefront.phone) : null;
  const area = showArea ? (props.area?.trim() || storefront.area) : null;
  const hours = showHours ? (props.hours?.trim() || storefront.hours) : null;
  const instagram = showInstagram ? (props.instagram?.trim() || storefront.instagram) : null;

  const heading = props.heading?.trim();
  const body = props.body?.trim();
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';

  const filtered = {
    ...storefront,
    phone,
    area,
    hours,
    instagram,
  };

  const hasContact = Boolean(phone || area || hours || instagram);
  if (!hasContact && !heading && !body) return null;

  return (
    <div>
      {heading || body ? (
        <header
          style={{
            padding: 'clamp(24px, 4vw, 48px) clamp(16px, 3vw, 32px) 0',
            textAlign: isRtl ? 'right' : 'left',
            maxWidth: 720,
            marginInline: 'auto',
          }}
        >
          {heading ? (
            <h2
              style={{
                margin: 0,
                fontFamily,
                fontSize: 'clamp(22px, 3vw, 30px)',
                fontWeight: 'var(--sf-heading-weight, 500)',
                letterSpacing: '-0.01em',
                color: 'var(--sf-ink)',
              }}
            >
              {heading}
            </h2>
          ) : null}
          {body ? (
            <p
              style={{
                margin: heading ? '12px 0 0' : 0,
                fontFamily,
                fontSize: 15,
                lineHeight: 1.6,
                color: 'color-mix(in srgb, var(--sf-ink) 75%, transparent)',
              }}
            >
              {body}
            </p>
          ) : null}
        </header>
      ) : null}
      {hasContact ? <StorefrontPractical data={filtered} vocabulary={vocabulary} /> : null}
    </div>
  );
}
