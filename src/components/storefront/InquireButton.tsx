import type { Storefront } from '@/lib/brief';
import type { Product } from '@/lib/products';

type Props = {
  storefront: Storefront;
  product?: Product;
  variant?: 'primary' | 'ghost';
  fullWidth?: boolean;
};

/**
 * Catalog-only inquire CTA. Prefers WhatsApp (founder phone), falls back to
 * mailto. Builds a localized prefilled message that names the product so the
 * founder knows what the visitor was looking at.
 */
export function InquireButton({ storefront, product, variant = 'ghost', fullWidth }: Props) {
  const isRtl = storefront.locale === 'ar';
  const label = product
    ? isRtl
      ? 'استفسر'
      : 'Inquire'
    : isRtl
      ? 'تواصل معنا'
      : 'Get in touch';

  const message = buildMessage({ storefront, product, isRtl });
  const href = buildHref({ storefront, message });

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '12px 20px',
    border: '1px solid color-mix(in srgb, var(--sf-accent) 60%, transparent)',
    color: variant === 'primary' ? 'var(--sf-ground)' : 'var(--sf-ink)',
    background:
      variant === 'primary' ? 'var(--sf-accent)' : 'transparent',
    textDecoration: 'none',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'background 180ms, color 180ms',
    width: fullWidth ? '100%' : undefined,
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={baseStyle}
      aria-label={label}
    >
      <span aria-hidden="true">→</span>
      {label}
    </a>
  );
}

function buildMessage({
  storefront,
  product,
  isRtl,
}: {
  storefront: Storefront;
  product?: Product;
  isRtl: boolean;
}): string {
  if (product) {
    return isRtl
      ? `مرحباً ${storefront.founderName}، أنا مهتم بـ "${product.title}" من متجركم على سوقنا.`
      : `Hi ${storefront.founderName}, I'm interested in "${product.title}" from your Souqna storefront.`;
  }
  return isRtl
    ? `مرحباً ${storefront.founderName}، شفت متجركم "${storefront.businessName}" على سوقنا وأرغب بالتواصل.`
    : `Hi ${storefront.founderName}, I came across your Souqna storefront "${storefront.businessName}" and would like to get in touch.`;
}

function buildHref({
  storefront,
  message,
}: {
  storefront: Storefront;
  message: string;
}): string {
  if (storefront.phone) {
    const digits = storefront.phone.replace(/[^0-9]/g, '');
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }
  const subject = `Souqna inquiry · ${storefront.businessName}`;
  return `mailto:${storefront.contactEmail}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(message)}`;
}
